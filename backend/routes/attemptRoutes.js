const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('./authRoutes');
const { createNotification, sendRealTimeNotification } = require('./notificationRoutes');

// Get all quiz attempts (protected route, can be filtered by studentId, quizId, isCompleted)
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { studentId, quizId, isCompleted } = req.query;

  try {
    let query = `
      SELECT 
        qa.id, qa.quizId, qa.studentId, qa.startedAt, qa.submittedAt, qa.score, qa.totalPoints, 
        qa.timeTaken, qa.isCompleted,
        q.title as quizTitle, q.description as quizDescription,
        u.displayName as studentName
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quizId = q.id
      JOIN users u ON qa.studentId = u.id
    `;
    const queryParams = [];
    const conditions = [];

    if (userRole === 'student') {
      conditions.push('qa.studentId = ?');
      queryParams.push(userId);
    } else if (userRole === 'teacher') {
      // Teachers can only see attempts for quizzes they own
      conditions.push('q.teacherId = ?');
      queryParams.push(userId);
    }

    if (studentId) {
      conditions.push('qa.studentId = ?');
      queryParams.push(studentId);
    }
    if (quizId) {
      conditions.push('qa.quizId = ?');
      queryParams.push(quizId);
    }
    if (isCompleted !== undefined) {
      conditions.push('qa.isCompleted = ?');
      queryParams.push(isCompleted === 'true' ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const [rows] = await db.pool.query(query, queryParams);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching quiz attempts:', error);
    res.status(500).json({ message: 'Server error fetching quiz attempts' });
  }
});

