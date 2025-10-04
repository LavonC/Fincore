// ==========================================
// UNIFIED BACKEND SERVER FOR FINCORE APP
// ==========================================

const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// ==========================================
// DATABASE CONFIGURATION
// ==========================================

const sequelize = new Sequelize(
  process.env.DB_NAME || 'DBMS',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  }
);

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Connected to MySQL database successfully.');
    return true;
  } catch (error) {
    console.error('✗ Unable to connect to MySQL database:', error.message);
    return false;
  }
};

// ==========================================
// USER MODEL
// ==========================================

class User extends Model {
  // Method to check password
  comparePassword(password) {
    return bcrypt.compareSync(password, this.password);
  }
}

User.init({
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ==========================================
// ROUTES
// ==========================================

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend server is working!',
    timestamp: new Date().toISOString()
  });
});

// Signup route
app.post('/api/auth/signup', async (req, res) => {
  try {
    console.log('Received signup request:', { ...req.body, password: '***' });
    const { username, email, phone, password } = req.body;

    // Validate required fields
    if (!username || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    
    if (existingUser) {
      return res.status(400).json({ error: 'This email is already registered' });
    }

    // Check if phone number already exists
    const existingPhone = await User.findOne({ where: { phone } });
    
    if (existingPhone) {
      return res.status(400).json({ error: 'This phone number is already registered' });
    }

    // Create new user
    const user = await User.create({ username, email, phone, password });
    console.log('✓ User created successfully:', user.email);

    res.status(201).json({ 
      message: 'User registered successfully',
      user: { 
        username: user.username, 
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('✗ Signup error:', error.message);
    res.status(500).json({ error: 'Error registering user' });
  }
});

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Received login request:', { email: req.body.email, password: '***' });
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return res.status(401).json({ error: 'No account found with this email' });
    }

    // Check password
    const isMatch = user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('✓ Login successful for:', user.email);

    res.json({ 
      message: 'Login successful', 
      user: { 
        username: user.username, 
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('✗ Login error:', error.message);
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Check email availability
app.post('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const existingUser = await User.findOne({ where: { email } });
    res.json({ isAvailable: !existingUser });
  } catch (error) {
    console.error('✗ Check-email error:', error.message);
    res.status(500).json({ error: 'Error checking email' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==========================================
// SERVER INITIALIZATION
// ==========================================

const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.log('⚠ Warning: Database connection failed. Server starting anyway...');
    }

    // Sync database (creates tables if they don't exist)
    await sequelize.sync({ 
      alter: process.env.NODE_ENV === 'development',
      force: false // Change to true to drop and recreate tables (USE CAREFULLY!)
    });
    console.log('✓ Database synchronized successfully');

    // Get local IP address
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIP = 'localhost';
    
    Object.keys(networkInterfaces).forEach((interfaceName) => {
      networkInterfaces[interfaceName].forEach((iface) => {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address;
        }
      });
    });

    // Start server
    app.listen(port, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 FINCORE BACKEND SERVER STARTED');
      console.log('='.repeat(50));
      console.log(`📍 Local:    http://localhost:${port}`);
      console.log(`📍 Network:  http://${localIP}:${port}`);
      console.log(`📍 API Base: http://${localIP}:${port}/api`);
      console.log('='.repeat(50));
      console.log('Available endpoints:');
      console.log(`  GET  /api/test`);
      console.log(`  POST /api/auth/signup`);
      console.log(`  POST /api/auth/login`);
      console.log(`  POST /api/auth/check-email`);
      console.log('='.repeat(50));
      console.log('Press Ctrl+C to stop the server\n');
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down gracefully...');
  await sequelize.close();
  console.log('Database connection closed.');
  process.exit(0);
});