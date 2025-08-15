const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sequelize, testConnection } = require('./config/database');
const User = require('./models/User');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize database
const initializeDatabase = async () => {
  try {
    await testConnection();
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    // The server will continue running even if database connection fails
  }
};

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');

// Add a test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend server is working!' });
});

// Use routes
app.use('/api/auth', authRoutes);

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});

// Sync database and start server
const startServer = async () => {
  try {
    await sequelize.sync({ force: true }); // Use { force: true } for development to drop and recreate tables
    console.log('Database synced!');
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port}`);
      console.log(`Server is accessible at http://192.168.1.3:${port}`);
      console.log('Press Ctrl+C to quit.');
    });
  } catch (error) {
    console.error('Unable to sync database:', error);
  }
};

startServer();