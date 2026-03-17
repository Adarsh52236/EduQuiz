const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('./authRoutes');

// Get all enrollments for the authenticated user (protected route)
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { classId } = req.query;

  try {
    console.log(`[EnrollmentRoutes] Fetching enrollments for user ${userId}, role: ${userRole}, classId: ${classId}`);
    
    let query = `
      SELECT 
        ce.id, ce.classId, ce.studentId, ce.enrolledAt,
        c.name as className, c.description as classDescription, c.classCode,
        t.displayName as teacherName, t.id as teacherId,
        s.displayName as studentName, s.email as studentEmail
      FROM class_enrollments ce
      JOIN classes c ON ce.classId = c.id
      JOIN users t ON c.teacherId = t.id
      JOIN users s ON ce.studentId = s.id
    `;
    const queryParams = [];
    const conditions = [];

    if (userRole === 'student') {
      conditions.push('ce.studentId = ?');
      queryParams.push(userId);
    } else if (userRole === 'teacher') {
      // Teachers can only see enrollments for their own classes
      conditions.push('c.teacherId = ?');
      queryParams.push(userId);
    }

    // Add classId filter if provided
    if (classId) {
      conditions.push('ce.classId = ?');
      queryParams.push(classId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const [rows] = await db.pool.query(query, queryParams);
    console.log(`[EnrollmentRoutes] Found ${rows.length} enrollments`);
    res.status(200).json(rows);
  } catch (error) {
    console.error('[EnrollmentRoutes] Error fetching enrollments:', error);
    res.status(500).json({ message: 'Server error fetching enrollments' });
  }
});

// Create a new enrollment (protected route)
router.post('/', authenticateToken, async (req, res) => {
  const studentId = req.user.id;
  const { classId } = req.body;
  const id = uuidv4();

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can enroll in classes' });
  }

  if (!classId) {
    return res.status(400).json({ message: 'Class ID is required for enrollment' });
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
router.delete('/:id', authenticateToken, async (req, res) => {
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

// Enroll a student in a class using a class code (protected route)
router.post('/enroll-by-code', authenticateToken, async (req, res) => {
  const studentId = req.user.id;
  const { classCode } = req.body;
  const id = uuidv4();

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can enroll in classes' });
  }

  if (!classCode) {
    return res.status(400).json({ message: 'Class code is required for enrollment' });
  }

  try {
    // Find the classId using the classCode
    const [classRows] = await db.pool.query('SELECT id FROM classes WHERE classCode = ?', [classCode]);
    if (classRows.length === 0) {
      return res.status(404).json({ message: 'Class not found with the provided code' });
    }
    const classId = classRows[0].id;

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
    console.error('Error enrolling student by code:', error);
    res.status(500).json({ message: 'Server error enrolling student by code' });
  }
});

module.exports = router;