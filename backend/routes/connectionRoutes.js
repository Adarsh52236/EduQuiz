const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('./authRoutes');
const { createNotification, sendRealTimeNotification } = require('./notificationRoutes');

// Get all connections for the authenticated user (protected route)
router.get('/', authenticateToken, async (req, res) => {
  const studentId = req.user.id;

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can view connections' });
  }

  try {
    const [connections] = await db.pool.query(
      `SELECT 
         sc.id, sc.studentId, sc.status, sc.createdAt,
         u.id as connectedStudentId, u.displayName as connectedStudentName, u.email as connectedStudentEmail
       FROM student_connections sc
       JOIN users u ON sc.connectedStudentId = u.id
       WHERE sc.studentId = ?
       UNION
       SELECT 
         sc.id, sc.studentId, sc.status, sc.createdAt,
         u.id as connectedStudentId, u.displayName as connectedStudentName, u.email as connectedStudentEmail
       FROM student_connections sc
       JOIN users u ON sc.studentId = u.id
       WHERE sc.connectedStudentId = ? AND sc.status = 'accepted'`, // Only show accepted connections where current user is the connectedStudentId
      [studentId, studentId]
    );
    console.log(`[ConnectionRoutes] Found ${connections.length} connections for user ${studentId}`);
    res.status(200).json(connections);
  } catch (error) {
    console.error('[ConnectionRoutes] Error fetching connections:', error);
    res.status(500).json({ message: 'Server error fetching connections' });
  }
});

// Create a new connection request (protected route)
router.post('/', authenticateToken, async (req, res) => {
  const studentId = req.user.id;
  const { connectedStudentId } = req.body;
  const id = uuidv4();

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can send connection requests' });
  }

  if (!connectedStudentId) {
    return res.status(400).json({ message: 'Connected student ID is required' });
  }

  if (studentId === connectedStudentId) {
    return res.status(400).json({ message: 'Cannot send connection request to yourself' });
  }

  try {
    // Check if connectedStudentId exists and is a student
    const [userRows] = await db.pool.query(
      'SELECT id FROM users WHERE id = ? AND role = "student"',
      [connectedStudentId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Connected student not found or is not a student' });
    }

    // Check for existing connection (pending, accepted, or rejected)
    const [existingConnectionRows] = await db.pool.query(
      `SELECT id, status FROM student_connections 
       WHERE (studentId = ? AND connectedStudentId = ?) OR (studentId = ? AND connectedStudentId = ?)`,
      [studentId, connectedStudentId, connectedStudentId, studentId]
    );

    if (existingConnectionRows.length > 0) {
      const existingConnection = existingConnectionRows[0];
      if (existingConnection.status === 'pending') {
        return res.status(409).json({ message: 'Connection request already pending' });
      } else if (existingConnection.status === 'accepted') {
        return res.status(409).json({ message: 'Already connected with this student' });
      } else if (existingConnection.status === 'rejected') {
        return res.status(409).json({ message: 'Previous connection request was rejected' });
      }
    }

    // Insert new pending connection request
    await db.pool.query(
      'INSERT INTO student_connections (id, studentId, connectedStudentId, status) VALUES (?, ?, ?, "pending")',
      [id, studentId, connectedStudentId]
    );

    // Send notification to the connected student
    try {
      const [senderRows] = await db.pool.query(
        'SELECT displayName FROM users WHERE id = ?',
        [studentId]
      );
      const senderName = senderRows[0]?.displayName || 'A student';

      await createNotification(
        connectedStudentId,
        'connection_request',
        `${senderName} sent you a connection request!`,
        `/student/connections`
      );

      await sendRealTimeNotification(connectedStudentId, {
        type: 'connection_request',
        message: `${senderName} sent you a connection request!`,
        connectionId: id,
        senderId: studentId,
        senderName: senderName
      });
    } catch (notifError) {
      console.error('Error sending connection request notification:', notifError);
    }

    res.status(201).json({ id, studentId, connectedStudentId, status: 'pending', message: 'Connection request sent' });
  } catch (error) {
    console.error('Error sending connection request:', error);
    res.status(500).json({ message: 'Server error sending connection request' });
  }
});

