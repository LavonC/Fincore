const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register route
router.post('/signup', async (req, res) => {
  try {
    console.log('Received signup request:', req.body);
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    console.log('Existing user check:', existingUser);
    
    if (existingUser) {
      return res.status(400).json({ error: 'This email is already registered' });
    }

    // Create new user
    const user = await User.create({ username, email, password });
    console.log('User created successfully:', user);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    console.log('Received login request:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      return res.status(401).json({ error: 'No account found with this email' });
    }

    // Check password
    const isMatch = user.comparePassword(password);
    console.log('Password match:', isMatch ? 'Yes' : 'No');
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ 
      message: 'Login successful', 
      user: { username: user.username, email: user.email } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Check email availability
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    const existingUser = await User.findOne({ where: { email } });
    res.json({ isAvailable: !existingUser });
  } catch (error) {
    console.error('Check-email error:', error);
    res.status(500).json({ error: 'Error checking email' });
  }
});

module.exports = router;