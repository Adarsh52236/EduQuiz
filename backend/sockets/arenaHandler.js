const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// In-memory queue for matchmaking
// Ideally, use Redis for scale, but an array works for MVP
let arenaQueue = [];

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    // 1. Join Matchmaking Queue
    socket.on('join_arena_queue', async (data) => {
      console.log(`[Arena] User ${socket.userId} joined queue.`);
      
      // Prevent double queuing
      if (arenaQueue.find(user => user.userId === socket.userId)) {
        return;
      }

      arenaQueue.push({
        userId: socket.userId,
        socketId: socket.id,
        eloRating: data?.eloRating || 1200,
        joinedAt: Date.now()
      });

      // Try to find a match (simple matchmaking: just grab the next person in queue)
      if (arenaQueue.length >= 2) {
        const player1 = arenaQueue.shift();
        const player2 = arenaQueue.shift();

        try {
          // Find a random public quiz to serve as the battleground
          const [quizzes] = await db.pool.query(
            "SELECT id FROM quizzes WHERE visibility = 'public' ORDER BY RANDOM() LIMIT 1"
          );

          if (quizzes.length === 0) {
            // No public quizzes available, put them back in queue
            arenaQueue.unshift(player2);
            arenaQueue.unshift(player1);
            socket.emit('arena_error', { message: 'No arena content available right now.' });
            return;
          }

          const battleQuizId = quizzes[0].id;
          const roomId = `arena_${uuidv4()}`;

          // Create the Challenge record in DB
          const challengeId = uuidv4();
          await db.pool.query(
            `INSERT INTO challenges (id, roomId, matchType, challengerId, opponentId, quizId, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [challengeId, roomId, '1v1', player1.userId, player2.userId, battleQuizId, 'in_progress']
          );

          console.log(`[Arena] Match found! Room: ${roomId}`);

          // Notify both players
          io.to(player1.socketId).emit('match_found', { roomId, opponentId: player2.userId, quizId: battleQuizId });
          io.to(player2.socketId).emit('match_found', { roomId, opponentId: player1.userId, quizId: battleQuizId });

        } catch (error) {
          console.error('[Arena] Matchmaking error:', error);
        }
      } else {
        // Just notify them they are waiting
        socket.emit('queue_status', { status: 'waiting', playersInQueue: arenaQueue.length });
      }
    });

    // 2. Leave Matchmaking Queue
    socket.on('leave_arena_queue', () => {
      arenaQueue = arenaQueue.filter(u => u.userId !== socket.userId);
      console.log(`[Arena] User ${socket.userId} left queue.`);
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
    socket.on('disconnect', () => {
      arenaQueue = arenaQueue.filter(u => u.userId !== socket.userId);
    });

  });
};
