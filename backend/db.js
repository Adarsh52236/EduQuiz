const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL Database Configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pgPool = new Pool(dbConfig);

// Map PostgreSQL lowercase column names back to expected camelCase
const camelCaseMap = {
  displayname: 'displayName',
  dateofbirth: 'dateOfBirth',
  classcode: 'classCode',
  teacherid: 'teacherId',
  createdat: 'createdAt',
  updatedat: 'updatedAt',
  classid: 'classId',
  studentid: 'studentId',
  enrolledat: 'enrolledAt',
  timelimit: 'timeLimit',
  totalpoints: 'totalPoints',
  starttime: 'startTime',
  endtime: 'endTime',
  ispublished: 'isPublished',
  quizid: 'quizId',
  questiontext: 'questionText',
  questiontype: 'questionType',
  orderindex: 'orderIndex',
  correctanswer: 'correctAnswer',
  startedat: 'startedAt',
  submittedat: 'submittedAt',
  timetaken: 'timeTaken',
  iscompleted: 'isCompleted',
  attemptid: 'attemptId',
  questionid: 'questionId',
  iscorrect: 'isCorrect',
  pointsearned: 'pointsEarned',
  totalscore: 'totalScore',
  challengerid: 'challengerId',
  opponentid: 'opponentId',
  winnerid: 'winnerId',
  connectedstudentid: 'connectedStudentId',
  userid: 'userId',
  isread: 'isRead',
  globalxp: 'globalXp',
  elorating: 'eloRating',
  aifeedback: 'aiFeedback',
  matchtype: 'matchType',
  roomid: 'roomId'
};

function formatRows(rows) {
  if (!rows || !Array.isArray(rows)) return rows;
  return rows.map(row => {
    const formatted = {};
    for (const key in row) {
      if (camelCaseMap[key]) {
        formatted[camelCaseMap[key]] = row[key];
      } else {
        formatted[key] = row[key];
      }
    }
    return formatted;
  });
}

// Wrapper to make pg look like mysql2 for the route files
const poolWrapper = {
  query: async (text, params) => {
    let index = 1;
    // Replace MySQL ? with PostgreSQL $1, $2, etc.
    const pgText = text.replace(/\?/g, () => `$${index++}`);
    
    // Fix MySQL specific queries
    let finalQuery = pgText;
    
    const result = await pgPool.query(finalQuery, params);
    
    // Return in mysql2 format: [rows, fields]
    return [formatRows(result.rows), result.fields];
  },
  getConnection: async () => {
    const client = await pgPool.connect();
    return {
      query: async (text, params) => {
        let index = 1;
        const pgText = text.replace(/\?/g, () => `$${index++}`);
        const result = await client.query(pgText, params);
        return [formatRows(result.rows), result.fields];
      },
      release: () => client.release()
    };
  }
};

async function initializeDatabase() {
  console.log('Attempting to initialize PostgreSQL database connection...');
  
  try {
    const client = await pgPool.connect();
    console.log('✅ Database connection successful!');

    console.log('Creating/verifying database tables...');

    // Drop tables to recreate with new schema (since we are pivoting on a fresh DB)
    await client.query(`
      DROP TABLE IF EXISTS notifications, student_connections, challenges, leaderboards, quiz_answers, quiz_attempts, quiz_questions, quizzes, class_enrollments, classes, users CASCADE;
    `);
    
    // Trigger function for updatedAt
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updatedAt = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // We do NOT quote table columns so they are case-insensitive in queries,
    // and rely on formatRows to restore the camelCase in JS.
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        displayName VARCHAR(255),
        role VARCHAR(50) CHECK(role IN ('student', 'teacher')) NOT NULL,
        avatar VARCHAR(255),
        bio TEXT,
        department VARCHAR(255),
        grade VARCHAR(50),
        phone VARCHAR(50),
        address TEXT,
        dateOfBirth DATE,
        resetToken VARCHAR(255),
        resetTokenExpiry TIMESTAMP,
        globalXp INT DEFAULT 0,
        eloRating INT DEFAULT 1200,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        classCode VARCHAR(255) UNIQUE NOT NULL,
        teacherId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
      CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS class_enrollments (
        id VARCHAR(255) PRIMARY KEY,
        classId VARCHAR(255) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        studentId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        enrolledAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (classId, studentId)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) CHECK(type IN ('multiple-choice', 'true-false', 'short-answer')) NOT NULL DEFAULT 'multiple-choice',
        classId VARCHAR(255) REFERENCES classes(id) ON DELETE SET NULL,
        teacherId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        timeLimit INT,
        totalPoints INT DEFAULT 0,
        startTime TIMESTAMP,
        endTime TIMESTAMP,
        isPublished BOOLEAN DEFAULT FALSE,
        visibility VARCHAR(50) DEFAULT 'private',
        tags JSONB,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_quizzes_updated_at ON quizzes;
      CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        id VARCHAR(255) PRIMARY KEY,
        quizId VARCHAR(255) NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        questionText TEXT NOT NULL,
        questionType VARCHAR(50) CHECK(questionType IN ('multiple-choice', 'true-false', 'short-answer')) NOT NULL,
        points INT NOT NULL,
        orderIndex INT NOT NULL,
        options JSONB,
        correctAnswer TEXT NOT NULL,
        difficulty VARCHAR(50) DEFAULT 'medium',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id VARCHAR(255) PRIMARY KEY,
        quizId VARCHAR(255) NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        studentId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        submittedAt TIMESTAMP,
        score INT,
        totalPoints INT,
        timeTaken INT,
        isCompleted BOOLEAN DEFAULT FALSE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_answers (
        id VARCHAR(255) PRIMARY KEY,
        attemptId VARCHAR(255) NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
        questionId VARCHAR(255) NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
        answer TEXT NOT NULL,
        isCorrect BOOLEAN,
        pointsEarned INT,
        aiFeedback TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboards (
        id VARCHAR(255) PRIMARY KEY,
        classId VARCHAR(255) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        studentId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        totalScore INT DEFAULT 0,
        student_rank INT,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (classId, studentId)
      );
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_leaderboards_updated_at ON leaderboards;
      CREATE TRIGGER update_leaderboards_updated_at BEFORE UPDATE ON leaderboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS challenges (
        id VARCHAR(255) PRIMARY KEY,
        roomId VARCHAR(255),
        matchType VARCHAR(50) DEFAULT '1v1',
        challengerId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        opponentId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quizId VARCHAR(255) NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        status VARCHAR(50) CHECK(status IN ('pending', 'accepted', 'rejected', 'in_progress', 'completed')) DEFAULT 'pending',
        winnerId VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
      CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_connections (
        id VARCHAR(255) PRIMARY KEY,
        studentId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        connectedStudentId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) CHECK(status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (studentId, connectedStudentId)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(500),
        isRead BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    client.release();
    console.log('✅ PostgreSQL Database and tables initialized.');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

module.exports = {
  get pool() { return poolWrapper; },
  initializeDatabase
};