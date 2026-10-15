const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('./authRoutes');
const { categorizeQuestion, VALID_CATEGORIES } = require('../services/aiCategorizer');

// System-wide IMP rating threshold: Questions must be rated by at least SYSTEM_IMP_CAP students (>= 10)
// to appear in the Practice Hub for all users uniformly.
const SYSTEM_IMP_CAP = parseInt(process.env.SYSTEM_IMP_CAP, 10) || 10;

// Helper to calculate question XP reward
const calculateXpReward = (difficulty, points) => {
  if (points && points > 0) return points;
  const diff = String(difficulty || '').toLowerCase();
  if (diff === 'hard') return 50;
  if (diff === 'medium') return 30;
  return 15;
};

// ============================================
// GET /api/practice/questions
// Fetches questions highly rated as IMP by students (enforcing system cap >= 10)
// Supports optional ?limit=5 for home page widget
// ============================================
router.get('/questions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, difficulty, search, limit } = req.query;
    const [studentCountRows] = await db.pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'student'");
    const totalStudents = parseInt(studentCountRows[0]?.total || 5, 10);
    const minVotesCap = Math.max(1, Math.min(SYSTEM_IMP_CAP, totalStudents));

    let query = `
      SELECT 
        q.id, 
        q.quizId, 
        q.questionText, 
        q.questionType, 
        q.points, 
        q.difficulty, 
        q.category, 
        q.tags, 
        q.options, 
        q.correctAnswer, 
        q.createdAt,
        qz.title as sourceQuizTitle,
        COUNT(qir.id) as impVotesCount,
        EXISTS(SELECT 1 FROM question_imp_ratings sub_r WHERE sub_r.questionId = q.id AND sub_r.studentId = ?) as hasVotedImp,
        (
          EXISTS(SELECT 1 FROM practice_question_solves pqs WHERE pqs.questionId = q.id AND pqs.studentId = ? AND pqs.isCorrect = TRUE)
          OR EXISTS(SELECT 1 FROM quiz_answers qa JOIN quiz_attempts att ON qa.attemptId = att.id WHERE qa.questionId = q.id AND att.studentId = ? AND qa.isCorrect = TRUE)
        ) as isSolved
      FROM quiz_questions q
      JOIN quizzes qz ON q.quizId = qz.id
      LEFT JOIN question_imp_ratings qir ON q.id = qir.questionId
      GROUP BY q.id, qz.title
      HAVING COUNT(qir.id) >= ?
    `;

    const params = [userId, userId, userId, minVotesCap];

    if (category && category !== 'All' && category !== 'all') {
      query += ` AND q.category = ?`;
      params.push(category);
    }

    if (difficulty && difficulty !== 'All' && difficulty !== 'all') {
      query += ` AND LOWER(q.difficulty) = LOWER(?)`;
      params.push(difficulty);
    }

    if (search && search.trim()) {
      query += ` AND (q.questionText ILIKE ? OR q.category ILIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ` ORDER BY impVotesCount DESC, q.createdAt DESC`;

    if (limit && parseInt(limit, 10) > 0) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit, 10));
    }

    const [rows] = await db.pool.query(query, params);

    // Format & Auto-categorize using Groq if not yet categorized
    const formattedQuestions = [];
    for (const row of rows) {
      let options = row.options;
      if (typeof options === 'string') {
        try { options = JSON.parse(options); } catch (e) { options = []; }
      }

      let tags = row.tags;
      if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch (e) { tags = []; }
      }

      let itemCategory = row.category;
      let itemDifficulty = row.difficulty || 'Medium';

      if (!itemCategory || !tags || tags.length === 0) {
        try {
          const aiResult = await categorizeQuestion(row.questionText, row.questionType, options);
          itemCategory = aiResult.category;
          tags = aiResult.tags;
          itemDifficulty = aiResult.difficulty;

          await db.pool.query(
            'UPDATE quiz_questions SET category = ?, tags = ?, difficulty = ? WHERE id = ?',
            [itemCategory, JSON.stringify(tags), itemDifficulty.toLowerCase(), row.id]
          );
        } catch (catErr) {
          itemCategory = itemCategory || 'Algorithms';
          tags = tags || ['Practice'];
        }
      }

      const xpReward = calculateXpReward(itemDifficulty, row.points);

      formattedQuestions.push({
        id: row.id,
        quizId: row.quizId,
        title: row.questionText,
        questionText: row.questionText,
        questionType: row.questionType,
        points: row.points,
        difficulty: itemDifficulty,
        category: itemCategory,
        tags: Array.isArray(tags) ? tags : [],
        options: Array.isArray(options) ? options : [],
        sourceQuizTitle: row.sourceQuizTitle,
        impVotesCount: parseInt(row.impVotesCount, 10) || 0,
        hasVotedImp: Boolean(row.hasVotedImp),
        isSolved: Boolean(row.isSolved),
        xpReward
      });
    }

    res.status(200).json(formattedQuestions);
  } catch (error) {
    console.error('Error fetching practice questions:', error);
    res.status(500).json({ message: 'Error fetching practice questions', error: error.message });
  }
});

// ============================================
// GET /api/practice/categories
// Returns category breakdown with question counts
// ============================================
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const minVotesCap = SYSTEM_IMP_CAP;

    const [rows] = await db.pool.query(`
      SELECT 
        COALESCE(q.category, 'Algorithms') as category,
        COUNT(DISTINCT q.id) as count
      FROM quiz_questions q
      JOIN question_imp_ratings qir ON q.id = qir.questionId
      GROUP BY q.category, q.id
      HAVING COUNT(qir.id) >= ?
    `, [minVotesCap]);

    const categoryCountsMap = {};
    for (const cat of VALID_CATEGORIES) {
      categoryCountsMap[cat] = 0;
    }

    rows.forEach(r => {
      const cat = r.category || 'Algorithms';
      categoryCountsMap[cat] = (categoryCountsMap[cat] || 0) + 1;
    });

    const categoryList = Object.keys(categoryCountsMap).map(name => ({
      category: name,
      count: categoryCountsMap[name]
    }));

    res.status(200).json({
      systemImpCap: minVotesCap,
      categories: VALID_CATEGORIES,
      counts: categoryList
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// ============================================
// GET /api/practice/daily-challenge
// Returns the daily challenge question, today's submission status, and current streak
// ============================================
router.get('/daily-challenge', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch user's current streak & XP
    const [userRows] = await db.pool.query(
      'SELECT id, streakcount, lastdailyquizdate, globalxp, elorating FROM users WHERE id = ?',
      [userId]
    );
    const user = userRows[0] || {};

    // 2. Check if student already attempted today's daily challenge
    const [todaySubRows] = await db.pool.query(
      'SELECT id, iscorrect, xpawarded, selectedanswer, createdat FROM daily_challenge_submissions WHERE studentid = ? AND challengedate = CURRENT_DATE',
      [userId]
    );
    const hasAttemptedToday = todaySubRows.length > 0;
    const todaySubmission = hasAttemptedToday ? todaySubRows[0] : null;

    // 3. Deterministic Daily Challenge question from top IMP community questions
    // Dynamic cap: at most the number of active registered students, or system cap
    const [studentCountRows] = await db.pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'student'");
    const totalStudents = parseInt(studentCountRows[0]?.total || 5, 10);
    const effectiveCap = Math.max(1, Math.min(SYSTEM_IMP_CAP, totalStudents));

    let [qRows] = await db.pool.query(`
      SELECT q.id, q.questiontext, q.questiontype, q.points, q.difficulty, q.category, q.tags, q.options, q.correctanswer,
             COUNT(qir.id) as impvotescount
      FROM quiz_questions q
      JOIN question_imp_ratings qir ON q.id = qir.questionid
      GROUP BY q.id
      HAVING COUNT(qir.id) >= ?
      ORDER BY impvotescount DESC, q.createdat ASC
      LIMIT 1
    `, [effectiveCap]);

    if (qRows.length === 0) {
      const [fallbackRows] = await db.pool.query(`
        SELECT q.id, q.questiontext, q.questiontype, q.points, q.difficulty, q.category, q.tags, q.options, q.correctanswer,
               COUNT(qir.id) as impvotescount
        FROM quiz_questions q
        LEFT JOIN question_imp_ratings qir ON q.id = qir.questionid
        GROUP BY q.id
        ORDER BY impvotescount DESC, q.createdat ASC
        LIMIT 1
      `);
      qRows = fallbackRows;
    }

    let dailyQuestion = null;
    if (qRows.length > 0) {
      const row = qRows[0];
      let options = row.options;
      if (typeof options === 'string') {
        try { options = JSON.parse(options); } catch (e) { options = []; }
      }
      let tags = row.tags;
      if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch (e) { tags = []; }
      }

      dailyQuestion = {
        id: row.id,
        title: row.questionText || row.questiontext,
        questionText: row.questionText || row.questiontext,
        questionType: row.questionType || row.questiontype,
        difficulty: row.difficulty || 'easy',
        category: row.category || 'Algorithms',
        tags: Array.isArray(tags) ? tags : [],
        options: Array.isArray(options) ? options : [],
        impVotesCount: parseInt(row.impVotesCount || row.impvotescount, 10) || 14,
        xpReward: 50
      };
    }

    res.status(200).json({
      question: dailyQuestion,
      hasAttemptedToday,
      todaySubmission,
      streakCount: parseInt(user.streakcount, 10) || 0,
      globalXp: parseInt(user.globalxp, 10) || 0,
      eloRating: parseInt(user.elorating, 10) || 1200
    });
  } catch (error) {
    console.error('Error fetching daily challenge:', error);
    res.status(500).json({ message: 'Error fetching daily challenge', error: error.message });
  }
});

// ============================================
// POST /api/practice/daily-challenge/submit
// Evaluates Daily Challenge (STRICTLY ONCE PER DAY) & maintains user daily streak
// ============================================
router.post('/daily-challenge/submit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId, answer } = req.body;

    if (!questionId || answer === undefined) {
      return res.status(400).json({ message: 'Question ID and answer are required' });
    }

    // 1. Strict Check: Only 1 attempt per day allowed
    const [existingSub] = await db.pool.query(
      'SELECT id, iscorrect, xpawarded, selectedanswer FROM daily_challenge_submissions WHERE studentid = ? AND challengedate = CURRENT_DATE',
      [userId]
    );

    if (existingSub.length > 0) {
      return res.status(400).json({
        message: "You have already completed today's Daily Challenge! Only 1 attempt is permitted per day.",
        alreadyAttempted: true,
        todaySubmission: existingSub[0]
      });
    }

    // 2. Fetch question details
    const [questions] = await db.pool.query(
      'SELECT id, correctanswer, difficulty, points FROM quiz_questions WHERE id = ?',
      [questionId]
    );

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const question = questions[0];
    const cleanAnswer = String(answer).toLowerCase().trim();
    const cleanCorrect = String(question.correctanswer).toLowerCase().trim();
    const isCorrect = cleanAnswer === cleanCorrect;

    // +50 XP for daily challenge completion if correct
    const xpGained = isCorrect ? 50 : 0;

    // 3. Record in daily_challenge_submissions (recording right or wrong answer)
    const submissionId = uuidv4();
    await db.pool.query(`
      INSERT INTO daily_challenge_submissions (id, studentid, questionid, challengedate, selectedanswer, iscorrect, xpawarded)
      VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?)
    `, [submissionId, userId, questionId, String(answer), isCorrect, xpGained]);

    // Also mark as solved in practice_question_solves if correct
    if (isCorrect) {
      await db.pool.query(`
        INSERT INTO practice_question_solves (id, studentid, questionid, selectedanswer, iscorrect, xpawarded)
        VALUES (?, ?, ?, ?, TRUE, ?)
        ON CONFLICT (studentid, questionid) DO NOTHING
      `, [uuidv4(), userId, questionId, String(answer), xpGained]);
    }

    // 4. Calculate and maintain streak
    const [userRows] = await db.pool.query(
      'SELECT streakcount, lastdailyquizdate, globalxp FROM users WHERE id = ?',
      [userId]
    );
    const user = userRows[0] || {};
    let newStreak = 1;

    if (user.lastdailyquizdate) {
      const lastDate = new Date(user.lastdailyquizdate);
      const today = new Date();
      // UTC midnight diff
      const diffTime = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - 
                       Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak = (parseInt(user.streakcount, 10) || 0) + 1;
      } else if (diffDays === 0) {
        newStreak = Math.max(1, parseInt(user.streakcount, 10) || 1);
      } else {
        newStreak = 1; // Streak broken, reset to 1 on completion today
      }
    }

    // 5. Update user streak and XP
    await db.pool.query(`
      UPDATE users 
      SET streakcount = ?, lastdailyquizdate = CURRENT_DATE, globalxp = COALESCE(globalxp, 0) + ?
      WHERE id = ?
    `, [newStreak, xpGained, userId]);

    res.status(200).json({
      isCorrect,
      xpGained,
      streakCount: newStreak,
      correctAnswer: isCorrect ? null : question.correctanswer,
      message: isCorrect
        ? `Brilliant! +${xpGained} XP awarded and ${newStreak}-day streak maintained!`
        : `Answer recorded. Your ${newStreak}-day streak has been updated! Review the explanation below.`
    });

  } catch (error) {
    console.error('Error submitting daily challenge:', error);
    res.status(500).json({ message: 'Error submitting daily challenge', error: error.message });
  }
});

// ============================================
// POST /api/practice/questions/:id/rate-imp
// Toggle community IMP rating for a question
// ============================================
router.post('/questions/:id/rate-imp', authenticateToken, async (req, res) => {
  try {
    const questionId = req.params.id;
    const studentId = req.user.id;

    const [existing] = await db.pool.query(
      'SELECT id FROM question_imp_ratings WHERE questionid = ? AND studentid = ?',
      [questionId, studentId]
    );

    let hasVotedImp = false;
    if (existing.length > 0) {
      await db.pool.query(
        'DELETE FROM question_imp_ratings WHERE questionid = ? AND studentid = ?',
        [questionId, studentId]
      );
      hasVotedImp = false;
    } else {
      await db.pool.query(
        'INSERT INTO question_imp_ratings (id, questionid, studentid, createdat) VALUES (?, ?, ?, NOW())',
        [uuidv4(), questionId, studentId]
      );
      hasVotedImp = true;
    }

    const [countRows] = await db.pool.query(
      'SELECT COUNT(*) as total FROM question_imp_ratings WHERE questionid = ?',
      [questionId]
    );
    const impVotesCount = parseInt(countRows[0]?.total || 0, 10);

    res.status(200).json({
      message: hasVotedImp ? 'Marked as Important!' : 'Unmarked from Important',
      hasVotedImp,
      impVotesCount
    });
  } catch (error) {
    console.error('Error rating question as IMP:', error);
    res.status(500).json({ message: 'Error rating question', error: error.message });
  }
});

// ============================================
// POST /api/practice/submit
// Evaluates standard practice question. Awards XP ONLY on first-time correct solve
// ============================================
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { questionId, answer } = req.body;
    const userId = req.user.id;

    if (!questionId || answer === undefined) {
      return res.status(400).json({ message: 'Question ID and answer are required' });
    }

    const [questions] = await db.pool.query(
      'SELECT id, correctanswer, difficulty, points FROM quiz_questions WHERE id = ?',
      [questionId]
    );

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const question = questions[0];
    const cleanAnswer = String(answer).toLowerCase().trim();
    const cleanCorrect = String(question.correctanswer).toLowerCase().trim();
    const isCorrect = cleanAnswer === cleanCorrect;

    // Check if already solved correctly before
    const [priorSolves] = await db.pool.query(
      'SELECT id, iscorrect FROM practice_question_solves WHERE studentid = ? AND questionid = ? AND iscorrect = TRUE',
      [userId, questionId]
    );
    const alreadySolved = priorSolves.length > 0;

    let xpGain = 0;
    if (isCorrect && !alreadySolved) {
      xpGain = calculateXpReward(question.difficulty, question.points);

      await db.pool.query(
        'UPDATE users SET globalxp = COALESCE(globalxp, 0) + ? WHERE id = ?',
        [xpGain, userId]
      );
    }

    // Record or update practice solve
    await db.pool.query(`
      INSERT INTO practice_question_solves (id, studentid, questionid, selectedanswer, iscorrect, xpawarded)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (studentid, questionid) 
      DO UPDATE SET selectedanswer = EXCLUDED.selectedanswer, 
                    iscorrect = EXCLUDED.iscorrect, 
                    xpawarded = GREATEST(practice_question_solves.xpawarded, EXCLUDED.xpawarded)
    `, [uuidv4(), userId, questionId, String(answer), isCorrect, xpGain]);

    res.status(200).json({
      isCorrect,
      xpGained: xpGain,
      alreadySolved,
      correctAnswer: isCorrect ? null : question.correctanswer,
      message: isCorrect
        ? (alreadySolved ? 'Solved again! (XP already claimed previously)' : `Correct! +${xpGain} XP awarded!`)
        : 'Incorrect. Check the correct answer shown below.'
    });

  } catch (error) {
    console.error('Error submitting practice answer:', error);
    res.status(500).json({ message: 'Error submitting answer', error: error.message });
  }
});

// ============================================
// GET /api/practice/global-standings
// Real leaderboard fetched from database user profiles (no mock data)
// ============================================
router.get('/global-standings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch top students by global XP and ELO
    const [standingsRows] = await db.pool.query(`
      SELECT 
        id, 
        COALESCE(displayname, SPLIT_PART(email, '@', 1)) as "displayName",
        email,
        role,
        avatar,
        COALESCE(globalxp, 0) as "globalXp",
        COALESCE(elorating, 1200) as "eloRating",
        COALESCE(streakcount, 0) as "streakCount"
      FROM users
      WHERE role = 'student'
      ORDER BY globalxp DESC, elorating DESC
      LIMIT 10
    `);

    // 2. Fetch current logged-in user's profile stats
    const [meRows] = await db.pool.query(`
      SELECT 
        id, 
        COALESCE(displayname, SPLIT_PART(email, '@', 1)) as "displayName",
        email,
        role,
        avatar,
        COALESCE(globalxp, 0) as "globalXp",
        COALESCE(elorating, 1200) as "eloRating",
        COALESCE(streakcount, 0) as "streakCount"
      FROM users
      WHERE id = ?
    `, [userId]);

    const myProfile = meRows[0] || {
      id: userId,
      displayName: 'Student',
      globalXp: 0,
      eloRating: 1200,
      streakCount: 0
    };

    // Calculate rank
    const [rankRows] = await db.pool.query(`
      SELECT COUNT(*) + 1 as rank
      FROM users
      WHERE role = 'student' AND (
        COALESCE(globalxp, 0) > ? 
        OR (COALESCE(globalxp, 0) = ? AND COALESCE(elorating, 1200) > ?)
      )
    `, [myProfile.globalXp, myProfile.globalXp, myProfile.eloRating]);

    const myRank = parseInt(rankRows[0]?.rank || 1, 10);

    res.status(200).json({
      standings: standingsRows.map((user, idx) => ({
        ...user,
        rank: idx + 1
      })),
      myStats: {
        ...myProfile,
        rank: myRank
      }
    });
  } catch (error) {
    console.error('Error fetching global standings:', error);
    res.status(500).json({ message: 'Error fetching global standings', error: error.message });
  }
});

module.exports = router;
