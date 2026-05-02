const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateInternalUsername() {
  return `user_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    location: user.location,
    role: user.role,
    createdAt: user.created_at
  };
}

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Keep compatibility with current schema where username is required.
    const internalUsername = generateInternalUsername();

    // Insert user
    const result = await db.query(
      'INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, first_name, last_name, location, role, created_at',
      [internalUsername, passwordHash, email, 'user']
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user
    const result = await db.query(
      'SELECT id, username, password_hash, email, first_name, last_name, location, role, created_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, first_name, last_name, location, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({ user: serializeUser(user) });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Logout (client-side only, invalidate token on client)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;
