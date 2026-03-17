const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('./authRoutes'); // Import authenticateToken

// Get all users (can be filtered by role) - Protected route
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('[UserRoutes] Fetching users, role filter:', req.query.role);
    let query = 'SELECT id, email, displayName, role, avatar, bio, department, grade, phone, address, dateOfBirth, createdAt, updatedAt FROM users';
    const queryParams = [];

    if (req.query.role) {
      query += ' WHERE role = ?';
      queryParams.push(req.query.role);
    }

    const [users] = await pool.query(query, queryParams);
    console.log(`[UserRoutes] Found ${users.length} users`);
    res.status(200).json(users);
  } catch (error) {
    console.error('[UserRoutes] Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// Get a single user by ID - Protected route
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const [users] = await pool.query(
      'SELECT id, email, displayName, role, avatar, bio, department, grade, phone, address, dateOfBirth, createdAt, updatedAt FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // Students can view other students' profiles, teachers can view anyone
    if (userRole === 'student' && user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied: Students can only view other students' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('[UserRoutes] Error fetching user:', error);
    res.status(500).json({ message: 'Server error fetching user' });
  }
});

// Update a user - Protected route (users can only update their own profile)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { displayName, bio, avatar, department, phone, address, grade, dateOfBirth } = req.body;

    // Users can only update their own profile
    if (id !== userId) {
      return res.status(403).json({ message: 'Access denied: You can only update your own profile' });
    }

    const updateFields = [];
    const updateValues = [];

    if (displayName !== undefined) {
      updateFields.push('displayName = ?');
      updateValues.push(displayName.trim());
    }
    if (bio !== undefined) {
      updateFields.push('bio = ?');
      updateValues.push(bio);
    }
    if (avatar !== undefined) {
      updateFields.push('avatar = ?');
      updateValues.push(avatar);
    }
    if (department !== undefined) {
      updateFields.push('department = ?');
      updateValues.push(department);
    }
    if (grade !== undefined) {
      updateFields.push('grade = ?');
      updateValues.push(grade);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address);
    }
    if (dateOfBirth !== undefined) {
      updateFields.push('dateOfBirth = ?');
      updateValues.push(dateOfBirth || null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields provided for update' });
    }

    updateFields.push('updatedAt = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.query(updateQuery, updateValues);

    // Fetch updated user
    const [updatedUsers] = await pool.query(
      'SELECT id, email, displayName, role, avatar, bio, department, grade, phone, address, dateOfBirth, createdAt, updatedAt FROM users WHERE id = ?',
      [id]
    );

    res.status(200).json(updatedUsers[0]);
  } catch (error) {
    console.error('[UserRoutes] Error updating user:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
});

module.exports = router;
