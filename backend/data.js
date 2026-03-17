const quizzes = [
  { id: '1', title: 'React Fundamentals', subject: 'React', attempts: 2, bestScore: 85, lastAttempted: '2023-10-26' },
  { id: '2', title: 'JavaScript Essentials', subject: 'JavaScript', attempts: 1, bestScore: 92, lastAttempted: '2023-10-25' },
  { id: '3', title: 'Advanced CSS', subject: 'CSS', attempts: 0, bestScore: null, lastAttempted: null },
  { id: '4', title: 'Node.js for Beginners', subject: 'Node.js', attempts: 3, bestScore: 78, lastAttempted: '2023-10-24' },
];

const quizQuestions = [
    {
    "id": "q1",
    "quizId": "1",
    "questionText": "What is JSX?",
    "questionType": "multiple-choice",
    "points": 10,
    "orderIndex": 0,
    "options": [
      { "id": "opt1", "text": "A syntax extension for JavaScript" },
      { "id": "opt2", "text": "A templating engine" },
      { "id": "opt3", "text": "A CSS preprocessor" }
    ],
    "correctAnswer": "opt1"
  },
  {
    "id": "q2",
    "quizId": "1",
    "questionText": "What is the virtual DOM?",
    "questionType": "multiple-choice",
    "points": 10,
    "orderIndex": 1,
    "options": [
      { "id": "opt1", "text": "A direct representation of the actual DOM" },
      { "id": "opt2", "text": "A lightweight copy of the DOM in memory" },
      { "id": "opt3", "text": "A server-side rendering technique" }
    ],
    "correctAnswer": "opt2"
  }
];

const users = [
    {
        "id": "user_1",
        "name": "Sample Student",
        "email": "student@example.com",
        "role": "student",
        "password": "(demo only - not used in production)"
    },
    {
        "id": "user_2",
        "name": "Sample Teacher",
        "email": "teacher@example.com",
        "role": "teacher",
        "password": "(demo only - not used in production)"
    }
]

const classes = [
    {
        "id": "class_1",
        "name": "Introduction to Web Development",
        "description": "A comprehensive course on the fundamentals of web development.",
        "classCode": "WD101",
        "teacherId": "user_2",
        "createdAt": "2023-01-15T10:00:00Z",
        "updatedAt": "2023-01-15T10:00:00Z"
    }
];

const quizAttempts = [
    {
        "id": "attempt_1",
        "quizId": "1",
        "studentId": "user_1",
        "startedAt": "2023-10-26T10:00:00Z",
        "submittedAt": "2023-10-26T10:15:00Z",
        "score": 85,
        "totalPoints": 100,
        "timeTaken": 900,
        "isCompleted": true
    },
    {
        "id": "attempt_2",
        "quizId": "2",
        "studentId": "user_1",
        "startedAt": "2023-10-25T11:00:00Z",
        "submittedAt": "2023-10-25T11:20:00Z",
        "score": 92,
        "totalPoints": 100,
        "timeTaken": 1200,
        "isCompleted": true
    }
];

module.exports = {
  quizzes,
  quizQuestions,
  users,
  classes,
  quizAttempts
};