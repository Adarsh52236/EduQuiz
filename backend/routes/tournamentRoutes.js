const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('./authRoutes');

// 1. Get Tournaments (Teacher sees tournaments they created/are involved in; Student sees tournaments for their enrolled classes)
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let tournaments = [];
    if (userRole === 'teacher') {
      const [rows] = await db.pool.query(
        `SELECT 
           t.id, t.title, t.description, t.quizId, t.creatorTeacherId, t.startTime, t.endTime, t.status, t.createdAt,
           q.title as quizTitle,
           u.displayName as creatorName,
           COUNT(DISTINCT tc.classId) as classCount
         FROM tournaments t
         JOIN quizzes q ON t.quizId = q.id
         JOIN users u ON t.creatorTeacherId = u.id
         LEFT JOIN tournament_classes tc ON t.id = tc.tournamentId
         GROUP BY t.id, t.title, t.description, t.quizId, t.creatorTeacherId, t.startTime, t.endTime, t.status, t.createdAt, q.title, u.displayName
         ORDER BY t.createdAt DESC`
      );
      tournaments = rows;
    } else {
      // Student: Tournaments matching any of the classes the student is enrolled in
      const [rows] = await db.pool.query(
        `SELECT DISTINCT
           t.id, t.title, t.description, t.quizId, t.creatorTeacherId, t.startTime, t.endTime, t.status, t.createdAt,
           q.title as quizTitle,
           u.displayName as creatorName
         FROM tournaments t
         JOIN quizzes q ON t.quizId = q.id
         JOIN users u ON t.creatorTeacherId = u.id
         JOIN tournament_classes tc ON t.id = tc.tournamentId
         JOIN class_enrollments ce ON tc.classId = ce.classId
         WHERE ce.studentId = ?
         ORDER BY t.createdAt DESC`,
        [userId]
      );
      tournaments = rows;
    }

    res.status(200).json(tournaments);
  } catch (error) {
    console.error('[Tournaments] Error fetching tournaments:', error);
    res.status(500).json({ message: 'Failed to load tournaments' });
  }
});

// 2. Create an Inter-Class Tournament (Teachers only)
router.post('/', authenticateToken, async (req, res) => {
  const teacherId = req.user.id;
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can create tournaments' });
  }

  const { title, description, quizId, classIds, startTime, endTime } = req.body;

  if (!title || !quizId || !Array.isArray(classIds) || classIds.length < 1) {
    return res.status(400).json({ message: 'Title, Quiz ID, and at least 1 participating class are required' });
  }

  try {
    const tournamentId = uuidv4();

    await db.pool.query(
      `INSERT INTO tournaments (id, title, description, quizId, creatorTeacherId, startTime, endTime, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [tournamentId, title, description || '', quizId, teacherId, startTime || new Date(), endTime || null]
    );

    // Link classes
    for (const classId of classIds) {
      await db.pool.query(
        'INSERT INTO tournament_classes (id, tournamentId, classId) VALUES (?, ?, ?)',
        [uuidv4(), tournamentId, classId]
      );
    }

    res.status(201).json({ message: 'Tournament created successfully', tournamentId });
  } catch (error) {
    console.error('[Tournaments] Error creating tournament:', error);
    res.status(500).json({ message: 'Failed to create tournament' });
  }
});

// 3. Tournament Cross-Class Live Leaderboard
router.get('/:tournamentId/leaderboard', authenticateToken, async (req, res) => {
  const { tournamentId } = req.params;

  try {
    const [tournamentRows] = await db.pool.query(
      'SELECT t.id, t.title, t.quizId, q.title as quizTitle FROM tournaments t JOIN quizzes q ON t.quizId = q.id WHERE t.id = ?',
      [tournamentId]
    );

    if (tournamentRows.length === 0) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const tournament = tournamentRows[0];

    // Fetch scores of students enrolled in any of the participating classes
    const [standings] = await db.pool.query(
      `SELECT 
         u.id as studentId, u.displayName as studentName, u.eloRating,
         c.name as className,
         MAX(qa.score) as score,
         qa.totalPoints,
         qa.timeTaken,
         qa.submittedAt
       FROM tournament_classes tc
       JOIN classes c ON tc.classId = c.id
       JOIN class_enrollments ce ON c.id = ce.classId
       JOIN users u ON ce.studentId = u.id
       JOIN quiz_attempts qa ON qa.studentId = u.id AND qa.quizId = ? AND qa.isCompleted = TRUE
       WHERE tc.tournamentId = ?
       GROUP BY u.id, u.displayName, u.eloRating, c.name, qa.totalPoints, qa.timeTaken, qa.submittedAt
       ORDER BY score DESC, qa.timeTaken ASC
       LIMIT 50`,
      [tournament.quizId, tournamentId]
    );

    res.status(200).json({
      tournament,
      standings: standings.map((s, idx) => ({ ...s, rank: idx + 1 }))
    });
  } catch (error) {
    console.error('[Tournaments] Error loading leaderboard:', error);
    res.status(500).json({ message: 'Failed to load tournament standings' });
  }
});

module.exports = router;
