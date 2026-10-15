const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const db = require('../db');
const { authenticateToken } = require('./authRoutes');

router.get('/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const studentId = req.user.id;

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can generate grade cards' });
  }

  let connection;
  try {
    connection = await db.pool.getConnection();

    // 1. Verify student is enrolled in the class
    const [enrollmentRows] = await connection.query(
      'SELECT id FROM class_enrollments WHERE classId = ? AND studentId = ?',
      [classId, studentId]
    );
    if (enrollmentRows.length === 0) {
      return res.status(404).json({ message: 'You are not enrolled in this class' });
    }

    // 2. Fetch student and class details
    const [studentRows] = await connection.query('SELECT displayName, id FROM users WHERE id = ?', [studentId]);
    const student = studentRows[0];

    const [classRows] = await connection.query('SELECT name FROM classes WHERE id = ?', [classId]);
    const className = classRows[0].name;

    // 3. Fetch all attempted quizzes for this student in this class
    const [attemptedQuizzes] = await connection.query(
      `SELECT 
         qa.id,
         qa.quizId,
         q.title as quizTitle,
         qa.score,
         qa.totalPoints,
         qa.submittedAt,
         qa.startedAt
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       WHERE qa.studentId = ? AND q.classId = ? AND qa.isCompleted = TRUE
       ORDER BY qa.quizId, qa.submittedAt ASC`,
      [studentId, classId]
    );

    // Group attempts by quizId
    const attemptsByQuiz = {};
    attemptedQuizzes.forEach(att => {
      if (!attemptsByQuiz[att.quizId]) attemptsByQuiz[att.quizId] = [];
      attemptsByQuiz[att.quizId].push(att);
    });

    const enrichedAttempts = [];
    let totalBestScoreSum = 0;
    let totalBestPossibleSum = 0;

    Object.keys(attemptsByQuiz).forEach(qId => {
      const quizAtts = [...attemptsByQuiz[qId]].sort((a, b) =>
        new Date(a.submittedAt || a.startedAt).getTime() - new Date(b.submittedAt || b.startedAt).getTime()
      );

      let bestPct = -1;
      quizAtts.forEach(a => {
        const pct = a.totalPoints > 0 ? (a.score / a.totalPoints) * 100 : 0;
        if (pct > bestPct) bestPct = pct;
      });

      const bestAtt = quizAtts.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), quizAtts[0]);
      totalBestScoreSum += bestAtt.score;
      totalBestPossibleSum += bestAtt.totalPoints;

      quizAtts.forEach((a, idx) => {
        const pct = a.totalPoints > 0 ? (a.score / a.totalPoints) * 100 : 0;
        enrichedAttempts.push({
          ...a,
          attemptNumber: idx + 1,
          percentage: pct,
          isLatest: idx === quizAtts.length - 1,
          isBest: Math.round(pct) === Math.round(bestPct) && bestPct >= 0
        });
      });
    });

    // Sort newest attempts first for PDF list
    enrichedAttempts.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    // 4. Calculate average score using best score per unique quiz
    const averageScore = totalBestPossibleSum > 0 ? (totalBestScoreSum / totalBestPossibleSum) * 100 : 0;

    // 5. Fetch student's rank in the class leaderboard
    const [leaderboardRows] = await connection.query(
      'SELECT student_rank FROM leaderboards WHERE classId = ? AND studentId = ?',
      [classId, studentId]
    );
    const studentRank = leaderboardRows.length > 0 ? leaderboardRows[0].student_rank : 'N/A';

    // 6. Generate PDF
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="grade_card_${student.displayName.replace(/\s/g, '_')}_${className.replace(/\s/g, '_')}.pdf"`);
    doc.pipe(res);

    doc.fontSize(24).text('EduQuiz Grade Card', { align: 'center' }).moveDown();

    doc.fontSize(16).text(`Student Name: ${student.displayName}`);
    doc.text(`Student ID: ${student.id}`);
    doc.text(`Class: ${className}`).moveDown();

    doc.fontSize(18).text('Quiz Performance & Attempt History', { underline: true }).moveDown();

    if (enrichedAttempts.length === 0) {
      doc.fontSize(12).text('No quizzes attempted in this class yet.');
    } else {
      enrichedAttempts.forEach(attempt => {
        const tags = [];
        if (attempt.isBest) tags.push('Best Score');
        if (attempt.isLatest) tags.push('Latest Attempt');
        const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';

        doc.fontSize(14).text(`Quiz: ${attempt.quizTitle} (Attempt #${attempt.attemptNumber}${tagStr})`);
        doc.fontSize(12).text(`  Score: ${attempt.score} / ${attempt.totalPoints} (${attempt.percentage.toFixed(2)}%)`);
        doc.text(`  Submitted: ${new Date(attempt.submittedAt).toLocaleString()}`).moveDown();
      });
    }

    doc.moveDown();
    doc.fontSize(18).text('Overall Academic Summary', { underline: true }).moveDown();
    doc.fontSize(14).text(`Average Score (Best per quiz): ${averageScore.toFixed(2)}%`);
    doc.fontSize(12).text(`Total Quizzes Evaluated: ${Object.keys(attemptsByQuiz).length} (${enrichedAttempts.length} total attempts)`);
    doc.fontSize(14).text(`Your Rank in Class: ${studentRank}`).moveDown();

    doc.fontSize(12).text('Teacher Remarks: Verified academic record from EduQuiz.').moveDown();

    doc.end();

  } catch (error) {
    console.error('Error generating grade card:', error);
    res.status(500).json({ message: 'Server error generating grade card' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;