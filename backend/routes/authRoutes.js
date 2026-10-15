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
  
  // Password validation (Enterprise grade: min 8 chars, 1 uppercase, 1 lowercase, 1 number)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.' });
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
    // Check if user already exists (case-insensitive)
    const [existingUsers] = await db.pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );
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
    if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
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

// Forgot Password Request (Generates Token)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const [users] = await db.pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    const user = users[0];

    if (!user) {
      // Return 200 to prevent email enumeration attacks
      return res.status(200).json({ message: 'If an account exists, a password reset link has been sent.' });
    }

    // Generate a secure reset token
    const resetToken = uuidv4();
    // Expiration time: 1 hour from now
    const tokenExpiry = new Date(Date.now() + 3600000).toISOString(); 

    // Update user record with token and expiry
    await db.pool.query(
      'UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE id = ?',
      [resetToken, tokenExpiry, user.id]
    );

    // MOCK EMAIL SENDING
    console.log('\n=======================================');
    console.log(`📧 MOCK EMAIL SENT TO: ${user.email}`);
    console.log(`🔗 Reset Link: http://localhost:5173/reset-password?token=${resetToken}`);
    console.log('=======================================\n');

    res.status(200).json({ message: 'If an account exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ message: 'Server error during password reset request' });
  }
});

// Reset Password (Verifies Token and Updates Password)
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }

  // Strict Password Validation
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.' });
  }

  try {
    const [users] = await db.pool.query(
      'SELECT id, resetTokenExpiry FROM users WHERE resetToken = ?',
      [token]
    );
    const user = users[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Check if token has expired
    const now = new Date();
    const expiry = new Date(user.resetTokenExpiry);
    
    if (now > expiry) {
      return res.status(400).json({ message: 'Reset token has expired. Please request a new one.' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token
    await db.pool.query(
      'UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    res.status(200).json({ message: 'Password has been reset successfully. You can now login.' });
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
});

module.exports = { router, authenticateToken };