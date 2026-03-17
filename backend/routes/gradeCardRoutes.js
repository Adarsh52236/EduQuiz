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
         q.title as quizTitle,
         qa.score,
         qa.totalPoints,
         qa.submittedAt
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       WHERE qa.studentId = ? AND q.classId = ? AND qa.isCompleted = TRUE
       ORDER BY qa.submittedAt DESC`,
      [studentId, classId]
    );

    // 4. Calculate average score
    let totalScoreSum = 0;
    let totalPossiblePointsSum = 0;
    attemptedQuizzes.forEach(attempt => {
      totalScoreSum += attempt.score;
      totalPossiblePointsSum += attempt.totalPoints;
    });
    const averageScore = totalPossiblePointsSum > 0 ? (totalScoreSum / totalPossiblePointsSum) * 100 : 0;

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

    doc.fontSize(18).text('Quiz Performance', { underline: true }).moveDown();

    if (attemptedQuizzes.length === 0) {
      doc.fontSize(12).text('No quizzes attempted in this class yet.');
    } else {
      attemptedQuizzes.forEach(attempt => {
        const percentage = attempt.totalPoints > 0 ? (attempt.score / attempt.totalPoints) * 100 : 0;
        doc.fontSize(14).text(`Quiz: ${attempt.quizTitle}`);
        doc.fontSize(12).text(`  Score: ${attempt.score} / ${attempt.totalPoints} (${percentage.toFixed(2)}%)`);
        doc.text(`  Submitted: ${new Date(attempt.submittedAt).toLocaleDateString()}`).moveDown();
      });
    }

    doc.moveDown();
    doc.fontSize(18).text('Overall Summary', { underline: true }).moveDown();
    doc.fontSize(14).text(`Average Score: ${averageScore.toFixed(2)}%`);
    doc.text(`Your Rank in Class: ${studentRank}`).moveDown();

    doc.fontSize(12).text('Teacher Remarks: (To be added by teacher)').moveDown(); // Placeholder for teacher remarks

    doc.end();

  } catch (error) {
    console.error('Error generating grade card:', error);
    res.status(500).json({ message: 'Server error generating grade card' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;