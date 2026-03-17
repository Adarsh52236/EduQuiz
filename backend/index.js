require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { initializeDatabase } = require('./db');
const app = express();
const server = createServer(app);

// Normalize to avoid CORS mismatches like trailing slashes
const normalizedFrontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
const io = new Server(server, {
  cors: {
    origin: normalizedFrontendUrl,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  }
});
console.log('process.env.PORT:', process.env.PORT);
const port = process.env.PORT || 3001;

// Import route modules
const quizRoutes = require('./routes/quizRoutes');
const questionRoutes = require('./routes/questionRoutes');
const classRoutes = require('./routes/classRoutes');
const attemptRoutes = require('./routes/attemptRoutes');
const answerRoutes = require('./routes/answerRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const gradeCardRoutes = require('./routes/gradeCardRoutes');
const { router: notificationRouter } = require('./routes/notificationRoutes');
const { router: authRouter, authenticateToken } = require('./routes/authRoutes'); // Directly import the router

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    console.log(`Socket authenticated: ${decoded.userId} (${decoded.role})`);
    next();
  } catch (err) {
    console.error('Socket authentication failed:', err.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId} (${socket.userRole})`);
  
  // Join user-specific room for targeted notifications
  socket.join(`user_${socket.userId}`);
  
  // Join role-specific rooms
  socket.join(`role_${socket.userRole}`);
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Enable CORS for all routes
  app.use(cors({
    origin: normalizedFrontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));

  // Use route modules
  console.log('Registering auth routes...');
  app.use('/api/auth', authRouter); // Use the imported authRouter
  console.log('Auth routes registered.');

  app.use('/api/quizzes', quizRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/attempts', attemptRoutes);
  app.use('/api/answers', answerRoutes);
  app.use('/api/enrollments', enrollmentRoutes);
  app.use('/api/connections', connectionRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/grade-card', gradeCardRoutes);
  app.use('/api/notifications', notificationRouter);

  // Health check endpoint
  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'QuizWeb Backend API' });
  });

  // 404 handler for undefined routes
  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server listening on http://localhost:${port}`);
    console.log(`✅ API available at http://localhost:${port}/api`);
    console.log(`✅ Health check: http://localhost:${port}/`);
  });
  
  // Make io available globally for routes
  app.set('io', io);
  global.io = io;
  
}).catch(err => {
  console.error('❌ Failed to initialize database or start server:', err);
  console.error('Error details:', {
    message: err.message,
    code: err.code,
    stack: err.stack
  });
  
  // Try to start server anyway (for development)
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️  Attempting to start server without database connection (development mode)...');
    app.use(express.json());
    app.use(cors({
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true
    }));
    
    app.get('/', (req, res) => {
      res.json({ 
        status: 'warning', 
        message: 'Server running but database connection failed',
        error: err.message
      });
    });
    
    server.listen(port, '0.0.0.0', () => {
      console.log(`⚠️  Server started on port ${port} but database is not connected`);
      console.log(`⚠️  Please check your database configuration`);
    });
  } else {
    process.exit(1);
  }
});