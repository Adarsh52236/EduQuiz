const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// JWT signing — set JWT_SECRET in .env (no default to avoid committing secrets)
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ message: 'Authentication token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// User registration (Signup)
router.post('/signup', async (req, res) => {
  const { email, password, role, displayName } = req.body;

  // Input Validation
  if (!email || !password || !role || !displayName) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  // Email validation
  const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  
  // Email length validation
  if (email.length > 255) {
    return res.status(400).json({ message: 'Email is too long' });
  }
  
  // Password validation
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }
  if (password.length > 128) {
    return res.status(400).json({ message: 'Password is too long' });
  }
  
  // Display name validation
  if (displayName.trim().length < 2) {
    return res.status(400).json({ message: 'Display name must be at least 2 characters long' });
  }
  if (displayName.length > 255) {
    return res.status(400).json({ message: 'Display name is too long' });
  }
  
  // Role validation
  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified. Must be student or teacher.' });
  }

  try {
    // Check if user already exists
    const [existingUsers] = await db.pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'User with that email already exists' });
    }

    // Hash password with salt rounds of 12 for better security
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    // Insert new user
    await db.pool.query(
      'INSERT INTO users (id, email, password, role, displayName) VALUES (?, ?, ?, ?, ?)',
      [userId, email.toLowerCase().trim(), hashedPassword, role, displayName.trim()]
    );

    res.status(201).json({ 
      message: 'User created successfully',
      userId: userId 
    });
  } catch (error) {
    console.error('Error during signup:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'User with that email already exists' });
    }
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// User login (Signin)
router.post('/signin', async (req, res) => {
  const { email, password, role } = req.body;

  // Input Validation
  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Email, password, and role are required' });
  }
  
  // Role validation
  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  // Email validation
  const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    // Find user by email (case insensitive)
    const [users] = await db.pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    const user = users[0];

    // Log roles for debugging
    console.log('Login Attempt:');
    console.log('  - Email:', email);
    console.log('  - Role from request:', role);
    console.log('  - User found in DB:', !!user);
    if (user) {
      console.log('  - Role from DB:', user.role);
      console.log('  - Role comparison (user.role !== role):', user.role !== role);
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Role verification
    //
    // Industry-standard security practice is to avoid revealing whether an account exists
    // (or what role it is) when authentication fails, to reduce account enumeration.
    // Treat role mismatch as a generic auth failure.
    if (user.role !== role) {
      console.log(`Role mismatch for ${email}: Expected '${role}', but found '${user.role}'.`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Create JWT token with extended expiration time (7 days)
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        displayName: user.displayName 
      },
      JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days for better user experience
    );

    // Return success response with user data (excluding password)
    const { password: _, ...safeUser } = user;
    
    res.status(200).json({ 
      message: 'Signed in successfully', 
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Error during signin:', error);
    res.status(500).json({ message: 'Server error during signin' });
  }
});

// Get authenticated user details
router.get('/me', authenticateToken, (req, res) => {
  // req.user is set by the authenticateToken middleware
  // Ensure sensitive data like password is not sent
  const { password, ...safeUser } = req.user;
  res.status(200).json({ user: safeUser });
});

// User logout (Signout)
router.post('/signout', authenticateToken, async (req, res) => {
  try {
    // In a more advanced setup, you might want to blacklist the token
    // For now, we'll just return a success message
    res.status(200).json({ message: 'Signed out successfully' });
  } catch (error) {
    console.error('Error during signout:', error);
    res.status(500).json({ message: 'Server error during signout' });
  }
});

module.exports = { router, authenticateToken };