const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// In-memory FIFO queue for matchmaking
// Entries: { userId, socketId, displayName, eloRating, joinedAt }
let arenaQueue = [];

// Helper function to process matchmaking queue in strict FIFO order
async function processQueue(io) {
  // Purge any stale/disconnected sockets
  arenaQueue = arenaQueue.filter(player => {
    const s = io.sockets.sockets.get(player.socketId);
    return s && s.connected;
  });

  // Sort queue by joinedAt ascending (click time order: 1, 2, 3, 4, ...)
  arenaQueue.sort((a, b) => a.joinedAt - b.joinedAt);

  console.log(`[Arena] Processing queue (${arenaQueue.length} player(s) waiting):`, 
    arenaQueue.map((p, idx) => `[#${idx + 1}] ${p.displayName} (${p.userId}) at ${new Date(p.joinedAt).toISOString()}`).join(', ') || 'none'
  );

  // Pair players in order: (1, 2), (3, 4), (5, 6), etc.
  while (arenaQueue.length >= 2) {
    const player1 = arenaQueue.shift();
    const player2 = arenaQueue.shift();

    console.log(`[Arena] Pairing: #${player1.displayName} vs #${player2.displayName}`);

    try {
      // Find a published quiz that has questions
      const [quizzes] = await db.pool.query(
        `SELECT q.id, q.title 
         FROM quizzes q 
         JOIN quiz_questions qq ON q.id = qq.quizid 
         WHERE q.ispublished = TRUE 
         GROUP BY q.id, q.title 
         HAVING COUNT(qq.id) > 0 
         ORDER BY RANDOM() LIMIT 1`
      );

      if (!quizzes || quizzes.length === 0) {
        console.error('[Arena] No published quizzes with questions available!');
        // Put them back at front of queue so they don't lose their priority
        arenaQueue.unshift(player2);
        arenaQueue.unshift(player1);
        io.to(player1.socketId).emit('arena_error', { message: 'No battle quizzes available right now.' });
        io.to(player2.socketId).emit('arena_error', { message: 'No battle quizzes available right now.' });
        break;
      }

      const battleQuiz = quizzes[0];
      const roomId = `arena_${uuidv4()}`;
      const challengeId = uuidv4();

      // Create Challenge record in DB
      await db.pool.query(
        `INSERT INTO challenges (id, roomId, matchType, challengerId, opponentId, quizId, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [challengeId, roomId, '1v1', player1.userId, player2.userId, battleQuiz.id, 'in_progress']
      );

      console.log(`[Arena] Match established! Room: ${roomId} | Quiz: "${battleQuiz.title}" | ${player1.displayName} vs ${player2.displayName}`);

      // Notify player 1
      io.to(player1.socketId).emit('match_found', { 
        roomId, 
        opponentId: player2.userId, 
        opponentName: player2.displayName,
        opponentElo: player2.eloRating,
        myName: player1.displayName,
        myElo: player1.eloRating,
        quizId: battleQuiz.id,
        quizTitle: battleQuiz.title
      });

      // Notify player 2
      io.to(player2.socketId).emit('match_found', { 
        roomId, 
        opponentId: player1.userId, 
        opponentName: player1.displayName,
        opponentElo: player1.eloRating,
        myName: player2.displayName,
        myElo: player2.eloRating,
        quizId: battleQuiz.id,
        quizTitle: battleQuiz.title
      });

    } catch (error) {
      console.error('[Arena] Match creation error:', error);
      // Restore players if error occurred
      arenaQueue.unshift(player2);
      arenaQueue.unshift(player1);
      break;
    }
  }

  // Any remaining odd player(s) stay in queue waiting for the next opponent
  arenaQueue.forEach((waitingPlayer, index) => {
    io.to(waitingPlayer.socketId).emit('queue_status', { 
      status: 'waiting', 
      playersInQueue: arenaQueue.length,
      queuePosition: index + 1,
      displayName: waitingPlayer.displayName
    });
  });
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    // 1. Join Matchmaking Queue
    socket.on('join_arena_queue', async (data) => {
      const userId = socket.userId;
      if (!userId) {
        socket.emit('arena_error', { message: 'Authentication required to join Live Arena.' });
        return;
      }

      // Capture click time immediately to preserve strict FIFO queue ordering
      const joinedAt = data?.clickTime || Date.now();
      let displayName = socket.user?.displayName || 'Student';
      let eloRating = data?.eloRating || 1200;

      // Check if user is already in queue
      const existingIdx = arenaQueue.findIndex(u => u.userId === userId);
      if (existingIdx !== -1) {
        arenaQueue[existingIdx].socketId = socket.id;
        console.log(`[Arena] Updated existing queued user ${arenaQueue[existingIdx].displayName} (${userId}).`);
      } else {
        // Enqueue synchronously with click timestamp so ordering is never scrambled
        arenaQueue.push({
          userId,
          socketId: socket.id,
          displayName,
          eloRating,
          joinedAt
        });
        console.log(`[Arena] Enqueued ${displayName} (${userId}) at ${new Date(joinedAt).toISOString()}`);
      }

      // Fetch latest profile from DB to update displayName / elo if needed
      try {
        const [userRows] = await db.pool.query(
          'SELECT id, displayName, eloRating FROM users WHERE id = ?',
          [userId]
        );
        if (userRows && userRows.length > 0) {
          const entry = arenaQueue.find(u => u.userId === userId);
          if (entry) {
            entry.displayName = userRows[0].displayName || entry.displayName;
            entry.eloRating = userRows[0].eloRating || entry.eloRating;
          }
        }
      } catch (err) {
        console.warn('[Arena] Error fetching user profile:', err.message);
      }

      // Process matchmaking immediately in strict FIFO order
      await processQueue(io);
    });

    // 2. Leave Matchmaking Queue
    socket.on('leave_arena_queue', async () => {
      arenaQueue = arenaQueue.filter(u => u.userId !== socket.userId);
      console.log(`[Arena] User ${socket.userId} left queue. Remaining: ${arenaQueue.length}`);
      await processQueue(io);
    });

    // 3. Join the actual Battle Room
    socket.on('join_arena_room', (roomId) => {
      socket.join(roomId);
      console.log(`[Arena] User ${socket.userId} joined room ${roomId}`);
    });

    // 4. Broadcast real-time progress to opponent
    socket.on('arena_progress', (data) => {
      const { roomId, currentQuestionIndex, score } = data;
      // Broadcast to everyone in the room EXCEPT the sender
      socket.to(roomId).emit('opponent_progress', {
        opponentId: socket.userId,
        currentQuestionIndex,
        score
      });
    });

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
      const wasInQueue = arenaQueue.some(u => u.userId === socket.userId);
      if (wasInQueue) {
        arenaQueue = arenaQueue.filter(u => u.userId !== socket.userId);
        console.log(`[Arena] User ${socket.userId} disconnected while in queue. Remaining: ${arenaQueue.length}`);
        await processQueue(io);
      }
    });

  });
};
