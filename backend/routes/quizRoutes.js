const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('./authRoutes');
const { createNotification, sendRealTimeNotification } = require('./notificationRoutes');

// ============================================
// GET ALL QUIZZES - REWRITTEN FOR STUDENTS
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    console.log(`[QuizRoutes] Fetching quizzes for ${userRole}: ${userId}`);

    let query;
    let queryParams = [];

    if (userRole === 'teacher') {
      // Teachers see all their own quizzes
      query = `
        SELECT 
          q.id, 
          q.title, 
          q.description, 
          q.type, 
          q.classId, 
          q.timeLimit, 
          q.totalPoints, 
          q.startTime, 
          q.endTime, 
          q.isPublished, 
          q.createdAt, 
          q.updatedAt,
          u.displayName as teacherName, 
          u.id as teacherId,
          c.name as className
        FROM quizzes q
        JOIN users u ON q.teacherId = u.id
        LEFT JOIN classes c ON q.classId = c.id
        WHERE q.teacherId = ?
        ORDER BY q.createdAt DESC
      `;
      queryParams = [userId];
    } else if (userRole === 'student') {
      // Students see only published quizzes from classes they're enrolled in
      query = `
        SELECT DISTINCT
          q.id, 
          q.title, 
          q.description, 
          q.type, 
          q.classId, 
          q.timeLimit, 
          q.totalPoints, 
          q.startTime, 
          q.endTime, 
          q.isPublished, 
          q.createdAt, 
          q.updatedAt,
          u.displayName as teacherName, 
          u.id as teacherId,
          c.name as className
        FROM quizzes q
        JOIN users u ON q.teacherId = u.id
        JOIN classes c ON q.classId = c.id
        JOIN class_enrollments ce ON c.id = ce.classId
        WHERE ce.studentId = ? 
          AND q.isPublished = TRUE
          AND q.classId IS NOT NULL
        ORDER BY q.startTime DESC, q.createdAt DESC
      `;
      queryParams = [userId];
    } else {
      return res.status(403).json({ message: 'Invalid user role' });
    }

    const [rows] = await db.pool.query(query, queryParams);
    console.log(`[QuizRoutes] Found ${rows.length} quizzes for ${userRole}`);

    // Calculate status for each quiz
    const quizzesWithStatus = rows.map(quiz => {
      const now = new Date();
      const startTime = quiz.startTime ? new Date(quiz.startTime) : null;
      const endTime = quiz.endTime ? new Date(quiz.endTime) : null;
      
      let status = 'Draft';
      if (quiz.isPublished) {
        if (startTime && endTime) {
          if (now < startTime) {
            status = 'Upcoming';
          } else if (now >= startTime && now <= endTime) {
            status = 'Active';
          } else {
            status = 'Closed';
          }
        } else if (startTime && now >= startTime) {
          status = 'Active';
        } else if (startTime && now < startTime) {
          status = 'Upcoming';
        } else {
          status = 'Active'; // No time restrictions
        }
      }

      return { 
        ...quiz, 
        status,
        canTake: status === 'Active' || (userRole === 'teacher' && quiz.isPublished)
      };
    });

    res.status(200).json(quizzesWithStatus);
  } catch (error) {
    console.error('[QuizRoutes] Error fetching quizzes:', error);
    res.status(500).json({ message: 'Server error fetching quizzes', error: error.message });
  }
});

// ============================================
// GET SINGLE QUIZ BY ID
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // First, get the quiz
    const [quizzes] = await db.pool.query(
      `SELECT 
        q.id, q.title, q.description, q.type, q.classId, q.timeLimit, q.totalPoints, 
        q.startTime, q.endTime, q.isPublished, q.createdAt, q.updatedAt,
        u.displayName as teacherName, u.id as teacherId,
        c.name as className
      FROM quizzes q
      JOIN users u ON q.teacherId = u.id
      LEFT JOIN classes c ON q.classId = c.id
      WHERE q.id = ?`,
      [id]
    );

    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const quiz = quizzes[0];

    // Authorization check
    if (userRole === 'teacher') {
      if (quiz.teacherId !== userId) {
        return res.status(403).json({ message: 'Access denied: You do not own this quiz' });
      }
    } else if (userRole === 'student') {
      // Student must be enrolled and quiz must be published
      if (!quiz.isPublished) {
        return res.status(403).json({ message: 'Access denied: Quiz is not published' });
      }
      
      if (!quiz.classId) {
        return res.status(403).json({ message: 'Access denied: Quiz is not assigned to a class' });
      }

      // Check enrollment
      const [enrollmentRows] = await db.pool.query(
        'SELECT id FROM class_enrollments WHERE classId = ? AND studentId = ?',
        [quiz.classId, userId]
      );

      if (enrollmentRows.length === 0) {
        return res.status(403).json({ message: 'Access denied: You are not enrolled in the class for this quiz' });
      }
    }

    // Calculate status
    const now = new Date();
    const startTime = quiz.startTime ? new Date(quiz.startTime) : null;
    const endTime = quiz.endTime ? new Date(quiz.endTime) : null;
    
    let status = 'Draft';
    if (quiz.isPublished) {
      if (startTime && endTime) {
        if (now < startTime) {
          status = 'Upcoming';
        } else if (now >= startTime && now <= endTime) {
          status = 'Active';
        } else {
          status = 'Closed';
        }
      } else if (startTime && now >= startTime) {
        status = 'Active';
      } else if (startTime && now < startTime) {
        status = 'Upcoming';
      } else {
        status = 'Active';
      }
    }

    res.status(200).json({ ...quiz, status });
  } catch (error) {
    console.error('[QuizRoutes] Error fetching quiz:', error);
    res.status(500).json({ message: 'Server error fetching quiz', error: error.message });
  }
});