// Create a new quiz attempt (protected route)
router.post('/', authenticateToken, async (req, res) => {
  const studentId = req.user.id;
  const { quizId } = req.body;
  const id = uuidv4();

  console.log(`[AttemptRoutes] Creating attempt - quizId: ${quizId}, studentId: ${studentId}`);

  if (req.user.role !== 'student') {
    console.log(`[AttemptRoutes] Access denied: User role is ${req.user.role}, not student`);
    return res.status(403).json({ message: 'Access denied: Only students can start quiz attempts' });
  }

  if (!quizId) {
    console.log(`[AttemptRoutes] Missing quizId in request body`);
    return res.status(400).json({ message: 'Quiz ID is required to start an attempt' });
  }

  try {
    // Step 1: Check if quiz exists and is published
    const [quizRows] = await db.pool.query(
      'SELECT id, classId, startTime, endTime, isPublished FROM quizzes WHERE id = ?',
      [quizId]
    );
    
    if (quizRows.length === 0) {
      console.log(`[AttemptRoutes] Quiz not found: ${quizId}`);
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    const quiz = quizRows[0];
    console.log(`[AttemptRoutes] Quiz found:`, quiz);

    // Step 2: Check if quiz is published
    if (!quiz.isPublished) {
      console.log(`[AttemptRoutes] Quiz not published: ${quizId}`);
      return res.status(403).json({ message: 'Quiz is not published yet' });
    }

    // Step 3: Check if quiz is assigned to a class
    if (!quiz.classId) {
      console.log(`[AttemptRoutes] Quiz not assigned to class: ${quizId}`);
      return res.status(403).json({ message: 'Quiz is not assigned to a class' });
    }

    // Step 4: Check if student is enrolled in the class
    const [enrollmentRows] = await db.pool.query(
      'SELECT id FROM class_enrollments WHERE classId = ? AND studentId = ?',
      [quiz.classId, studentId]
    );
    
    console.log(`[AttemptRoutes] Enrollment check - classId: ${quiz.classId}, studentId: ${studentId}, found: ${enrollmentRows.length}`);
    
    if (enrollmentRows.length === 0) {
      console.log(`[AttemptRoutes] Student not enrolled in class`);
      return res.status(403).json({ message: 'You are not enrolled in the class for this quiz' });
    }

    // Step 5: Check timing (allow if quiz has started, or if no startTime is set)
    const now = new Date();
    if (quiz.startTime) {
      const startTime = new Date(quiz.startTime);
      console.log(`[AttemptRoutes] Timing check - now: ${now}, startTime: ${startTime}, canStart: ${now >= startTime}`);
      if (now < startTime) {
        console.log(`[AttemptRoutes] Quiz not started yet`);
        return res.status(403).json({ 
          message: `Quiz hasn't started yet. It will begin at ${startTime.toLocaleString()}` 
        });
      }
    }

    // Note: We allow attempts even after endTime for review purposes
    // The frontend will handle showing appropriate messages for closed quizzes

    // Check if student already has an active attempt for this quiz
    const [activeAttemptRows] = await db.pool.query(
      'SELECT id FROM quiz_attempts WHERE quizId = ? AND studentId = ? AND isCompleted = FALSE',
      [quizId, studentId]
    );
    if (activeAttemptRows.length > 0) {
      return res.status(409).json({ message: 'You already have an active attempt for this quiz' });
    }

    await db.pool.query(
      'INSERT INTO quiz_attempts (id, quizId, studentId, startedAt, isCompleted) VALUES (?, ?, ?, NOW(), FALSE)',
      [id, quizId, studentId]
    );
    
    console.log(`[AttemptRoutes] Successfully created attempt: ${id} for quiz ${quizId}, student ${studentId}`);
    res.status(201).json({ id, quizId, studentId, startedAt: new Date(), isCompleted: false });
  } catch (error) {
    console.error('Error creating quiz attempt:', error);
    res.status(500).json({ message: 'Server error creating quiz attempt' });
  }
});

// Submit a quiz attempt (protected route)
router.post('/:attemptId/submit', authenticateToken, async (req, res) => {
  const { attemptId } = req.params;
  const studentId = req.user.id;
  const { answers } = req.body;

  console.log(`[AttemptRoutes] Submitting quiz attempt ${attemptId} for student ${studentId}`);

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can submit quiz attempts' });
  }

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ message: 'Valid answers array is required' });
  }

  // Validate each answer
  for (let i = 0; i < answers.length; i++) {
    const answer = answers[i];
    if (!answer.questionId || answer.answer === undefined) {
      return res.status(400).json({ message: `Invalid answer format at index ${i}` });
    }
  }

  let connection;
  try {
    console.log(`[AttemptRoutes] Getting database connection...`);
    connection = await db.pool.getConnection();
    console.log(`[AttemptRoutes] Database connection successful`);
    console.log(`[AttemptRoutes] Starting transaction...`);
    await connection.beginTransaction();
    console.log(`[AttemptRoutes] Transaction started successfully`);

    console.log(`[AttemptRoutes] Querying attempt details...`);
    // Get attempt details
    const [attemptRows] = await connection.query(
      'SELECT qa.id, qa.quizId, qa.studentId, qa.startedAt, q.timeLimit, q.classId FROM quiz_attempts qa JOIN quizzes q ON qa.quizId = q.id WHERE qa.id = ? AND qa.studentId = ? AND qa.isCompleted = FALSE',
      [attemptId, studentId]
    );

    console.log(`[AttemptRoutes] Found ${attemptRows.length} attempt rows`);

    if (attemptRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Active quiz attempt not found for this student' });
    }

    const attempt = attemptRows[0];
    const quizId = attempt.quizId;
    const classId = attempt.classId;
    console.log(`[AttemptRoutes] Attempt found - quizId: ${quizId}, classId: ${classId}`);

    // Calculate time taken
    const submittedAt = new Date();
    const startedAt = new Date(attempt.startedAt);
    const timeTaken = Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000);

    console.log(`[AttemptRoutes] Getting quiz questions for quizId: ${quizId}`);
    // Get quiz questions
    const [questionRows] = await connection.query(
      'SELECT id, questionType, points, options, correctAnswer FROM quiz_questions WHERE quizId = ?',
      [quizId]
    );
    console.log(`[AttemptRoutes] Found ${questionRows.length} questions`);
    const questions = questionRows.map(q => ({
      ...q,
      // Safely handle JSON column that may already be parsed or be a string
      options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null,
    }));
    const questionMap = new Map(questions.map(q => [q.id, q]));

    let score = 0;
    let totalPossiblePoints = 0;
    const quizAnswersToInsert = [];

    for (const q of questions) {
      totalPossiblePoints += q.points;
    }

    // Grade answers
    for (const studentAnswer of answers) {
      const question = questionMap.get(studentAnswer.questionId);
      if (!question) continue;

      let isCorrect = false;
      let pointsEarned = 0;

      if (question.questionType === 'multiple-choice') {
        if (studentAnswer.answer && studentAnswer.answer.trim() === question.correctAnswer.trim()) {
          isCorrect = true;
          pointsEarned = question.points;
        }
      } else if (question.questionType === 'true-false') {
        const normalizedStudentAnswer = studentAnswer.answer ? studentAnswer.answer.trim().toLowerCase() : '';
        const normalizedCorrectAnswer = question.correctAnswer.trim().toLowerCase();
        
        if (normalizedStudentAnswer === normalizedCorrectAnswer) {
          isCorrect = true;
          pointsEarned = question.points;
        }
      } else if (question.questionType === 'short-answer') {
        if (studentAnswer.answer && studentAnswer.answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()) {
          isCorrect = true;
          pointsEarned = question.points;
        }
      }
      score += pointsEarned;

      quizAnswersToInsert.push([
        uuidv4(),
        attemptId,
        studentAnswer.questionId,
        studentAnswer.answer,
        isCorrect,
        pointsEarned,
      ]);
    }

    // Insert answers
    if (quizAnswersToInsert.length > 0) {
      await connection.query(
        'INSERT INTO quiz_answers (id, attemptId, questionId, answer, isCorrect, pointsEarned) VALUES ?',
        [quizAnswersToInsert]
      );
    }

    // Update attempt
    await connection.query(
      'UPDATE quiz_attempts SET submittedAt = ?, score = ?, totalPoints = ?, timeTaken = ?, isCompleted = TRUE WHERE id = ?',
      [submittedAt, score, totalPossiblePoints, timeTaken, attemptId]
    );

    // Update leaderboard if class exists
    if (classId) {
      const [studentTotalScoreRows] = await connection.query(
        `SELECT SUM(qa.score) as totalScore
         FROM quiz_attempts qa
         JOIN quizzes q ON qa.quizId = q.id
         WHERE qa.studentId = ? AND q.classId = ? AND qa.isCompleted = TRUE`,
        [studentId, classId]
      );
      const studentTotalScore = studentTotalScoreRows[0].totalScore || 0;

      await connection.query(
        `INSERT INTO leaderboards (id, classId, studentId, totalScore)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE totalScore = ?`,
        [uuidv4(), classId, studentId, studentTotalScore, studentTotalScore]
      );

      // Recalculate ranks
      const [leaderboardEntries] = await connection.query(
        `SELECT id, studentId, totalScore FROM leaderboards WHERE classId = ? ORDER BY totalScore DESC`,
        [classId]
      );

      for (let i = 0; i < leaderboardEntries.length; i++) {
        await connection.query(
          'UPDATE leaderboards SET student_rank = ? WHERE id = ?',
          [i + 1, leaderboardEntries[i].id]
        );
      }

      // Broadcast leaderboard update
      const [updatedLeaderboard] = await connection.query(
        `SELECT l.studentId, l.totalScore, l.student_rank as studentRank, u.displayName as studentName
         FROM leaderboards l
         JOIN users u ON l.studentId = u.id
         WHERE l.classId = ?
         ORDER BY l.totalScore DESC
         LIMIT 10`,
        [classId]
      );

      const leaderboardData = {
        classId,
        leaderboard: updatedLeaderboard,
        updatedBy: studentId
      };
      
      const io = req.app.get('io');
      if (io) {
        // Broadcast to all connected users for now since class rooms aren't set up
        io.emit('leaderboardUpdate', leaderboardData);
        console.log(`[AttemptRoutes] Broadcasted leaderboard update for class ${classId}`);
      }
    }

    // Handle challenges
    const [challengeCheckRows] = await connection.query(
      `SELECT id, challengerId, opponentId, quizId, status FROM challenges 
       WHERE quizId = ? AND (challengerId = ? OR opponentId = ?) AND status = 'accepted'`,
      [quizId, studentId, studentId]
    );

    if (challengeCheckRows.length > 0) {
      const challenge = challengeCheckRows[0];
      const otherParticipantId = challenge.challengerId === studentId ? challenge.opponentId : challenge.challengerId;

      const [otherAttemptRows] = await connection.query(
        'SELECT id, score FROM quiz_attempts WHERE quizId = ? AND studentId = ? AND isCompleted = TRUE',
        [quizId, otherParticipantId]
      );

      if (otherAttemptRows.length > 0) {
        const studentScore = score;
        const otherParticipantScore = otherAttemptRows[0].score;

        let winnerId = null;
        if (studentScore > otherParticipantScore) {
          winnerId = studentId;
        } else if (otherParticipantScore > studentScore) {
          winnerId = otherParticipantId;
        }

        if (winnerId) {
          await connection.query(
            'UPDATE challenges SET status = "completed", winnerId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
            [winnerId, challenge.id]
          );
        } else {
          await connection.query(
            'UPDATE challenges SET status = "completed", updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
            [challenge.id]
          );
        }
      }
    }

    await connection.commit();
    console.log(`[AttemptRoutes] Quiz submission completed successfully for attempt ${attemptId}`);
    res.status(200).json({ message: 'Quiz submitted successfully', attemptId, score, totalPossiblePoints, timeTaken });

  } catch (error) {
    console.error(`[AttemptRoutes] Error submitting quiz attempt ${attemptId}:`, error);
    console.error(`[AttemptRoutes] Error stack:`, error.stack);
    if (connection) {
      try {
        await connection.rollback();
        console.log(`[AttemptRoutes] Transaction rolled back`);
      } catch (rollbackError) {
        console.error(`[AttemptRoutes] Error rolling back transaction:`, rollbackError);
      }
    }
    res.status(500).json({ 
      message: 'Failed to submit quiz', 
      error: error.message,
      code: error.code,
      sqlState: error.sqlState
    });
  } finally {
    if (connection) {
      connection.release();
      console.log(`[AttemptRoutes] Database connection released`);
    }
  }
});

module.exports = router;
