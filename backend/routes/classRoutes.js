const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('./authRoutes'); // Import authenticateToken

// Get classes based on user role (protected route)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    let query = '';
    let params = [];

    if (userRole === 'teacher') {
      query = `
        SELECT 
          c.id, c.name, c.description, c.classCode, c.createdAt, c.updatedAt,
          u.displayName as teacherName, u.id as teacherId
        FROM classes c
        JOIN users u ON c.teacherId = u.id
        WHERE c.teacherId = ?
      `;
      params = [userId];
    } else if (userRole === 'student') {
      query = `
        SELECT 
          c.id, c.name, c.description, c.classCode, c.createdAt, c.updatedAt,
          u.displayName as teacherName, u.id as teacherId
        FROM classes c
        JOIN users u ON c.teacherId = u.id
        JOIN class_enrollments ce ON c.id = ce.classId
        WHERE ce.studentId = ?
      `;
      params = [userId];
    } else {
      return res.status(403).json({ message: 'Access denied: Invalid user role' });
    }

    const [rows] = await db.pool.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Server error fetching classes' });
  }
});

// Create a new class (protected route)
router.post('/', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  const teacherId = req.user.id; // Get teacherId from authenticated user
  const id = uuidv4();
  const classCode = Math.random().toString(36).substring(2, 10).toUpperCase(); // Generate a random class code

  if (!name) {
    return res.status(400).json({ message: 'Class name is required' });
  }

  try {
    await db.pool.query(
      'INSERT INTO classes (id, name, description, classCode, teacherId) VALUES (?, ?, ?, ?, ?)',
      [id, name, description, classCode, teacherId]
    );
    res.status(201).json({ id, name, description, classCode, teacherId });
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ message: 'Server error creating class' });
  }
});

// Delete a class (protected route)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.id; // Get teacherId from authenticated user

  try {
    // First, check if the class exists and belongs to the authenticated teacher
    const [classes] = await db.pool.query(
      'SELECT id FROM classes WHERE id = ? AND teacherId = ?',
      [id, teacherId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ message: 'Class not found or you do not have permission to delete it' });
    }

    // Delete the class
    await db.pool.query('DELETE FROM classes WHERE id = ?', [id]);
    res.status(200).json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ message: 'Server error deleting class' });
  }
});

// Update a class (protected route)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const teacherId = req.user.id; // Get teacherId from authenticated user

  if (!name) {
    return res.status(400).json({ message: 'Class name is required' });
  }

  try {
    // First, check if the class exists and belongs to the authenticated teacher
    const [classes] = await db.pool.query(
      'SELECT id FROM classes WHERE id = ? AND teacherId = ?',
      [id, teacherId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ message: 'Class not found or you do not have permission to edit it' });
    }

    // Update the class
    await db.pool.query(
      'UPDATE classes SET name = ?, description = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description || null, id]
    );
    res.status(200).json({ message: 'Class updated successfully', id, name, description });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ message: 'Server error updating class' });
  }
});

// Get enrollments for a class (protected route)
router.get('/:classId/enrollments', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user.id; // Get teacherId from authenticated user

  try {
    // First, verify that the authenticated user is the teacher of this class
    const [classRows] = await db.pool.query(
      'SELECT id FROM classes WHERE id = ? AND teacherId = ?',
      [classId, teacherId]
    );

    if (classRows.length === 0) {
      return res.status(403).json({ message: 'Access denied: You are not the teacher of this class' });
    }

    // Fetch enrollments with student details and count
    const [enrollments] = await db.pool.query(`
      SELECT ce.id, ce.enrolledAt, u.id as studentId, u.displayName as studentName, u.email as studentEmail
      FROM class_enrollments ce
      JOIN users u ON ce.studentId = u.id
      WHERE ce.classId = ?
    `, [classId]);

    const [countResult] = await db.pool.query(
      'SELECT COUNT(*) as totalStudents FROM class_enrollments WHERE classId = ?',
      [classId]
    );
    const totalStudents = countResult[0].totalStudents;

    res.status(200).json({ enrollments, totalStudents });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ message: 'Server error fetching enrollments' });
  }
});

// Enroll a student in a class (protected route)
router.post('/:classId/enrollments', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const studentId = req.user.id; // Get studentId from authenticated user
  const id = uuidv4();

  // Ensure the authenticated user is a student
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Only students can enroll in classes' });
  }

  try {
    // Check if the class exists
    const [classRows] = await db.pool.query('SELECT id FROM classes WHERE id = ?', [classId]);
    if (classRows.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Check if the student is already enrolled
    const [enrollmentRows] = await db.pool.query(
      'SELECT id FROM class_enrollments WHERE classId = ? AND studentId = ?',
      [classId, studentId]
    );
    if (enrollmentRows.length > 0) {
      return res.status(409).json({ message: 'Student already enrolled in this class' });
    }

    // Insert new enrollment
    await db.pool.query(
      'INSERT INTO class_enrollments (id, classId, studentId) VALUES (?, ?, ?)',
      [id, classId, studentId]
    );
    res.status(201).json({ id, classId, studentId, message: 'Enrolled successfully' });
  } catch (error) {
    console.error('Error enrolling student:', error);
    res.status(500).json({ message: 'Server error enrolling student' });
  }
});

// Delete an enrollment (protected route)
router.delete('/enrollments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id; // Get userId from authenticated user
  const userRole = req.user.role; // Get userRole from authenticated user

  try {
    // Fetch the enrollment to check ownership/permissions
    const [enrollmentRows] = await db.pool.query(
      'SELECT ce.studentId, c.teacherId FROM class_enrollments ce JOIN classes c ON ce.classId = c.id WHERE ce.id = ?',
      [id]
    );

    if (enrollmentRows.length === 0) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    const enrollment = enrollmentRows[0];

    // Check if the authenticated user is the student or the teacher of the class
    if (enrollment.studentId !== userId && enrollment.teacherId !== userId) {
      return res.status(403).json({ message: 'Access denied: You do not have permission to delete this enrollment' });
    }

    // Delete the enrollment
    await db.pool.query('DELETE FROM class_enrollments WHERE id = ?', [id]);
    res.status(200).json({ message: 'Enrollment deleted successfully' });
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    res.status(500).json({ message: 'Server error deleting enrollment' });
  }
});

// Student leaves a class (protected route)
router.delete('/:classId/enrollments/leave', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const studentId = req.user.id; // Get studentId from authenticated user

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Only students can leave classes' });
  }

  try {
    // Check if the student is actually enrolled in the class
    const [enrollmentRows] = await db.pool.query(
      'SELECT id FROM class_enrollments WHERE classId = ? AND studentId = ?',
      [classId, studentId]
    );

    if (enrollmentRows.length === 0) {
      return res.status(404).json({ message: 'You are not enrolled in this class' });
    }

    // Delete the enrollment
    await db.pool.query(
      'DELETE FROM class_enrollments WHERE classId = ? AND studentId = ?',
      [classId, studentId]
    );
    res.status(200).json({ message: 'Successfully left the class' });
  } catch (error) {
    console.error('Error leaving class:', error);
    res.status(500).json({ message: 'Server error leaving class' });
  }
});

module.exports = router;