const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./authRoutes');
// const PDFDocument = require('pdfkit'); // Uncomment when pdfkit is installed
// const csv = require('csv-stringify'); // Might need to install this or use a simpler method

// Middleware to ensure authenticated users can access analytics (role checks are done per route)
router.use(authenticateToken);

// Helper to check if teacher owns the class/quiz
const checkTeacherOwnership = async (userId, classId = null, quizId = null) => {
  if (classId) {
    const [classRows] = await db.pool.query('SELECT id FROM classes WHERE id = ? AND teacherId = ?', [classId, userId]);
    if (classRows.length === 0) return false;
  }
  if (quizId) {
    const [quizRows] = await db.pool.query('SELECT id FROM quizzes WHERE id = ? AND teacherId = ?', [quizId, userId]);
    if (quizRows.length === 0) return false;
  }
  return true;
};

// GET General Analytics (for overall dashboard)
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { timeRange, classId, quizId, studentId } = req.query;

  try {
    console.log(`[AnalyticsRoutes] Fetching general analytics for user ${userId}, role: ${userRole}`);
    console.log(`[AnalyticsRoutes] Filters:`, { timeRange, classId, quizId, studentId });
    
    if (userRole !== 'teacher') {
      console.log('[AnalyticsRoutes] Access denied - not a teacher');
      return res.status(403).json({ message: 'Access denied: Only teachers can view general analytics' });
    }

    // Normalize filters coming from the frontend.
    // TeacherAnalytics uses values like 'all' for "no filter".
    const normalizedTimeRange =
      timeRange === '7d' || timeRange === '30d' || timeRange === '90d' || timeRange === 'all'
        ? timeRange
        : '30d';
    // StudentAnalytics charts are fixed to ~30 days, so keep teacher charts aligned by default.
    const timeDays = normalizedTimeRange === '7d' ? 7 : normalizedTimeRange === '90d' ? 90 : 30;

    const effectiveClassId = classId && classId !== 'all' ? classId : null;
    const effectiveQuizId = quizId && quizId !== 'all' ? quizId : null;
    const effectiveStudentId = studentId && studentId !== 'all' ? studentId : null;

    // Shared WHERE clause for quiz_attempts-backed queries.
    const quizAttemptWhereClauses = ['q.teacherId = ?', 'qa.isCompleted = TRUE'];
    const quizAttemptWhereParams = [userId];
    if (effectiveClassId) {
      quizAttemptWhereClauses.push('q.classId = ?');
      quizAttemptWhereParams.push(effectiveClassId);
    }
    if (effectiveQuizId) {
      quizAttemptWhereClauses.push('q.id = ?');
      quizAttemptWhereParams.push(effectiveQuizId);
    }
    if (effectiveStudentId) {
      quizAttemptWhereClauses.push('qa.studentId = ?');
      quizAttemptWhereParams.push(effectiveStudentId);
    }

    // Get total students across all classes
    const [totalStudentsRows] = await db.pool.query(
      `SELECT COUNT(DISTINCT ce.studentId) as totalStudents 
       FROM class_enrollments ce
       JOIN classes c ON ce.classId = c.id
       WHERE c.teacherId = ?`,
      [userId]
    );
    const totalStudents = totalStudentsRows[0]?.totalStudents || 0;

    // Get total quizzes
    const [totalQuizzesRows] = await db.pool.query(
      'SELECT COUNT(id) as totalQuizzes FROM quizzes WHERE teacherId = ?',
      [userId]
    );
    const totalQuizzes = totalQuizzesRows[0]?.totalQuizzes || 0;

    // Get published quizzes
    const [publishedQuizzesRows] = await db.pool.query(
      'SELECT COUNT(id) as publishedQuizzes FROM quizzes WHERE teacherId = ? AND isPublished = TRUE',
      [userId]
    );
    const publishedQuizzes = publishedQuizzesRows[0]?.publishedQuizzes || 0;

    // Get active quizzes
    const [activeQuizzesRows] = await db.pool.query(
      `SELECT COUNT(id) as activeQuizzes FROM quizzes 
       WHERE teacherId = ? AND isPublished = TRUE AND startTime <= NOW() AND endTime >= NOW()`,
      [userId]
    );
    const activeQuizzes = activeQuizzesRows[0]?.activeQuizzes || 0;

    // Get average score across all attempts (as percentage)
    const [avgScoreRows] = await db.pool.query(
      `SELECT AVG(
        CASE 
          WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 
          ELSE 0 
        END
      ) as averageScore 
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
      WHERE ${quizAttemptWhereClauses.join(' AND ')}`,
      quizAttemptWhereParams
    );
    const averageScore = avgScoreRows[0]?.averageScore || 0;

    // Get recent attempts
    const [recentAttemptsRows] = await db.pool.query(
      `SELECT qa.id, qa.score, qa.totalPoints, qa.submittedAt, qa.timeTaken,
              u.displayName as studentName, q.title as quizTitle
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       JOIN users u ON qa.studentId = u.id
       WHERE ${quizAttemptWhereClauses.join(' AND ')}
       ORDER BY qa.submittedAt DESC
       LIMIT 10`,
      quizAttemptWhereParams
    );

    // Get new students this week
    const [newStudentsRows] = await db.pool.query(
      `SELECT COUNT(DISTINCT ce.studentId) as newStudents 
       FROM class_enrollments ce
       JOIN classes c ON ce.classId = c.id
       WHERE c.teacherId = ? AND ce.enrolledAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [userId]
    );
    const newStudentsThisWeek = newStudentsRows[0]?.newStudents || 0;

    // Get score improvement (compare last 30 days vs previous 30 days) - as percentage
    const [currentPeriodRows] = await db.pool.query(
      `SELECT AVG(
        CASE 
          WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 
          ELSE 0 
        END
      ) as currentAvg 
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       WHERE ${quizAttemptWhereClauses.join(' AND ')} 
       AND qa.submittedAt >= DATE_SUB(NOW(), INTERVAL ${timeDays} DAY)`,
      quizAttemptWhereParams
    );
    const [previousPeriodRows] = await db.pool.query(
      `SELECT AVG(
        CASE 
          WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 
          ELSE 0 
        END
      ) as previousAvg 
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       WHERE ${quizAttemptWhereClauses.join(' AND ')} 
       AND qa.submittedAt >= DATE_SUB(NOW(), INTERVAL ${timeDays * 2} DAY)
       AND qa.submittedAt < DATE_SUB(NOW(), INTERVAL ${timeDays} DAY)`,
      quizAttemptWhereParams
    );
    
    const currentAvg = currentPeriodRows[0]?.currentAvg || 0;
    const previousAvg = previousPeriodRows[0]?.previousAvg || 0;
    const scoreImprovement = previousAvg > 0 ? Math.round(((currentAvg - previousAvg) / previousAvg) * 100) : 0;

    // Get performance over time data (based on timeRange) - as percentage
    const [performanceOverTimeRows] = await db.pool.query(
      `SELECT 
         DATE(qa.submittedAt) as date,
         AVG(
          CASE 
            WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 
            ELSE 0 
          END
        ) as avgScore,
         COUNT(qa.id) as attempts
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       WHERE ${quizAttemptWhereClauses.join(' AND ')} 
       AND qa.submittedAt >= DATE_SUB(NOW(), INTERVAL ${timeDays} DAY)
       GROUP BY DATE(qa.submittedAt)
       ORDER BY date`,
      quizAttemptWhereParams
    );

    const performanceOverTime = {
      labels: performanceOverTimeRows.map(row => new Date(row.date).toLocaleDateString('en-US', { weekday: 'short' })),
      scores: performanceOverTimeRows.map(row => Math.round(row.avgScore || 0)),
      participation: performanceOverTimeRows.map(row => row.attempts)
    };

    // Get quiz difficulty distribution (based on average percentage)
    const [quizDifficultyRows] = await db.pool.query(
      `SELECT 
         CASE 
           WHEN AVG(
            CASE 
              WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 
              ELSE 0 
            END
           ) >= 80 THEN 'Easy'
           WHEN AVG(
            CASE 
              WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 
              ELSE 0 
            END
           ) >= 60 THEN 'Medium'
           ELSE 'Hard'
         END as difficulty,
         COUNT(DISTINCT q.id) as count
       FROM quizzes q
       LEFT JOIN quiz_attempts qa ON q.id = qa.quizId AND qa.isCompleted = TRUE
       WHERE q.teacherId = ? AND q.isPublished = TRUE
       GROUP BY 1`,
      [userId]
    );

    const quizDifficulty = {
      labels: quizDifficultyRows.map(row => row.difficulty),
      counts: quizDifficultyRows.map(row => row.count)
    };

    // Get top performing students (average percentage)
    const [topStudentsRows] = await db.pool.query(
      `SELECT u.displayName, 
        AVG(
          CASE 
            WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 
            ELSE 0 
          END
        ) as avgScore
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       JOIN users u ON qa.studentId = u.id
       WHERE ${quizAttemptWhereClauses.join(' AND ')}
       GROUP BY u.id, u.displayName
       ORDER BY avgScore DESC
       LIMIT 5`,
      quizAttemptWhereParams
    );

    const topStudents = {
      labels: topStudentsRows.map(row => row.displayName),
      scores: topStudentsRows.map(row => Math.round(row.avgScore || 0))
    };

    const responseData = {
      totalStudents,
      totalQuizzes,
      publishedQuizzes,
      activeQuizzes,
      averageScore: Math.round(averageScore),
      newStudentsThisWeek,
      scoreImprovement,
      performanceOverTime,
      quizDifficulty,
      topStudents,
      recentAttempts: recentAttemptsRows.map(attempt => ({
        id: attempt.id,
        studentName: attempt.studentName,
        quizTitle: attempt.quizTitle,
        // Keep `score` in 0-100% scale since the UI treats it as a percentage
        score: attempt.totalPoints > 0 ? Math.round((attempt.score / attempt.totalPoints) * 100) : 0,
        totalPoints: attempt.totalPoints,
        percentage: attempt.totalPoints > 0 ? Math.round((attempt.score / attempt.totalPoints) * 100) : 0,
        timeSpent: Math.round(attempt.timeTaken / 60), // Convert seconds to minutes
        submittedAt: attempt.submittedAt
      }))
    };
    console.log('[AnalyticsRoutes] Successfully fetched analytics:', {
      totalStudents,
      totalQuizzes,
      activeQuizzes
    });
    res.status(200).json(responseData);
  } catch (error) {
    console.error('[AnalyticsRoutes] Error fetching general analytics:', error);
    res.status(500).json({ message: 'Server error fetching general analytics', error: error.message });
  }
});

// Get student performance tracking data
router.get('/student-performance/:studentId', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if the requesting user is either the student themselves or a teacher
    if (userRole === 'student' && userId !== studentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // For teachers, verify they have access to this student
    if (userRole === 'teacher') {
      const [teacherAccessRows] = await db.pool.query(
        `SELECT DISTINCT ce.studentId 
         FROM class_enrollments ce
         JOIN classes c ON ce.classId = c.id
         WHERE c.teacherId = ? AND ce.studentId = ?`,
        [userId, studentId]
      );
      
      if (teacherAccessRows.length === 0) {
        return res.status(403).json({ error: 'Access denied - student not in your classes' });
      }
    }

    // Get overall student performance
    const [overallPerformanceRows] = await db.pool.query(
      `SELECT 
         COUNT(DISTINCT qa.quizId) as quizzesTaken,
         COUNT(qa.id) as totalAttempts,
         AVG(CASE WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 ELSE 0 END) as averageScore,
         MAX(CASE WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 ELSE 0 END) as highestScore,
         MIN(CASE WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 ELSE 0 END) as lowestScore,
         AVG(
           CASE 
             WHEN q.timeLimit IS NOT NULL AND q.timeLimit > 0 
             THEN (qa.timeTaken / (q.timeLimit * 60)) * 100
             ELSE 0
           END
         ) as averageTimeUsagePercent
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       WHERE qa.studentId = ? AND qa.isCompleted = TRUE`,
      [studentId]
    );

    const overallPerformance = overallPerformanceRows[0] || {
      quizzesTaken: 0,
      totalAttempts: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      averageTimeUsagePercent: 0
    };

    // Get performance over time (last 30 days)
    const [performanceOverTimeRows] = await db.pool.query(
      `SELECT 
         DATE(qa.submittedAt) as date,
         AVG(CASE WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 ELSE 0 END) as avgScore,
         COUNT(qa.id) as attempts
       FROM quiz_attempts qa
       WHERE qa.studentId = ? AND qa.isCompleted = TRUE
       AND qa.submittedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(qa.submittedAt)
       ORDER BY date`,
      [studentId]
    );

    const performanceOverTime = {
      labels: performanceOverTimeRows.map(row => new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      scores: performanceOverTimeRows.map(row => Math.round(row.avgScore || 0)),
      attempts: performanceOverTimeRows.map(row => row.attempts)
    };

    // Get subject-wise performance
    const [subjectPerformanceRows] = await db.pool.query(
      `SELECT 
         c.name as subject,
         COUNT(DISTINCT qa.quizId) as quizzesTaken,
         AVG(CASE WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 ELSE 0 END) as averageScore,
         COUNT(qa.id) as totalAttempts
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       JOIN classes c ON q.classId = c.id
       WHERE qa.studentId = ? AND qa.isCompleted = TRUE
       GROUP BY c.id, c.name
       ORDER BY averageScore DESC`,
      [studentId]
    );

    const subjectPerformance = subjectPerformanceRows.map(row => ({
      subject: row.subject,
      quizzesTaken: row.quizzesTaken,
      averageScore: Math.round(row.averageScore || 0),
      totalAttempts: row.totalAttempts
    }));

    // Get recent quiz attempts
    const [recentAttemptsRows] = await db.pool.query(
      `SELECT 
         q.title as quizTitle,
         c.name as className,
         qa.score,
         qa.totalPoints,
         qa.timeTaken,
         qa.submittedAt,
         (SELECT COUNT(*) FROM quiz_attempts qa2 
          WHERE qa2.quizId = qa.quizId AND qa2.isCompleted = TRUE AND qa2.score > qa.score) + 1 as rankPosition
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       JOIN classes c ON q.classId = c.id
       WHERE qa.studentId = ? AND qa.isCompleted = TRUE
       ORDER BY qa.submittedAt DESC
       LIMIT 10`,
      [studentId]
    );

    const recentAttempts = recentAttemptsRows.map(attempt => ({
      quizTitle: attempt.quizTitle,
      className: attempt.className,
      score: attempt.score,
      totalPoints: attempt.totalPoints,
      percentage: attempt.totalPoints > 0 ? Math.round((attempt.score / attempt.totalPoints) * 100) : 0,
      timeSpent: Math.round(attempt.timeTaken / 60),
      submittedAt: attempt.submittedAt,
      rank: attempt.rankPosition ?? attempt.rank
    }));

    // Get improvement trends
    const [improvementTrendRows] = await db.pool.query(
      `SELECT 
         MONTH(qa.submittedAt) as month,
         YEAR(qa.submittedAt) as year,
         AVG(CASE WHEN qa.totalPoints > 0 THEN (qa.score / qa.totalPoints) * 100 ELSE 0 END) as avgScore,
         COUNT(qa.id) as attempts
       FROM quiz_attempts qa
       WHERE qa.studentId = ? AND qa.isCompleted = TRUE
       AND qa.submittedAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY YEAR(qa.submittedAt), MONTH(qa.submittedAt)
       ORDER BY year, month`,
      [studentId]
    );

    const improvementTrend = improvementTrendRows.map(row => ({
      month: new Date(row.year, row.month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      avgScore: Math.round(row.avgScore || 0),
      attempts: row.attempts
    }));

    res.status(200).json({
      studentId,
      overallPerformance: {
        ...overallPerformance,
        averageTimeUsagePercent: Math.round(overallPerformance.averageTimeUsagePercent)
      },
      performanceOverTime,
      subjectPerformance,
      recentAttempts,
      improvementTrend
    });

  } catch (error) {
    console.error('Student performance tracking error:', error);
    // For the analytics UI, it's better to return an "empty" dataset than fail the whole page
    // (students with no attempts should still get a valid response).
    res.status(200).json({
      studentId: req.params.studentId,
      overallPerformance: {
        quizzesTaken: 0,
        totalAttempts: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        averageTimeUsagePercent: 0
      },
      performanceOverTime: { labels: [], scores: [], attempts: [] },
      subjectPerformance: [],
      recentAttempts: [],
      improvementTrend: []
    });
  }
});

// GET Classroom Overview
router.get('/classroom-overview/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user.id;

  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Access denied: Only teachers can view classroom overview' });
    }

    if (!(await checkTeacherOwnership(teacherId, classId))) {
      return res.status(403).json({ message: 'Access denied: You do not own this class' });
    }

    // Total Students
    const [studentCountRows] = await db.pool.query(
      'SELECT COUNT(DISTINCT studentId) as totalStudents FROM class_enrollments WHERE classId = ?',
      [classId]
    );
    const totalStudents = studentCountRows[0].totalStudents;

    // Active Quizzes (published and within time frame)
    const [activeQuizzesRows] = await db.pool.query(
      `SELECT COUNT(id) as activeQuizzes FROM quizzes 
       WHERE classId = ? AND isPublished = TRUE AND startTime <= NOW() AND endTime >= NOW()`,
      [classId]
    );
    const activeQuizzes = activeQuizzesRows[0].activeQuizzes;

    // Participation Rate (students who attempted at least one quiz in this class)
    const [participatingStudentsRows] = await db.pool.query(
      `SELECT COUNT(DISTINCT qa.studentId) as participatingStudents FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       WHERE q.classId = ?`,
      [classId]
    );
    const participatingStudents = participatingStudentsRows[0].participatingStudents;
    const participationRate = totalStudents > 0 ? (participatingStudents / totalStudents) * 100 : 0;

    res.status(200).json({
      classId,
      totalStudents,
      activeQuizzes,
      participationRate: parseFloat(participationRate.toFixed(2)),
    });
  } catch (error) {
    console.error('Error fetching classroom overview:', error);
    res.status(500).json({ message: 'Server error fetching classroom overview' });
  }
});

// GET Per-Quiz Analytics
router.get('/quiz-analytics/:quizId', authenticateToken, async (req, res) => {
  const { quizId } = req.params;
  const teacherId = req.user.id;

  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Access denied: Only teachers can view quiz analytics' });
    }

    if (!(await checkTeacherOwnership(teacherId, null, quizId))) {
      return res.status(403).json({ message: 'Access denied: You do not own this quiz' });
    }

    // Average Score and Total Attempts (average percentage)
    const [quizStatsRows] = await db.pool.query(
      `SELECT 
        AVG(
          CASE 
            WHEN totalPoints > 0 THEN (score / totalPoints) * 100 
            ELSE 0 
          END
        ) as averageScore,
        COUNT(id) as totalAttempts 
       FROM quiz_attempts 
       WHERE quizId = ? AND isCompleted = TRUE`,
      [quizId]
    );
    const averageScore = quizStatsRows[0].averageScore || 0;
    const totalAttempts = quizStatsRows[0].totalAttempts;

    // Average time taken (minutes) for UI
    const [avgTimeRows] = await db.pool.query(
      'SELECT AVG(timeTaken) as avgTimeTaken FROM quiz_attempts WHERE quizId = ? AND isCompleted = TRUE',
      [quizId]
    );
    const averageTimeTaken = avgTimeRows[0]?.avgTimeTaken || 0;
    const averageTimeTakenMinutes = Math.round(averageTimeTaken / 60);

    // Question Performance (accuracy per question)
    const [questionPerformanceRows] = await db.pool.query(
      `SELECT qq.id as questionId, qq.questionText, 
              SUM(CASE WHEN qa.isCorrect = TRUE THEN 1 ELSE 0 END) as correctAnswers,
              COUNT(qa.id) as totalAnswers
       FROM quiz_questions qq
       LEFT JOIN quiz_answers qa ON qq.id = qa.questionId
       JOIN quiz_attempts qatt ON qa.attemptId = qatt.id
       WHERE qq.quizId = ? AND qatt.isCompleted = TRUE
       GROUP BY qq.id, qq.questionText`,
      [quizId]
    );
    const questionPerformance = questionPerformanceRows.map(q => ({
      questionId: q.questionId,
      questionText: q.questionText,
      accuracy: q.totalAnswers > 0 ? (q.correctAnswers / q.totalAnswers) * 100 : 0,
    }));

    // UI expects `questionAnalysis` with `correctPercentage` and `averageTimeSeconds`
    const questionAnalysis = questionPerformance.map(q => ({
      questionId: q.questionId,
      questionText: q.questionText,
      correctPercentage: Math.round(q.accuracy),
      // Per-question time isn't stored; keep a safe fallback.
      averageTimeSeconds: 0
    }));

    // Time Taken Distribution (example: bins of time taken)
    const [timeTakenRows] = await db.pool.query(
      `SELECT timeTaken FROM quiz_attempts WHERE quizId = ? AND isCompleted = TRUE ORDER BY timeTaken`,
      [quizId]
    );
    const timeTakenDistribution = []; // Implement binning logic here if needed, for now just raw data
    // Example binning:
    const bins = [0, 60, 180, 300, 600, Infinity]; // 0-1min, 1-3min, 3-5min, 5-10min, >10min (in seconds)
    const binLabels = ['<1 min', '1-3 min', '3-5 min', '5-10 min', '>10 min'];
    const distributionMap = new Map(binLabels.map(label => [label, 0]));

    timeTakenRows.forEach(row => {
      for (let i = 0; i < bins.length - 1; i++) {
        if (row.timeTaken >= bins[i] && row.timeTaken < bins[i+1]) {
          distributionMap.set(binLabels[i], distributionMap.get(binLabels[i]) + 1);
          break;
        }
      }
    });
    distributionMap.forEach((count, label) => timeTakenDistribution.push({ timeRange: label, count }));


    // Highest & Lowest Performing Students
    const [studentScoresRows] = await db.pool.query(
      `SELECT qa.studentId, u.displayName as studentName, qa.score, qa.totalPoints
       FROM quiz_attempts qa
       JOIN users u ON qa.studentId = u.id
       WHERE qa.quizId = ? AND qa.isCompleted = TRUE
       ORDER BY qa.score DESC`,
      [quizId]
    );

    const highestPerformingStudents = studentScoresRows.slice(0, 5); // Top 5
    const lowestPerformingStudents = studentScoresRows.slice(-5).reverse(); // Bottom 5

    // Get difficulty assessment
    const difficultyLevel = averageScore >= 80 ? 'Easy' : averageScore >= 60 ? 'Medium' : 'Hard';
    
    // Get top performers for this quiz
    const [topPerformersRows] = await db.pool.query(
      `SELECT u.displayName, qa.score, qa.timeTaken
       FROM quiz_attempts qa
       JOIN users u ON qa.studentId = u.id
       WHERE qa.quizId = ? AND qa.isCompleted = TRUE
       ORDER BY qa.score DESC, qa.timeTaken ASC
       LIMIT 5`,
      [quizId]
    );

    const topPerformers = topPerformersRows.map(row => ({
      name: row.displayName,
      score: row.score,
      timeSpent: Math.round(row.timeTaken / 60)
    }));

    // Get score distribution
    const [scoreDistributionRows] = await db.pool.query(
      `SELECT 
         CASE 
           WHEN score >= 90 THEN '90-100%'
           WHEN score >= 80 THEN '80-89%'
           WHEN score >= 70 THEN '70-79%'
           WHEN score >= 60 THEN '60-69%'
           ELSE 'Below 60%'
         END as range,
         COUNT(*) as count
       FROM quiz_attempts
       WHERE quizId = ? AND isCompleted = TRUE
       GROUP BY range
       ORDER BY range`,
      [quizId]
    );

    const scoreDistribution = {
      labels: scoreDistributionRows.map(row => row.range),
      counts: scoreDistributionRows.map(row => row.count)
    };

    // UI expects `topStudents` with `score` in 0-100% scale
    const topStudents = highestPerformingStudents.map(s => ({
      studentId: s.studentId,
      studentName: s.studentName,
      score: s.totalPoints > 0 ? Math.round((s.score / s.totalPoints) * 100) : 0
    }));

    // Get completion rate
    const [totalStudentsRows] = await db.pool.query(
      `SELECT COUNT(DISTINCT ce.studentId) as totalStudents
       FROM class_enrollments ce
       JOIN classes c ON ce.classId = c.id
       JOIN quizzes q ON q.classId = c.id
       WHERE q.id = ?`,
      [quizId]
    );
    
    const totalStudents = totalStudentsRows[0]?.totalStudents || 0;
    const completionRate = totalStudents > 0 ? Math.round((totalAttempts / totalStudents) * 100) : 0;

    res.status(200).json({
      quizId,
      averageScore: parseFloat(averageScore.toFixed(2)),
      totalAttempts,
      difficultyLevel,
      completionRate,
      questionPerformance,
      questionAnalysis,
      averageTimeTaken: averageTimeTakenMinutes,
      timeTakenDistribution,
      highestPerformingStudents,
      lowestPerformingStudents,
      topStudents,
      topPerformers,
      scoreDistribution
    });
  } catch (error) {
    console.error('Error fetching per-quiz analytics:', error);
    res.status(500).json({ message: 'Server error fetching per-quiz analytics' });
  }
});

// GET Per-Student Analytics for a specific student in a class
router.get('/student-analytics/:classId/:studentId', authenticateToken, async (req, res) => {
  const { classId, studentId } = req.params;
  const teacherId = req.user.id;

  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Access denied: Only teachers can view student analytics' });
    }

    if (!(await checkTeacherOwnership(teacherId, classId))) {
      return res.status(403).json({ message: 'Access denied: You do not own this class' });
    }

    // Verify student is in this class
    const [enrollmentRows] = await db.pool.query(
      'SELECT id FROM class_enrollments WHERE classId = ? AND studentId = ?',
      [classId, studentId]
    );
    if (enrollmentRows.length === 0) {
      return res.status(404).json({ message: 'Student not enrolled in this class' });
    }

    // Student Name
    const [studentNameRows] = await db.pool.query('SELECT displayName FROM users WHERE id = ?', [studentId]);
    const studentName = studentNameRows[0]?.displayName || 'Unknown Student';

    // Quiz Scores (all completed quizzes by this student in this class)
    const [quizScoresRows] = await db.pool.query(
      `SELECT qa.quizId, q.title as quizTitle, qa.score, qa.totalPoints, qa.submittedAt
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       WHERE qa.studentId = ? AND q.classId = ? AND qa.isCompleted = TRUE
       ORDER BY qa.submittedAt DESC`,
      [studentId, classId]
    );
    const quizScores = quizScoresRows.map(score => ({
      quizId: score.quizId,
      quizTitle: score.quizTitle,
      score: score.score,
      totalPoints: score.totalPoints,
      submittedAt: score.submittedAt,
    }));

    // Average Accuracy
    let totalScoreSum = 0;
    let totalPossiblePointsSum = 0;
    quizScores.forEach(qs => {
      totalScoreSum += qs.score;
      totalPossiblePointsSum += qs.totalPoints;
    });
    const averageAccuracy = totalPossiblePointsSum > 0 ? (totalScoreSum / totalPossiblePointsSum) * 100 : 0;

    // Attendance Rate (number of quizzes attempted / total quizzes assigned to class)
    const [totalQuizzesInClassRows] = await db.pool.query(
      'SELECT COUNT(id) as totalQuizzes FROM quizzes WHERE classId = ? AND isPublished = TRUE',
      [classId]
    );
    const totalQuizzesInClass = totalQuizzesInClassRows[0].totalQuizzes;
    const attendanceRate = totalQuizzesInClass > 0 ? (quizScores.length / totalQuizzesInClass) * 100 : 0;

    res.status(200).json({
      studentId,
      studentName,
      classId,
      quizScores,
      averageAccuracy: parseFloat(averageAccuracy.toFixed(2)),
      attendanceRate: parseFloat(attendanceRate.toFixed(2)),
    });
  } catch (error) {
    console.error('Error fetching per-student analytics:', error);
    res.status(500).json({ message: 'Server error fetching per-student analytics' });
  }
});

// GET Leaderboard for a class (accessible by both teachers and students)
router.get('/leaderboard/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  // Advanced filtering parameters
  const { 
    search, 
    minScore, 
    maxScore, 
    startDate, 
    endDate, 
    limit = 10, 
    offset = 0 
  } = req.query;

  try {
    if (userRole === 'teacher') {
      // Teachers can only see leaderboards for their own classes
      if (!(await checkTeacherOwnership(userId, classId))) {
        return res.status(403).json({ message: 'Access denied: You do not own this class' });
      }
    } else if (userRole === 'student') {
      // Students can only see leaderboards for classes they're enrolled in
      const [enrollmentRows] = await db.pool.query(
        'SELECT id FROM class_enrollments WHERE classId = ? AND studentId = ?',
        [classId, userId]
      );
      if (enrollmentRows.length === 0) {
        return res.status(403).json({ message: 'Access denied: You are not enrolled in this class' });
      }
    }

    // Build the query with filters
    let query = `
      SELECT l.student_rank, u.displayName as studentName, l.totalScore, 
             u.id as studentId, l.updatedAt
      FROM leaderboards l
      JOIN users u ON l.studentId = u.id
      WHERE l.classId = ?
    `;
    
    const queryParams = [classId];

    // Apply search filter
    if (search) {
      query += ' AND u.displayName LIKE ?';
      queryParams.push(`%${search}%`);
    }

    // Apply score range filters
    if (minScore) {
      query += ' AND l.totalScore >= ?';
      queryParams.push(parseInt(minScore));
    }
    
    if (maxScore) {
      query += ' AND l.totalScore <= ?';
      queryParams.push(parseInt(maxScore));
    }

    // Apply date range filters (based on last update to leaderboard)
    if (startDate) {
      query += ' AND l.updatedAt >= ?';
      queryParams.push(new Date(startDate));
    }
    
    if (endDate) {
      query += ' AND l.updatedAt <= ?';
      queryParams.push(new Date(endDate));
    }

    // Add ordering and pagination
    query += ' ORDER BY l.student_rank ASC';
    
    // Get total count for pagination
    const countQuery = query.replace(
      'SELECT l.student_rank, u.displayName as studentName, l.totalScore, u.id as studentId, l.updatedAt',
      'SELECT COUNT(*) as total'
    );
    const [countResult] = await db.pool.query(countQuery, queryParams);
    const totalCount = countResult[0].total;

    // Apply pagination
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [leaderboardRows] = await db.pool.query(query, queryParams);

    // Get additional statistics for the class
    const [statsResult] = await db.pool.query(`
      SELECT 
        COUNT(*) as totalStudents,
        AVG(totalScore) as averageScore,
        MIN(totalScore) as minScore,
        MAX(totalScore) as maxScore
      FROM leaderboards 
      WHERE classId = ?
    `, [classId]);

    const classStats = statsResult[0];

    res.status(200).json({
      leaderboard: leaderboardRows,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
      },
      stats: {
        totalStudents: classStats.totalStudents,
        averageScore: parseFloat(classStats.averageScore.toFixed(2)),
        minScore: classStats.minScore,
        maxScore: classStats.maxScore
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error fetching leaderboard' });
  }
});

// GET My Performance (for students to see their own performance in a class)
router.get('/my-performance/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const studentId = req.user.id;

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can view their own performance' });
  }

  try {
    // Verify student is enrolled in this class
    const [enrollmentRows] = await db.pool.query(
      'SELECT id FROM class_enrollments WHERE classId = ? AND studentId = ?',
      [classId, studentId]
    );
    if (enrollmentRows.length === 0) {
      return res.status(404).json({ message: 'You are not enrolled in this class' });
    }

    // Get student's total score and rank
    const [leaderboardRows] = await db.pool.query(
      'SELECT totalScore, student_rank FROM leaderboards WHERE classId = ? AND studentId = ?',
      [classId, studentId]
    );
    const myPerformance = leaderboardRows.length > 0 ? {
      totalScore: leaderboardRows[0].totalScore || 0,
      student_rank: leaderboardRows[0].student_rank || 'N/A'
    } : {
      totalScore: 0,
      student_rank: 'N/A'
    };

    // Get all quiz scores for this student in this class
    const [quizScoresRows] = await db.pool.query(
      `SELECT q.title as quizTitle, qa.score, qa.totalPoints, qa.submittedAt
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       WHERE qa.studentId = ? AND q.classId = ? AND qa.isCompleted = TRUE
       ORDER BY qa.submittedAt DESC`,
      [studentId, classId]
    );
    const quizScores = quizScoresRows.map(score => ({
      quizTitle: score.quizTitle,
      score: score.score,
      totalPoints: score.totalPoints,
      submittedAt: score.submittedAt,
    }));

    res.status(200).json({
      studentId,
      classId,
      myPerformance,
      quizScores
    });
  } catch (error) {
    console.error('Error fetching my performance:', error);
    res.status(500).json({ message: 'Server error fetching my performance' });
  }
});

// Helper functions for export
async function getClassroomOverview(classId, teacherId) {
  const [rows] = await db.pool.query(
    `SELECT 
      c.name as className,
      COUNT(DISTINCT ce.studentId) as totalStudents,
      COUNT(DISTINCT q.id) as totalQuizzes,
      COUNT(DISTINCT CASE WHEN q.isPublished = TRUE THEN q.id END) as publishedQuizzes
    FROM classes c
    LEFT JOIN class_enrollments ce ON c.id = ce.classId
    LEFT JOIN quizzes q ON c.id = q.classId
    WHERE c.id = ? AND c.teacherId = ?
    GROUP BY c.id, c.name`,
    [classId, teacherId]
  );
  return rows[0] || {};
}

async function getPerQuizAnalytics(quizId, teacherId) {
  const [rows] = await db.pool.query(
    `SELECT 
      q.title,
      AVG(qa.score) as averageScore,
      COUNT(qa.id) as totalAttempts
    FROM quizzes q
    LEFT JOIN quiz_attempts qa ON q.id = qa.quizId AND qa.isCompleted = TRUE
    WHERE q.id = ? AND q.teacherId = ?
    GROUP BY q.id, q.title`,
    [quizId, teacherId]
  );
  return rows[0] || {};
}

async function getPerStudentAnalytics(classId, teacherId) {
  const [rows] = await db.pool.query(
    `SELECT 
      u.displayName as studentName,
      COUNT(DISTINCT qa.quizId) as quizzesAttempted,
      AVG(qa.score) as averageScore
    FROM class_enrollments ce
    JOIN users u ON ce.studentId = u.id
    LEFT JOIN quiz_attempts qa ON ce.studentId = qa.studentId
    LEFT JOIN quizzes q ON qa.quizId = q.id AND q.classId = ?
    WHERE ce.classId = ?
    GROUP BY u.id, u.displayName`,
    [classId, classId]
  );
  return rows;
}

async function getLeaderboardForExport(classId, teacherId) {
  const [rows] = await db.pool.query(
    `SELECT 
      l.student_rank,
      u.displayName as studentName,
      l.totalScore
    FROM leaderboards l
    JOIN users u ON l.studentId = u.id
    WHERE l.classId = ?
    ORDER BY l.student_rank ASC`,
    [classId]
  );
  return rows;
}

function generateCSV(res, data, filename, reportTitle, reportType) {
  try {
    const Papa = require('papaparse');
    let csv = '';
    
    if (Array.isArray(data) && data.length > 0) {
      csv = Papa.unparse(data);
    } else if (typeof data === 'object' && data !== null) {
      csv = Papa.unparse([data]);
    } else {
      csv = Papa.unparse([]);
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send('\ufeff' + csv); // Add BOM for Excel compatibility
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ message: 'Error generating CSV export' });
  }
}

function generatePDF(res, data, filename, reportTitle, reportType) {
  try {
    // Check if pdfkit is available
    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch (e) {
      // Fallback to simple text response if pdfkit not available
      res.setHeader('Content-Type', 'application/json');
      res.status(501).json({ 
        message: 'PDF export not available. Please use CSV export instead.',
        data: data
      });
      return;
    }
    
    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    
    doc.pipe(res);
    doc.fontSize(20).text(reportTitle, { align: 'center' });
    doc.moveDown();
    
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        doc.fontSize(12).text(`Record ${index + 1}:`, { underline: true });
        Object.entries(item).forEach(([key, value]) => {
          doc.fontSize(10).text(`${key}: ${String(value)}`);
        });
        doc.moveDown();
      });
    } else if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        doc.fontSize(10).text(`${key}: ${String(value)}`);
      });
    }
    
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Error generating PDF export' });
  }
}

// GET Export Analytics (CSV/PDF)
router.get('/export', authenticateToken, async (req, res) => {
  const { format, reportType, classId, quizId } = req.query;
  const teacherId = req.user.id;

  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Access denied: Only teachers can export analytics' });
    }

    // Basic authorization: ensure teacher owns the class/quiz if specified
    if (classId && !(await checkTeacherOwnership(teacherId, classId))) {
      return res.status(403).json({ message: 'Access denied: You do not own this class' });
    }
    if (quizId && !(await checkTeacherOwnership(teacherId, null, quizId))) {
      return res.status(403).json({ message: 'Access denied: You do not own this quiz' });
    }

    let dataToExport = [];
    let filename = `${reportType}_report`;
    let reportTitle = '';

    switch (reportType) {
      case 'classroom-overview':
        if (!classId) return res.status(400).json({ message: 'classId is required for classroom-overview export' });
        const overview = await getClassroomOverview(classId, teacherId);
        dataToExport = [overview];
        filename = `classroom_overview_${classId}`;
        reportTitle = 'Classroom Overview Report';
        break;
      case 'per-quiz-analytics':
        if (!quizId) return res.status(400).json({ message: 'quizId is required for per-quiz-analytics export' });
        const quizAnalytics = await getPerQuizAnalytics(quizId, teacherId);
        dataToExport = [quizAnalytics];
        filename = `quiz_analytics_${quizId}`;
        reportTitle = 'Per-Quiz Analytics Report';
        break;
      case 'per-student-analytics':
        if (!classId) return res.status(400).json({ message: 'classId is required for per-student-analytics export' });
        const studentAnalytics = await getPerStudentAnalytics(classId, teacherId);
        dataToExport = studentAnalytics;
        filename = `per_student_analytics_${classId}`;
        reportTitle = 'Per-Student Analytics Report';
        break;
      case 'leaderboard':
        if (!classId) return res.status(400).json({ message: 'classId is required for leaderboard export' });
        const leaderboard = await getLeaderboardForExport(classId, teacherId);
        dataToExport = leaderboard;
        filename = `leaderboard_${classId}`;
        reportTitle = 'Leaderboard Report';
        break;
      default:
        return res.status(400).json({ message: 'Invalid reportType' });
    }

    if (format === 'csv') {
      return generateCSV(res, dataToExport, filename, reportTitle, reportType);
    } else if (format === 'pdf') {
      return generatePDF(res, dataToExport, filename, reportTitle, reportType);
    } else {
      return res.status(400).json({ message: 'Invalid export format' });
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({ message: 'Server error exporting analytics' });
  }
});

module.exports = router;