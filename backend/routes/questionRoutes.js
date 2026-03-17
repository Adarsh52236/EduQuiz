const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('./authRoutes');

// Get all questions for a quiz (protected route)
router.get('/quiz/:quizId', authenticateToken, async (req, res) => {
  const { quizId } = req.params;
  
  try {
    const [questions] = await db.pool.query(
      'SELECT * FROM quiz_questions WHERE quizId = ? ORDER BY orderIndex ASC',
      [quizId]
    );
    res.status(200).json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ message: 'Server error fetching questions' });
  }
});

// Create a new question (protected route - teachers only)
router.post('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied: Only teachers can create questions' });
  }

  const { quizId, questionText, questionType, points, orderIndex, options, correctAnswer } = req.body;
  const id = uuidv4();

  if (!quizId || !questionText || !questionType || !correctAnswer) {
    return res.status(400).json({ message: 'Quiz ID, question text, type, and correct answer are required' });
  }

  if (!['multiple-choice', 'true-false', 'short-answer'].includes(questionType)) {
    return res.status(400).json({ message: 'Invalid question type' });
  }

  try {
    // Verify the quiz belongs to the teacher
    const [quizzes] = await db.pool.query(
      'SELECT id FROM quizzes WHERE id = ? AND teacherId = ?',
      [quizId, req.user.id]
    );

    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found or you do not have permission' });
    }

    await db.pool.query(
      `INSERT INTO quiz_questions 
        (id, quizId, questionText, questionType, points, orderIndex, options, correctAnswer) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, quizId, questionText, questionType, points || 1, orderIndex || 0, options, correctAnswer]
    );

    res.status(201).json({ 
      id, quizId, questionText, questionType, points, orderIndex, options, correctAnswer 
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ message: 'Server error creating question' });
  }
});

// Update a question (protected route - teachers only)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied: Only teachers can update questions' });
  }

  const { questionText, questionType, points, orderIndex, options, correctAnswer } = req.body;

  try {
    // Verify the question belongs to a quiz owned by the teacher
    const [questions] = await db.pool.query(`
      SELECT qq.id FROM quiz_questions qq
      JOIN quizzes q ON qq.quizId = q.id
      WHERE qq.id = ? AND q.teacherId = ?
    `, [id, req.user.id]);

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Question not found or you do not have permission' });
    }

    const updateFields = [];
    const updateValues = [];

    if (questionText !== undefined) { updateFields.push('questionText = ?'); updateValues.push(questionText); }
    if (questionType !== undefined) { updateFields.push('questionType = ?'); updateValues.push(questionType); }
    if (points !== undefined) { updateFields.push('points = ?'); updateValues.push(points); }
    if (orderIndex !== undefined) { updateFields.push('orderIndex = ?'); updateValues.push(orderIndex); }
    if (options !== undefined) { updateFields.push('options = ?'); updateValues.push(options); }
    if (correctAnswer !== undefined) { updateFields.push('correctAnswer = ?'); updateValues.push(correctAnswer); }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateValues.push(id);
    await db.pool.query(
      `UPDATE quiz_questions SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.status(200).json({ message: 'Question updated successfully' });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ message: 'Server error updating question' });
  }
});

// Delete a question (protected route - teachers only)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied: Only teachers can delete questions' });
  }

  try {
    // Verify the question belongs to a quiz owned by the teacher
    const [questions] = await db.pool.query(`
      SELECT qq.id FROM quiz_questions qq
      JOIN quizzes q ON qq.quizId = q.id
      WHERE qq.id = ? AND q.teacherId = ?
    `, [id, req.user.id]);

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Question not found or you do not have permission' });
    }

    await db.pool.query('DELETE FROM quiz_questions WHERE id = ?', [id]);
    res.status(200).json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ message: 'Server error deleting question' });
  }
});

module.exports = router;