// ============================================
// GET QUIZ QUESTIONS - COMPLETELY REWRITTEN
// ============================================
router.get('/:quizId/questions', authenticateToken, async (req, res) => {
  const { quizId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    console.log(`[QuizRoutes] Questions request - quizId: ${quizId}, userId: ${userId}, role: ${userRole}`);

    // Step 1: Verify quiz exists
    const [quizRows] = await db.pool.query(
      'SELECT id, title, teacherId, classId, isPublished, startTime, endTime FROM quizzes WHERE id = ?',
      [quizId]
    );

    if (!quizRows || quizRows.length === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const quiz = quizRows[0];

    // Step 2: Authorization check
    if (userRole === 'teacher') {
      if (quiz.teacherId !== userId) {
        return res.status(403).json({ message: 'Access denied: You do not own this quiz' });
      }
    } else if (userRole === 'student') {
      // Check if quiz is published
      if (!quiz.isPublished) {
        return res.status(403).json({ message: 'Access denied: Quiz is not published' });
      }

      // Check if quiz is assigned to a class
      if (!quiz.classId) {
        return res.status(403).json({ message: 'Access denied: Quiz is not assigned to a class' });
      }

      // Check if student is enrolled
      const [enrollmentRows] = await db.pool.query(
        'SELECT id FROM class_enrollments WHERE classId = ? AND studentId = ?',
        [quiz.classId, userId]
      );

      if (enrollmentRows.length === 0) {
        return res.status(403).json({ message: 'Access denied: You are not enrolled in the class for this quiz' });
      }

      // Check if quiz is currently active (optional - you can remove this if students should see questions even for closed quizzes)
      const now = new Date();
      if (quiz.startTime && new Date(quiz.startTime) > now) {
        return res.status(403).json({ message: 'Quiz has not started yet' });
      }
    }

    // Step 3: Fetch questions
    const [questions] = await db.pool.query(
      `SELECT 
        id, 
        quizId, 
        questionText, 
        questionType, 
        points, 
        orderIndex, 
        options, 
        correctAnswer 
      FROM quiz_questions 
      WHERE quizId = ? 
      ORDER BY orderIndex ASC`,
      [quizId]
    );

    if (!questions || questions.length === 0) {
      console.log(`[QuizRoutes] No questions found for quiz ${quizId}`);
      return res.status(200).json([]);
    }

    console.log(`[QuizRoutes] Found ${questions.length} questions for quiz ${quizId}`);

    // Step 4: Parse options safely
    const parsedQuestions = questions.map((q) => {
      let parsedOptions = null;

      if (q.options !== null && q.options !== undefined) {
        try {
          // Handle Buffer (MySQL JSON can return as Buffer)
          if (Buffer.isBuffer(q.options)) {
            const str = q.options.toString('utf8');
            if (str && str.trim() && str.trim() !== 'null') {
              parsedOptions = JSON.parse(str);
            }
          }
          // Handle string
          else if (typeof q.options === 'string') {
            const trimmed = q.options.trim();
            if (trimmed && trimmed !== 'null' && trimmed !== 'NULL') {
              parsedOptions = JSON.parse(trimmed);
            }
          }
          // Handle object (already parsed by MySQL)
          else if (typeof q.options === 'object') {
            parsedOptions = q.options;
          }
        } catch (parseError) {
          console.error(`[QuizRoutes] Error parsing options for question ${q.id}:`, parseError.message);
          console.error(`[QuizRoutes] Raw options data:`, q.options);
          parsedOptions = []; // Default to empty array instead of null
        }
      }

      return {
        id: q.id,
        quizId: q.quizId,
        questionText: q.questionText,
        questionType: q.questionType,
        points: q.points,
        orderIndex: q.orderIndex,
        options: parsedOptions || [], // Ensure options is always an array
        correctAnswer: q.correctAnswer
      };
    });

    console.log(`[QuizRoutes] Successfully processed ${parsedQuestions.length} questions`);
    res.status(200).json(parsedQuestions);

  } catch (error) {
    console.error('[QuizRoutes] Error fetching quiz questions:', error);
    console.error('[QuizRoutes] Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error fetching quiz questions', 
      error: error.message 
    });
  }
});

