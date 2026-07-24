const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./authRoutes');

// GET /api/practice/questions
// Fetches questions from public quizzes for the LeetCode-style Practice Hub
router.get('/questions', authenticateToken, async (req, res) => {
  try {
    const { tags, difficulty, limit = 20 } = req.query;
    
    // Base query to fetch public questions
    let query = `
      SELECT q.id, q.questionText, q.questionType, q.points, q.difficulty, q.options, q.createdAt,
             qz.title as sourceQuizTitle, qz.tags
      FROM quiz_questions q
      JOIN quizzes qz ON q.quizId = qz.id
      WHERE qz.visibility = 'public'
    `;
    const params = [];

    // Filter by difficulty
    if (difficulty) {
      query += ` AND q.difficulty = ?`;
      params.push(difficulty);
    }

    // Filter by tags (PostgreSQL JSONB contains operator)
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      query += ` AND qz.tags::text ILIKE ?`;
      params.push(`%${tagArray[0]}%`); // Simplified for single tag search for now
    }

    // Order randomly for practice feel, limit results
    query += ` ORDER BY RANDOM() LIMIT ?`;
    params.push(parseInt(limit, 10));

    const [questions] = await db.pool.query(query, params);

    res.status(200).json(questions);
  } catch (error) {
    console.error('Error fetching practice questions:', error);
    res.status(500).json({ message: 'Error fetching practice questions' });
  }
});

// POST /api/practice/submit
// Evaluates a practice answer and awards Global XP
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { questionId, answer } = req.body;
    const userId = req.user.id;

    if (!questionId || !answer) {
      return res.status(400).json({ message: 'Question ID and answer are required' });
    }

    // Fetch the correct answer and difficulty
    const [questions] = await db.pool.query(
      'SELECT correctAnswer, difficulty, points FROM quiz_questions WHERE id = ?',
      [questionId]
    );

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const question = questions[0];
    
    // Evaluate (Exact match for non-AI questions)
    const isCorrect = question.correctAnswer.toLowerCase().trim() === answer.toLowerCase().trim();

    // Calculate XP gain based on difficulty
    let xpGain = 0;
    if (isCorrect) {
      xpGain = question.points;
      if (question.difficulty === 'hard') xpGain += 50;
      if (question.difficulty === 'medium') xpGain += 20;

      // Update the user's global XP
      await db.pool.query(
        'UPDATE users SET globalXp = globalXp + ? WHERE id = ?',
        [xpGain, userId]
      );
    }

    res.status(200).json({
      isCorrect,
      xpGained: xpGain,
      correctAnswer: isCorrect ? null : question.correctAnswer 
    });

  } catch (error) {
    console.error('Error submitting practice answer:', error);
    res.status(500).json({ message: 'Error submitting answer' });
  }
});

module.exports = router;
