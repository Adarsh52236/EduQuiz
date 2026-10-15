require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

async function seedRatings() {
  console.log('--- Seeding mock students & IMP ratings for >= 10 Cap ---');
  
  // 1. Ensure at least 15 mock student users exist
  const studentIds = [];
  
  // Get existing students
  const [existingStudents] = await db.pool.query("SELECT id FROM users WHERE role = 'student'");
  existingStudents.forEach(s => studentIds.push(s.id));
  
  // Add additional mock students if needed up to 15
  while (studentIds.length < 16) {
    const newId = uuidv4();
    const idx = studentIds.length + 1;
    await db.pool.query(`
      INSERT INTO users (id, email, password, displayname, role)
      VALUES ($1, $2, $3, $4, 'student')
      ON CONFLICT (id) DO NOTHING
    `, [newId, `student_peer_${idx}@school.edu`, '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890', `Student Peer ${idx}`]);
    studentIds.push(newId);
  }
  
  console.log(`Available student pool for community voting: ${studentIds.length} students`);

  // Target questions to have >= 10 votes:
  // q_merge_sort: 14 votes
  // q_two_sum: 12 votes
  // q_sql_index: 11 votes
  // q_stack_lifo: 10 votes
  // q_dp_knapsack: 10 votes
  //
  // Non-qualifying questions (< 10 votes):
  // q_os_deadlock: 4 votes (does not meet 10 cap)
  
  const questionVoteTargets = [
    { questionId: 'q_merge_sort', targetVotes: 14 },
    { questionId: 'q_two_sum', targetVotes: 12 },
    { questionId: 'q_sql_index', targetVotes: 11 },
    { questionId: 'q_stack_lifo', targetVotes: 10 },
    { questionId: 'q_dp_knapsack', targetVotes: 10 },
    { questionId: 'q_os_deadlock', targetVotes: 4 }
  ];

  for (const { questionId, targetVotes } of questionVoteTargets) {
    for (let i = 0; i < targetVotes && i < studentIds.length; i++) {
      const studentId = studentIds[i];
      await db.pool.query(`
        INSERT INTO question_imp_ratings (id, questionid, studentid)
        VALUES ($1, $2, $3)
        ON CONFLICT (questionid, studentid) DO NOTHING
      `, [uuidv4(), questionId, studentId]);
    }
  }

  // Display summary
  const [summary] = await db.pool.query(`
    SELECT q.id, q.category, COUNT(r.id) as votes,
      CASE WHEN COUNT(r.id) >= 10 THEN 'QUALIFIED (>=10)' ELSE 'BELOW CAP (<10)' END as status
    FROM quiz_questions q
    LEFT JOIN question_imp_ratings r ON q.id = r.questionid
    GROUP BY q.id, q.category
    ORDER BY votes DESC
  `);
  
  console.table(summary);
  console.log('Seeding completed successfully!');
  process.exit(0);
}

seedRatings().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
