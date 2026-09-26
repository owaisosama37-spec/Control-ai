import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = new User({
      user_id: `USR-${uuidv4().substring(0, 8).toUpperCase()}`,
      email,
      password,
      full_name,
      role: role || 'senior_developer',
      status: 'active'
    });

    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        user_id: user.user_id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.last_login = new Date();
    user.login_count = (user.login_count || 0) + 1;
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Verify token
router.post('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    res.json({
      success: true,
      valid: true,
      user: decoded
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Refresh token
router.post('/refresh', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key',
      { ignoreExpiration: true }
    );

    const newToken = jwt.sign(
      {
        id: decoded.id,
        user_id: decoded.user_id,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