// ============================================
// CREATE QUIZ (Teacher only)
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can create quizzes' });
  }

  const { title, description, type, classId, timeLimit, totalPoints, startTime, endTime, isPublished } = req.body;
  const teacherId = req.user.id;
  const id = uuidv4();

  try {
    await db.pool.query(
      `INSERT INTO quizzes (id, title, description, type, classId, teacherId, timeLimit, totalPoints, startTime, endTime, isPublished)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description, type || 'multiple-choice', classId, teacherId, timeLimit, totalPoints || 0, startTime, endTime, isPublished || false]
    );

    // Create notification for enrolled students if published
    if (isPublished && classId) {
      try {
        const [students] = await db.pool.query(
          'SELECT studentId FROM class_enrollments WHERE classId = ?',
          [classId]
        );

        for (const student of students) {
          await createNotification({
            userId: student.studentId,
            type: 'quiz_assigned',
            message: `New quiz "${title}" has been assigned to your class`,
            link: `/student/quizzes/${id}`
          });
        }
      } catch (notifError) {
        console.error('Error creating notifications:', notifError);
      }
    }

    res.status(201).json({ id, message: 'Quiz created successfully' });
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ message: 'Server error creating quiz', error: error.message });
  }
});

// ============================================
// UPDATE QUIZ (Teacher only)
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can update quizzes' });
  }

  const { id } = req.params;
  const teacherId = req.user.id;
  const { title, description, type, classId, timeLimit, totalPoints, startTime, endTime, isPublished } = req.body;

  try {
    // Verify ownership
    const [quizzes] = await db.pool.query('SELECT teacherId FROM quizzes WHERE id = ?', [id]);
    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (quizzes[0].teacherId !== teacherId) {
      return res.status(403).json({ message: 'Access denied: You do not own this quiz' });
    }

    const updateFields = [];
    const updateValues = [];

    if (title !== undefined) { updateFields.push('title = ?'); updateValues.push(title); }
    if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description); }
    if (type !== undefined) { updateFields.push('type = ?'); updateValues.push(type); }
    if (classId !== undefined) { updateFields.push('classId = ?'); updateValues.push(classId); }
    if (timeLimit !== undefined) { updateFields.push('timeLimit = ?'); updateValues.push(timeLimit); }
    if (totalPoints !== undefined) { updateFields.push('totalPoints = ?'); updateValues.push(totalPoints); }
    if (startTime !== undefined) { updateFields.push('startTime = ?'); updateValues.push(startTime); }
    if (endTime !== undefined) { updateFields.push('endTime = ?'); updateValues.push(endTime); }
    if (isPublished !== undefined) { updateFields.push('isPublished = ?'); updateValues.push(isPublished); }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields provided for update' });
    }

    updateValues.push(id);
    await db.pool.query(
      `UPDATE quizzes SET ${updateFields.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      updateValues
    );

    const [updatedQuiz] = await db.pool.query('SELECT * FROM quizzes WHERE id = ?', [id]);
    res.status(200).json(updatedQuiz[0]);
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ message: 'Server error updating quiz', error: error.message });
  }
});

// ============================================
// DELETE QUIZ (Teacher only)
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can delete quizzes' });
  }

  const { id } = req.params;
  const teacherId = req.user.id;

  try {
    const [quizzes] = await db.pool.query('SELECT teacherId FROM quizzes WHERE id = ?', [id]);
    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (quizzes[0].teacherId !== teacherId) {
      return res.status(403).json({ message: 'Access denied: You do not own this quiz' });
    }

    await db.pool.query('DELETE FROM quizzes WHERE id = ?', [id]);
    res.status(200).json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ message: 'Server error deleting quiz', error: error.message });
  }
});

// ============================================
// CREATE QUESTION FOR QUIZ (Teacher only)
// ============================================
router.post('/:quizId/questions', authenticateToken, async (req, res) => {
  const { quizId } = req.params;
  const { questionText, questionType, points, options, correctAnswer } = req.body;
  const teacherId = req.user.id;

  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can create questions' });
  }

  try {
    // Verify quiz ownership
    const [quizzes] = await db.pool.query('SELECT teacherId FROM quizzes WHERE id = ?', [quizId]);
    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (quizzes[0].teacherId !== teacherId) {
      return res.status(403).json({ message: 'Access denied: You do not own this quiz' });
    }

    // Get max orderIndex
    const [orderRows] = await db.pool.query(
      'SELECT MAX(orderIndex) as maxOrder FROM quiz_questions WHERE quizId = ?',
      [quizId]
    );
    const orderIndex = (orderRows[0]?.maxOrder ?? -1) + 1;

    const id = uuidv4();
    const optionsJson = options ? JSON.stringify(options) : null;

    await db.pool.query(
      `INSERT INTO quiz_questions (id, quizId, questionText, questionType, points, orderIndex, options, correctAnswer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, quizId, questionText, questionType, points, orderIndex, optionsJson, correctAnswer]
    );

    // Update quiz totalPoints
    const [pointsRows] = await db.pool.query(
      'SELECT SUM(points) as total FROM quiz_questions WHERE quizId = ?',
      [quizId]
    );
    const newTotal = pointsRows[0]?.total || 0;
    await db.pool.query('UPDATE quizzes SET totalPoints = ? WHERE id = ?', [newTotal, quizId]);

    res.status(201).json({ id, message: 'Question created successfully' });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ message: 'Server error creating question', error: error.message });
  }
});

module.exports = router;