// Update a connection (e.g., accept/reject) (protected route)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'accepted' or 'rejected'
  const userId = req.user.id;

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can manage connections' });
  }

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status provided. Must be "accepted" or "rejected"' });
  }

  try {
    // Find the connection request
    const [connectionRows] = await db.pool.query(
      'SELECT studentId, connectedStudentId, status FROM student_connections WHERE id = ?',
      [id]
    );

    if (connectionRows.length === 0) {
      return res.status(404).json({ message: 'Connection request not found' });
    }
    const connection = connectionRows[0];

    // Ensure the user is the recipient of the request
    if (connection.connectedStudentId !== userId) {
      return res.status(403).json({ message: 'Access denied: You are not the recipient of this connection request' });
    }

    // Ensure the request is pending
    if (connection.status !== 'pending') {
      return res.status(409).json({ message: `Connection request is already ${connection.status}` });
    }

    // Update the status
    await db.pool.query(
      'UPDATE student_connections SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    // Send notification to the sender about acceptance
    if (status === 'accepted') {
      try {
        const [accepterRows] = await db.pool.query(
          'SELECT displayName FROM users WHERE id = ?',
          [userId]
        );
        const accepterName = accepterRows[0]?.displayName || 'A student';

        await createNotification(
          connection.studentId,
          'connection_accepted',
          `${accepterName} accepted your connection request!`,
          `/student/connections`
        );

        await sendRealTimeNotification(connection.studentId, {
          type: 'connection_accepted',
          message: `${accepterName} accepted your connection request!`,
          connectionId: id,
          accepterId: userId,
          accepterName: accepterName
        });
      } catch (notifError) {
        console.error('Error sending connection accepted notification:', notifError);
      }
    }

    res.status(200).json({ message: `Connection request ${status} successfully` });
  } catch (error) {
    console.error('Error updating connection request:', error);
    res.status(500).json({ message: 'Server error updating connection request' });
  }
});

// Send a quiz challenge (protected route)
router.post('/challenge', authenticateToken, async (req, res) => {
  const challengerId = req.user.id;
  const { opponentId, quizId } = req.body;
  const id = uuidv4();

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can send challenges' });
  }

  if (!opponentId || !quizId) {
    return res.status(400).json({ message: 'Opponent ID and Quiz ID are required to send a challenge' });
  }

  if (challengerId === opponentId) {
    return res.status(400).json({ message: 'Cannot challenge yourself' });
  }

  try {
    // 1. Verify opponentId exists and is a student
    const [opponentRows] = await db.pool.query(
      'SELECT id FROM users WHERE id = ? AND role = "student"',
      [opponentId]
    );
    if (opponentRows.length === 0) {
      return res.status(404).json({ message: 'Opponent not found or is not a student' });
    }

    // 2. Verify they are connected (status 'accepted')
    const [connectionRows] = await db.pool.query(
      `SELECT id FROM student_connections 
       WHERE ((studentId = ? AND connectedStudentId = ?) OR (studentId = ? AND connectedStudentId = ?)) 
       AND status = 'accepted'`,
      [challengerId, opponentId, opponentId, challengerId]
    );
    if (connectionRows.length === 0) {
      return res.status(403).json({ message: 'You are not connected with this student' });
    }

    // 3. Verify quiz exists and is published
    const [quizRows] = await db.pool.query(
      'SELECT id FROM quizzes WHERE id = ? AND isPublished = TRUE',
      [quizId]
    );
    if (quizRows.length === 0) {
      return res.status(404).json({ message: 'Quiz not found or not published' });
    }

    // 4. Check for existing pending challenge between these two students for this quiz
    const [existingChallengeRows] = await db.pool.query(
      `SELECT id FROM challenges 
       WHERE ((challengerId = ? AND opponentId = ?) OR (challengerId = ? AND opponentId = ?)) 
       AND quizId = ? AND status = 'pending'`,
      [challengerId, opponentId, opponentId, challengerId, quizId]
    );
    if (existingChallengeRows.length > 0) {
      return res.status(409).json({ message: 'A pending challenge for this quiz already exists between you and this student' });
    }

    // 5. Insert new pending challenge
    await db.pool.query(
      'INSERT INTO challenges (id, challengerId, opponentId, quizId, status) VALUES (?, ?, ?, ?, "pending")',
      [id, challengerId, opponentId, quizId]
    );

    // 6. Send notification to the opponent
    try {
      // Get challenger's name for the notification
      const [challengerRows] = await db.pool.query(
        'SELECT displayName FROM users WHERE id = ?',
        [challengerId]
      );
      const challengerName = challengerRows[0]?.displayName || 'A student';

      // Get quiz title for the notification
      const [quizRows] = await db.pool.query(
        'SELECT title FROM quizzes WHERE id = ?',
        [quizId]
      );
      const quizTitle = quizRows[0]?.title || 'a quiz';

      // Create notification
      const notificationId = uuidv4();
      await createNotification(
        opponentId,
        'challenge_received',
        `${challengerName} challenged you to take "${quizTitle}"!`,
        `/student/challenges`
      );

      // Send real-time notification
      await sendRealTimeNotification(opponentId, {
        type: 'challenge_received',
        message: `${challengerName} challenged you to take "${quizTitle}"!`,
        challengeId: id,
        quizId: quizId,
        challengerId: challengerId,
        challengerName: challengerName
      });
    } catch (notificationError) {
      console.error('Error sending challenge notification:', notificationError);
      // Don't fail the challenge creation if notification fails
    }

    res.status(201).json({ id, challengerId, opponentId, quizId, status: 'pending', message: 'Challenge sent' });
  } catch (error) {
    console.error('Error sending challenge:', error);
    res.status(500).json({ message: 'Server error sending challenge' });
  }
});

