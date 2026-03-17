const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./authRoutes');

// Get answers (filtered by attemptId or questionId)
router.get('/', authenticateToken, async (req, res) => {
  const { attemptId, questionId } = req.query;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let query = `
      SELECT qa.* 
      FROM quiz_answers qa
      JOIN quiz_attempts qatt ON qa.attemptId = qatt.id
      WHERE 1=1
    `;
    const queryParams = [];

    // Students can only see their own answers
    if (userRole === 'student') {
      query += ' AND qatt.studentId = ?';
      queryParams.push(userId);
    } else if (userRole === 'teacher') {
      // Teachers can see answers for quizzes they own
      query += `
        AND EXISTS (
          SELECT 1 FROM quizzes q 
          WHERE q.id = qatt.quizId AND q.teacherId = ?
        )
      `;
      queryParams.push(userId);
    }

    if (attemptId) {
      query += ' AND qa.attemptId = ?';
      queryParams.push(attemptId);
    }

    if (questionId) {
      query += ' AND qa.questionId = ?';
      queryParams.push(questionId);
    }

    const [rows] = await db.pool.query(query, queryParams);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching answers:', error);
    res.status(500).json({ message: 'Server error fetching answers' });
  }
});

// Create a new quiz answer (should only be called from attempt submission)
router.post('/', authenticateToken, async (req, res) => {
  const { id, attemptId, questionId, answer, isCorrect, pointsEarned } = req.body;
  
  try {
    // Verify the attempt belongs to the user
    if (req.user.role === 'student') {
      const [attemptRows] = await db.pool.query(
        'SELECT studentId FROM quiz_attempts WHERE id = ?',
        [attemptId]
      );
      if (attemptRows.length === 0 || attemptRows[0].studentId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    await db.pool.query(
      'INSERT INTO quiz_answers (id, attemptId, questionId, answer, isCorrect, pointsEarned) VALUES (?, ?, ?, ?, ?, ?)',
      [id, attemptId, questionId, answer, isCorrect, pointsEarned]
    );
    res.status(201).json({ id, attemptId, questionId, answer, isCorrect, pointsEarned });
  } catch (error) {
    console.error('Error creating answer:', error);
    res.status(500).json({ message: 'Server error creating answer' });
  }
});

module.exports = router;
