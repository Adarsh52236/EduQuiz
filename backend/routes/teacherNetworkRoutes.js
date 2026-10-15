const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('./authRoutes');

// Middleware to ensure user is a teacher
const requireTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied: Only teachers can access teacher network' });
  }
  next();
};

// 1. Get Teacher Colleague Network (Connected colleagues, pending requests, and search)
router.get('/', authenticateToken, requireTeacher, async (req, res) => {
  const teacherId = req.user.id;
  const { search } = req.query;

  try {
    // A. Accepted Colleagues
    const [connections] = await db.pool.query(
      `SELECT 
         tc.id as connectionId, tc.status, tc.createdAt,
         u.id as colleagueId, u.displayName as colleagueName, u.email as colleagueEmail, u.department
       FROM teacher_connections tc
       JOIN users u ON (tc.connectedTeacherId = u.id AND tc.teacherId = ?) 
                    OR (tc.teacherId = u.id AND tc.connectedTeacherId = ?)
       WHERE tc.status = 'accepted' AND u.id != ?`,
      [teacherId, teacherId, teacherId]
    );

    // B. Pending Requests sent to this teacher
    const [incomingRequests] = await db.pool.query(
      `SELECT 
         tc.id as connectionId, tc.createdAt,
         u.id as senderId, u.displayName as senderName, u.email as senderEmail, u.department
       FROM teacher_connections tc
       JOIN users u ON tc.teacherId = u.id
       WHERE tc.connectedTeacherId = ? AND tc.status = 'pending'`,
      [teacherId]
    );

    // C. Search potential colleagues if search query provided
    let discoverTeachers = [];
    if (search && search.trim().length >= 2) {
      const searchParam = `%${search.trim().toLowerCase()}%`;
      const [searchResults] = await db.pool.query(
        `SELECT id, displayName, email, department 
         FROM users 
         WHERE role = 'teacher' AND id != ? 
           AND (LOWER(displayName) LIKE ? OR LOWER(email) LIKE ?)
         LIMIT 10`,
        [teacherId, searchParam, searchParam]
      );
      discoverTeachers = searchResults;
    }

    res.status(200).json({
      colleagues: connections,
      incomingRequests,
      discoverTeachers
    });
  } catch (error) {
    console.error('[TeacherNetwork] Error fetching network:', error);
    res.status(500).json({ message: 'Failed to load teacher network' });
  }
});

// 2. Connect with a Colleague Teacher
router.post('/connect', authenticateToken, requireTeacher, async (req, res) => {
  const teacherId = req.user.id;
  const { colleagueId } = req.body;

  if (!colleagueId || colleagueId === teacherId) {
    return res.status(400).json({ message: 'Invalid colleague specified' });
  }

  try {
    // Verify colleague exists and is teacher
    const [targetRows] = await db.pool.query(
      "SELECT id, displayName FROM users WHERE id = ? AND role = 'teacher'",
      [colleagueId]
    );
    if (targetRows.length === 0) {
      return res.status(404).json({ message: 'Colleague not found' });
    }

    // Check existing connection
    const [existing] = await db.pool.query(
      `SELECT id, status FROM teacher_connections 
       WHERE (teacherId = ? AND connectedTeacherId = ?) OR (teacherId = ? AND connectedTeacherId = ?)`,
      [teacherId, colleagueId, colleagueId, teacherId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: `Connection already ${existing[0].status}` });
    }

    const id = uuidv4();
    await db.pool.query(
      "INSERT INTO teacher_connections (id, teacherId, connectedTeacherId, status) VALUES (?, ?, ?, 'pending')",
      [id, teacherId, colleagueId]
    );

    res.status(201).json({ message: 'Connection request sent successfully', id });
  } catch (error) {
    console.error('[TeacherNetwork] Error sending connection request:', error);
    res.status(500).json({ message: 'Failed to send request' });
  }
});