// Update a challenge (accept/reject) (protected route)
router.put('/challenge/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'accepted' or 'rejected'
  const userId = req.user.id;

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can respond to challenges' });
  }

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status provided. Must be "accepted" or "rejected"' });
  }

  try {
    // Find the challenge
    const [challengeRows] = await db.pool.query(
      'SELECT challengerId, opponentId, status FROM challenges WHERE id = ?',
      [id]
    );

    if (challengeRows.length === 0) {
      return res.status(404).json({ message: 'Challenge not found' });
    }
    const challenge = challengeRows[0];

    // Ensure the user is the opponent of the challenge
    if (challenge.opponentId !== userId) {
      return res.status(403).json({ message: 'Access denied: You are not the recipient of this challenge' });
    }

    // Ensure the challenge is pending
    if (challenge.status !== 'pending') {
      return res.status(409).json({ message: `Challenge is already ${challenge.status}` });
    }

    // Update the status
    await db.pool.query(
      'UPDATE challenges SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    // Send notification to the challenger about the response
    try {
      // Get opponent's name for the notification
      const [opponentRows] = await db.pool.query(
        'SELECT displayName FROM users WHERE id = ?',
        [userId]
      );
      const opponentName = opponentRows[0]?.displayName || 'A student';

      // Get quiz title for the notification
      const [quizRows] = await db.pool.query(
        'SELECT title FROM quizzes WHERE id = ?',
        [challenge.quizId]
      );
      const quizTitle = quizRows[0]?.title || 'a quiz';

      let notificationMessage;
      let notificationType;
      
      if (status === 'accepted') {
        notificationMessage = `${opponentName} accepted your challenge to take "${quizTitle}"!`;
        notificationType = 'challenge_accepted';
      } else {
        notificationMessage = `${opponentName} declined your challenge to take "${quizTitle}".`;
        notificationType = 'challenge_declined';
      }

      // Create notification
      await createNotification(
        challenge.challengerId,
        notificationType,
        notificationMessage,
        `/student/challenges`
      );

      // Send real-time notification
      await sendRealTimeNotification(challenge.challengerId, {
        type: notificationType,
        message: notificationMessage,
        challengeId: id,
        quizId: challenge.quizId,
        opponentId: userId,
        opponentName: opponentName
      });
    } catch (notificationError) {
      console.error('Error sending challenge response notification:', notificationError);
      // Don't fail the challenge response if notification fails
    }

    res.status(200).json({ message: `Challenge ${status} successfully` });
  } catch (error) {
    console.error('Error updating challenge:', error);
    res.status(500).json({ message: 'Server error updating challenge' });
  }
});

// Get challenges (sent and received) for the authenticated user (protected route)
router.get('/challenges', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Only students can view challenges' });
  }

  try {
    const [challenges] = await db.pool.query(
      `SELECT 
         c.id, c.quizId, c.status, c.createdAt, c.winnerId,
         q.title as quizTitle,
         u_challenger.displayName as challengerName,
         u_opponent.displayName as opponentName
       FROM challenges c
       JOIN quizzes q ON c.quizId = q.id
       JOIN users u_challenger ON c.challengerId = u_challenger.id
       JOIN users u_opponent ON c.opponentId = u_opponent.id
       WHERE c.challengerId = ? OR c.opponentId = ?
       ORDER BY c.createdAt DESC`,
      [userId, userId]
    );
    res.status(200).json(challenges);
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ message: 'Server error fetching challenges' });
  }
});

module.exports = router;