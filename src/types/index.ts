export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: 'teacher' | 'student';
  avatar: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  name: string;
  description: string | null;
  classCode: string;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassEnrollment {
  id: string;
  classId: string;
  studentId: string;
  enrolledAt: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  classId: string;
  teacherId: string;
  timeLimit: number | null;
  totalPoints: number;
  startTime: string | null;
  endTime: string | null;
  isPublished: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  questionType: 'multiple-choice' | 'true-false' | 'short-answer';
  points: number;
  orderIndex: number;
  options: string | null;
  correctAnswer: string;
  createdAt: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  totalPoints: number;
  timeTaken: number | null;
  isCompleted: string;
}

export interface QuizAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  answer: string;
  isCorrect: string;
  pointsEarned: number;
}

export interface StudentConnection {
  id: string;
  studentId: string;
  connectedStudentId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'quiz' | 'connection' | 'grade' | 'class';
  isRead: string;
  relatedId: string | null;
  createdAt: string;
}
