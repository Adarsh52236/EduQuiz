require('dotenv').config();
const db = require('./db');

async function seed() {
  try {
    const [classes] = await db.pool.query("SELECT id, teacherId FROM classes WHERE classCode = 'T4U5H6UK'");
    if (classes.length === 0) {
      console.log('Class T4U5H6UK not found');
      process.exit(1);
    }
    const classId = classes[0].id;
    const teacherId = classes[0].teacherId;

    // 1. Active Quiz (started 1 hour ago, due in 2 days)
    const activeQuizId = 'quiz_algo_active';
    await db.pool.query(
      `INSERT INTO quizzes (id, title, description, type, classId, teacherId, timeLimit, totalPoints, startTime, endTime, isPublished) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 days', TRUE) 
       ON CONFLICT (id) DO UPDATE SET startTime = NOW() - INTERVAL '1 hour', endTime = NOW() + INTERVAL '2 days'`,
      [activeQuizId, 'Algorithms & Complexity Test', 'Comprehensive test covering Big-O, sorting, and dynamic programming.', 'multiple-choice', classId, teacherId, 45, 100]
    );

    // Questions for active quiz
    await db.pool.query(
      `INSERT INTO quiz_questions (id, quizId, questionText, questionType, points, options, correctAnswer, orderIndex) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
       ON CONFLICT (id) DO NOTHING`,
      ['q_algo_1', activeQuizId, 'What is the worst-case time complexity of Merge Sort?', 'multiple-choice', 50, JSON.stringify(['O(n)', 'O(n log n)', 'O(n^2)', 'O(log n)']), 'O(n log n)', 1]
    );
    await db.pool.query(
      `INSERT INTO quiz_questions (id, quizId, questionText, questionType, points, options, correctAnswer, orderIndex) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
       ON CONFLICT (id) DO NOTHING`,
      ['q_algo_2', activeQuizId, 'Which data structure uses LIFO order?', 'multiple-choice', 50, JSON.stringify(['Queue', 'Stack', 'Linked List', 'Binary Tree']), 'Stack', 2]
    );

    // 2. Upcoming Quiz (starts tomorrow, ends in 3 days)
    const upcomingQuizId = 'quiz_ds_upcoming';
    await db.pool.query(
      `INSERT INTO quizzes (id, title, description, type, classId, teacherId, timeLimit, totalPoints, startTime, endTime, isPublished) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 days', TRUE) 
       ON CONFLICT (id) DO UPDATE SET startTime = NOW() + INTERVAL '1 day', endTime = NOW() + INTERVAL '3 days'`,
      [upcomingQuizId, 'Data Structures Midterm', 'Advanced Tree Traversals, Hash Tables, and Heaps.', 'multiple-choice', classId, teacherId, 30, 50]
    );

    // 3. Expired / Past Deadline Quiz (started 3 days ago, ended yesterday)
    const expiredQuizId = 'quiz_past_deadline';
    await db.pool.query(
      `INSERT INTO quizzes (id, title, description, type, classId, teacherId, timeLimit, totalPoints, startTime, endTime, isPublished) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', TRUE) 
       ON CONFLICT (id) DO UPDATE SET startTime = NOW() - INTERVAL '3 days', endTime = NOW() - INTERVAL '1 day'`,
      [expiredQuizId, 'Week 1 Diagnostic Pop Quiz', 'Basic syntax and control flow check.', 'multiple-choice', classId, teacherId, 15, 25]
    );

    console.log('✅ Successfully seeded active, upcoming, and expired quizzes.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding quizzes:', err);
    process.exit(1);
  }
}

seed();