// 3. Respond to Connection Request (Accept/Reject)
router.put('/respond', authenticateToken, requireTeacher, async (req, res) => {
  const teacherId = req.user.id;
  const { connectionId, action } = req.body;

  if (!['accepted', 'rejected'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action. Must be accepted or rejected' });
  }

  try {
    const [rows] = await db.pool.query(
      'SELECT id FROM teacher_connections WHERE id = ? AND connectedTeacherId = ? AND status = \'pending\'',
      [connectionId, teacherId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Pending request not found' });
    }

    await db.pool.query(
      'UPDATE teacher_connections SET status = ? WHERE id = ?',
      [action, connectionId]
    );

    res.status(200).json({ message: `Connection request ${action}` });
  } catch (error) {
    console.error('[TeacherNetwork] Error responding to request:', error);
    res.status(500).json({ message: 'Failed to update request' });
  }
});

// 4. Share Quiz with a Colleague Teacher
router.post('/quizzes/share', authenticateToken, requireTeacher, async (req, res) => {
  const teacherId = req.user.id;
  const { quizId, colleagueId, canEdit = false } = req.body;

  if (!quizId || !colleagueId) {
    return res.status(400).json({ message: 'Quiz ID and Colleague ID are required' });
  }

  try {
    // Verify ownership of the quiz
    const [quizRows] = await db.pool.query('SELECT id, title FROM quizzes WHERE id = ? AND teacherId = ?', [quizId, teacherId]);
    if (quizRows.length === 0) {
      return res.status(403).json({ message: 'You do not own this quiz' });
    }

    const id = uuidv4();
    await db.pool.query(
      `INSERT INTO shared_quizzes (id, quizId, sharedByTeacherId, sharedWithTeacherId, canEdit)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (quizId, sharedWithTeacherId) DO UPDATE SET canEdit = EXCLUDED.canEdit`,
      [id, quizId, teacherId, colleagueId, canEdit]
    );

    res.status(201).json({ message: `Quiz '${quizRows[0].title}' successfully shared with colleague` });
  } catch (error) {
    console.error('[TeacherNetwork] Error sharing quiz:', error);
    res.status(500).json({ message: 'Failed to share quiz' });
  }
});

// 5. Get Quizzes Shared With Me
router.get('/quizzes/shared-with-me', authenticateToken, requireTeacher, async (req, res) => {
  const teacherId = req.user.id;

  try {
    const [shared] = await db.pool.query(
      `SELECT 
         sq.id as shareId, sq.canEdit, sq.createdAt as sharedAt,
         q.id as quizId, q.title, q.description, q.timeLimit, q.totalPoints,
         u.displayName as sharedByName, u.email as sharedByEmail
       FROM shared_quizzes sq
       JOIN quizzes q ON sq.quizId = q.id
       JOIN users u ON sq.sharedByTeacherId = u.id
       WHERE sq.sharedWithTeacherId = ?`,
      [teacherId]
    );

    res.status(200).json(shared);
  } catch (error) {
    console.error('[TeacherNetwork] Error fetching shared quizzes:', error);
    res.status(500).json({ message: 'Failed to fetch shared quizzes' });
  }
});

// 6. Clone / Import Shared Quiz into Teacher's own library
router.post('/quizzes/clone', authenticateToken, requireTeacher, async (req, res) => {
  const teacherId = req.user.id;
  const { sourceQuizId, targetClassId } = req.body;

  if (!sourceQuizId) {
    return res.status(400).json({ message: 'Source Quiz ID is required' });
  }

  try {
    // Verify the quiz was shared with this teacher or is owned
    const [sharedCheck] = await db.pool.query(
      `SELECT q.title, q.description, q.type, q.timeLimit, q.totalPoints
       FROM quizzes q
       LEFT JOIN shared_quizzes sq ON q.id = sq.quizId
       WHERE q.id = ? AND (q.teacherId = ? OR sq.sharedWithTeacherId = ?)`,
      [sourceQuizId, teacherId, teacherId]
    );

    if (sharedCheck.length === 0) {
      return res.status(403).json({ message: 'Access denied: Quiz has not been shared with you' });
    }

    const sourceQuiz = sharedCheck[0];
    const newQuizId = uuidv4();

    // Create cloned quiz
    await db.pool.query(
      `INSERT INTO quizzes (id, title, description, type, classId, teacherId, timeLimit, totalPoints, isPublished)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [
        newQuizId,
        `Copy of ${sourceQuiz.title}`,
        sourceQuiz.description,
        sourceQuiz.type,
        targetClassId || null,
        teacherId,
        sourceQuiz.timeLimit,
        sourceQuiz.totalPoints
      ]
    );

    // Fetch and copy all questions
    const [questions] = await db.pool.query(
      'SELECT questionText, questionType, points, orderIndex, options, correctAnswer, difficulty FROM quiz_questions WHERE quizId = ?',
      [sourceQuizId]
    );

    for (const q of questions) {
      await db.pool.query(
        `INSERT INTO quiz_questions (id, quizId, questionText, questionType, points, orderIndex, options, correctAnswer, difficulty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          newQuizId,
          q.questionText,
          q.questionType,
          q.points,
          q.orderIndex,
          typeof q.options === 'string' ? q.options : JSON.stringify(q.options),
          q.correctAnswer,
          q.difficulty || 'medium'
        ]
      );
    }

    res.status(201).json({ message: 'Quiz and questions successfully cloned to your library', newQuizId });
  } catch (error) {
    console.error('[TeacherNetwork] Error cloning quiz:', error);
    res.status(500).json({ message: 'Failed to clone quiz' });
  }
});

module.exports = router;
