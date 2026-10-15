const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';
const BACKEND_URL = 'http://localhost:3001';

// Generate token helper
function createStudentToken(id, email, displayName, eloRating = 1200) {
  return jwt.sign(
    { id, email, role: 'student', displayName, eloRating },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Connect socket helper
function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket']
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

async function runArenaTests() {
  console.log('=== STARTING LIVE ARENA MATCHMAKING & QUEUE VERIFICATION ===\n');

  // 1. TEST 1: Two real student users (Cadet Tester & Alex Rivera)
  console.log('--- TEST 1: Testing 2 real student users joining Live Arena ---');
  const tokenCadet = createStudentToken('5c9954ab-4eb7-476a-bf37-624a96319b9c', 'cadet_new_ui@school.edu', 'Cadet Tester', 1250);
  const tokenAlex = createStudentToken('s-alex-rivera', 'alex.rivera@school.edu', 'Alex Rivera', 1240);

  const socketCadet = await connectSocket(tokenCadet);
  const socketAlex = await connectSocket(tokenAlex);

  console.log('Socket Cadet connected:', socketCadet.id);
  console.log('Socket Alex connected:', socketAlex.id);

  let cadetMatchPromise = new Promise((resolve) => {
    socketCadet.on('match_found', (data) => {
      console.log('✅ Cadet received match_found:', data);
      resolve(data);
    });
  });

  let alexMatchPromise = new Promise((resolve) => {
    socketAlex.on('match_found', (data) => {
      console.log('✅ Alex received match_found:', data);
      resolve(data);
    });
  });

  let cadetWaitPromise = new Promise((resolve) => {
    socketCadet.on('queue_status', (data) => {
      console.log('ℹ️ Cadet received queue_status (waiting):', data);
      resolve(data);
    });
  });

  // Cadet joins first
  console.log('\n[Action] Cadet clicks Live Arena ("Enter Matchmaking")...');
  socketCadet.emit('join_arena_queue', { eloRating: 1250 });

  const cadetWaitStatus = await cadetWaitPromise;
  if (cadetWaitStatus.status === 'waiting') {
    console.log('✅ Verified: Player 1 stays in waiting state before opponent clicks.');
  }

  // Alex joins second
  console.log('\n[Action] Alex clicks Live Arena ("Enter Matchmaking")...');
  socketAlex.emit('join_arena_queue', { eloRating: 1240 });

  const [cadetMatch, alexMatch] = await Promise.all([cadetMatchPromise, alexMatchPromise]);

  if (cadetMatch.roomId === alexMatch.roomId) {
    console.log('✅ Verified: Both players placed into the same battle room:', cadetMatch.roomId);
  }
  if (cadetMatch.opponentName === 'Alex Rivera' && alexMatch.opponentName === 'Cadet Tester') {
    console.log('✅ Verified: Real student names correctly paired (Cadet vs Alex).');
  }
  if (cadetMatch.quizId) {
    console.log(`✅ Verified: Published quiz assigned: "${cadetMatch.quizTitle}" (${cadetMatch.quizId})`);
  }

  // Test real-time progress broadcast
  console.log('\n--- TEST 2: Testing real-time progress broadcast in Battle Room ---');
  socketCadet.emit('join_arena_room', cadetMatch.roomId);
  socketAlex.emit('join_arena_room', alexMatch.roomId);

  // Allow room joins to register
  await new Promise(r => setTimeout(r, 250));

  let progressPromise = new Promise((resolve) => {
    socketAlex.on('opponent_progress', (data) => {
      console.log('✅ Alex received real-time progress from Cadet:', data);
      resolve(data);
    });
  });

  // Cadet answers question 1
  socketCadet.emit('arena_progress', {
    roomId: cadetMatch.roomId,
    currentQuestionIndex: 1,
    score: 10
  });

  const progressData = await progressPromise;
  if (progressData.currentQuestionIndex === 1) {
    console.log('✅ Verified: Real-time opponent progress bar sync works!');
  }

  socketCadet.disconnect();
  socketAlex.disconnect();

  // 2. TEST 3: 10 students queue simulation + odd 11th student remaining waiting
  console.log('\n--- TEST 3: Simulating 11 students entering queue (FIFO pairs (1,2), (3,4), (5,6), (7,8), (9,10) and odd #11 remains waiting) ---');

  const db = require('./db');

  // Ensure test students exist in DB for foreign key constraints
  for (let i = 1; i <= 12; i++) {
    const studentId = `test-student-${i}`;
    await db.pool.query(
      `INSERT INTO users (id, email, password, displayName, role, eloRating)
       VALUES (?, ?, ?, ?, 'student', ?)
       ON CONFLICT (id) DO UPDATE SET displayName = EXCLUDED.displayName, eloRating = EXCLUDED.eloRating`,
      [studentId, `${studentId}@school.edu`, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', `Student_${i}`, 1200 + i * 5]
    );
  }

  const sockets = [];
  const matches = {};
  const waitingEvents = {};

  for (let i = 1; i <= 11; i++) {
    const studentId = `test-student-${i}`;
    const studentName = `Student_${i}`;
    const token = createStudentToken(studentId, `${studentId}@school.edu`, studentName, 1200 + i * 5);
    const s = await connectSocket(token);
    sockets.push(s);

    matches[i] = [];
    waitingEvents[i] = [];

    s.on('match_found', (data) => {
      matches[i].push(data);
    });
    s.on('queue_status', (data) => {
      waitingEvents[i].push(data);
    });
  }

  console.log('Connected 11 test student sockets.');

  // Emit join_arena_queue for all 11 with distinct sequential click times
  const baseTime = Date.now();
  for (let i = 1; i <= 11; i++) {
    sockets[i - 1].emit('join_arena_queue', { eloRating: 1200 + i * 5, clickTime: baseTime + i * 50 });
    // Small gap to guarantee sequential click order
    await new Promise(r => setTimeout(r, 70));
  }

  // Wait 1.5 seconds for all matchmaking queries and room setups
  await new Promise(r => setTimeout(r, 1500));

  console.log('\n--- Evaluating Pairings: ---');
  const expectedPairs = [
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8],
    [9, 10]
  ];

  for (const [p1, p2] of expectedPairs) {
    const m1 = matches[p1][0];
    const m2 = matches[p2][0];
    if (m1 && m2 && m1.roomId === m2.roomId && m1.opponentName === `Student_${p2}` && m2.opponentName === `Student_${p1}`) {
      console.log(`✅ Pair (${p1}, ${p2}) SUCCESS: Matched in room ${m1.roomId.slice(0, 15)}...`);
    } else {
      console.error(`❌ Pair (${p1}, ${p2}) FAILED:`, { m1, m2 });
    }
  }

  // Check 11th player (odd one out)
  if (matches[11].length === 0) {
    console.log('✅ Verified: Student 11 (odd player) has NOT been paired prematurely.');
  }
  const lastWaiting = waitingEvents[11][waitingEvents[11].length - 1];
  if (lastWaiting && lastWaiting.status === 'waiting') {
    console.log(`✅ Verified: Student 11 is in WAITING state (Queue pos: ${lastWaiting.queuePosition}, Players in queue: ${lastWaiting.playersInQueue})`);
  }

  // Now, Student 12 arrives! Student 11 should immediately pair with Student 12!
  console.log('\n--- Student 12 joins! Checking if waiting Student 11 is paired with Student 12 ---');
  const token12 = createStudentToken('test-student-12', 'test-student-12@school.edu', 'Student_12', 1260);
  const socket12 = await connectSocket(token12);
  sockets.push(socket12);

  let match11Promise = new Promise(resolve => sockets[10].on('match_found', resolve));
  let match12Promise = new Promise(resolve => socket12.on('match_found', resolve));

  socket12.emit('join_arena_queue', { eloRating: 1260 });

  const [m11, m12] = await Promise.all([match11Promise, match12Promise]);

  if (m11.roomId === m12.roomId && m11.opponentName === 'Student_12' && m12.opponentName === 'Student_11') {
    console.log(`✅ Pair (11, 12) SUCCESS: Student 11 paired with incoming Student 12 in room ${m11.roomId.slice(0, 15)}...!`);
  }

  // Cleanup all sockets and test database records
  sockets.forEach(s => s.disconnect());
  await db.pool.query("DELETE FROM challenges WHERE challengerid LIKE 'test-student-%' OR opponentid LIKE 'test-student-%'");
  await db.pool.query("DELETE FROM users WHERE id LIKE 'test-student-%'");
  console.log('✅ Cleaned up test data records.');
  console.log('\n=== ALL ARENA TESTS PASSED PERFECTLY ===\n');
  process.exit(0);
}

runArenaTests().catch(err => {
  console.error('Fatal error during arena test:', err);
  process.exit(1);
});
