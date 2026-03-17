const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('./authRoutes');

// Store for real-time notifications (in-memory for now, can be replaced with Redis/WebSocket later)
const notificationStore = new Map();

// Create a notification
async function createNotification(userId, type, message, link = null) {
  try {
    const id = uuidv4();
    await db.pool.query(
      'INSERT INTO notifications (id, userId, type, message, link, isRead, createdAt) VALUES (?, ?, ?, ?, ?, false, CURRENT_TIMESTAMP)',
      [id, userId, type, message, link]
    );
    return id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

// Send real-time notification (placeholder for WebSocket implementation)
async function sendRealTimeNotification(userId, notificationData) {
  // For now, store in memory. In production, this would use WebSockets or a message queue
  if (!notificationStore.has(userId)) {
    notificationStore.set(userId, []);
  }
  notificationStore.get(userId).push({
    ...notificationData,
    timestamp: new Date().toISOString()
  });
  
  // Clean up old notifications (keep last 50)
  const notifications = notificationStore.get(userId);
  if (notifications.length > 50) {
    notificationStore.set(userId, notifications.slice(-50));
  }
}

// Get notifications for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const limitNum = parseInt(limit) || 50;
    const offsetNum = parseInt(offset) || 0;
    
    const [notifications] = await db.pool.query(
      'SELECT id, type, message, link, isRead, createdAt FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?',
      [userId, limitNum, offsetNum]
    );

    const [unreadCountResult] = await db.pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = false',
      [userId]
    );

    const unreadCount = unreadCountResult[0]?.count || 0;

    res.status(200).json({
      notifications: notifications || [],
      unreadCount: unreadCount,
      totalCount: notifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error fetching notifications', error: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [result] = await db.pool.query(
      'UPDATE notifications SET isRead = true WHERE id = ? AND userId = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error marking notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    await db.pool.query(
      'UPDATE notifications SET isRead = true WHERE userId = ? AND isRead = false',
      [userId]
    );

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error marking all notifications as read' });
  }
});

// Delete a notification
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [result] = await db.pool.query(
      'DELETE FROM notifications WHERE id = ? AND userId = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error deleting notification' });
  }
});

// Get real-time notifications (polling endpoint)
router.get('/real-time', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  
  try {
    const notifications = notificationStore.get(userId) || [];
    // Clear notifications after sending
    notificationStore.set(userId, []);
    
    res.status(200).json({ notifications });
  } catch (error) {
    console.error('Error fetching real-time notifications:', error);
    res.status(500).json({ message: 'Server error fetching real-time notifications' });
  }
});

module.exports = { 
  router, 
  createNotification, 
  sendRealTimeNotification 
};