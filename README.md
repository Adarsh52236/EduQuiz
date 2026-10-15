# EduQuiz — Quiz Web Application

A full-stack quiz application built with React, TypeScript, Node.js, and MySQL. Features include quiz creation, student enrollment, real-time notifications, leaderboards, and analytics.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Shadcn/ui
- **Backend**: Node.js + Express + Socket.io
- **Database**: MySQL (Aiven Cloud)
- **Authentication**: JWT

## Features

- 🎓 Teacher Dashboard: Create quizzes, manage classes, view analytics
- 👨‍🎓 Student Dashboard: Take quizzes, view grades, connect with peers
- 📊 Real-time Analytics: Performance tracking and insights
- 🏆 Leaderboards: Competitive rankings
- 🔔 Real-time Notifications: Socket.io powered
- 📱 Responsive Design: Works on all devices

## Project Structure

```
EduQuiz/
├── client/                        # React frontend (Vite)
│   ├── public/                    # Static assets
│   │   ├── favicon.svg
│   │   └── _redirects
│   ├── src/
│   │   ├── assets/                # Images, fonts, etc.
│   │   ├── components/
│   │   │   ├── layout/            # TeacherLayout, StudentLayout
│   │   │   ├── notifications/     # NotificationBell, Notifications
│   │   │   ├── ui/                # Shadcn/ui components
│   │   │   ├── NotificationBell.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── config/                # API config
│   │   ├── contexts/              # AuthContext, NotificationContext, SocketContext
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── lib/                   # Utilities, API helpers
│   │   ├── pages/
│   │   │   ├── auth/              # StudentAuth, TeacherAuth
│   │   │   ├── student/           # Student dashboard, quizzes, grades, etc.
│   │   │   ├── teacher/           # Teacher dashboard, quiz editor, classes, etc.
│   │   │   └── LandingPage.tsx
│   │   ├── types/                 # TypeScript type definitions
│   │   ├── App.tsx                # Root component with routing
│   │   ├── App.css
│   │   ├── index.css              # Global styles & CSS variables
│   │   └── main.tsx               # Entry point
│   ├── index.html                 # HTML template
│   ├── package.json               # Frontend dependencies
│   ├── vite.config.ts             # Vite configuration
│   ├── tailwind.config.cjs        # Tailwind CSS configuration
│   ├── postcss.config.cjs         # PostCSS configuration
│   ├── tsconfig.json              # TypeScript configuration
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   └── components.json            # Shadcn/ui configuration
│
├── backend/                       # Express.js backend API
│   ├── routes/                    # API route handlers
│   │   ├── analyticsRoutes.js
│   │   ├── answerRoutes.js
│   │   ├── attemptRoutes.js
│   │   ├── authRoutes.js
│   │   ├── classRoutes.js
│   │   ├── connectionRoutes.js
│   │   ├── enrollmentRoutes.js
│   │   ├── gradeCardRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── questionRoutes.js
│   │   ├── quizRoutes.js
│   │   └── userRoutes.js
│   ├── db.js                      # Database configuration & table creation
│   ├── data.js                    # Seed/sample data
│   ├── index.js                   # Server entry point
│   ├── package.json               # Backend dependencies
│   ├── Procfile                   # Heroku/Render process file
│   └── .env.example               # Backend env template
│
├── .env.example                   # Root env documentation
├── .gitignore
├── package.json                   # Root scripts (dev:client, dev:server, etc.)
├── render.yaml                    # Render deployment config (backend)
├── vercel.json                    # Vercel deployment config (frontend)
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+ installed
- MySQL database (Aiven MySQL configured)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Adarsh52236/EduQuiz.git
   cd EduQuiz
   ```

2. **Install all dependencies**
   From the project root:
   ```bash
   npm run install:all
   ```
   Or install individually:
   ```bash
   npm run install:backend
   npm run install:student
   npm run install:teacher
   ```

3. **Configure environment variables**
   
   **Backend** — Ensure `backend/.env` is configured:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Required: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `JWT_SECRET`, `FRONTEND_URL`

   **Student App** — In `student-app/.env`:
   ```env
   VITE_API_URL=http://localhost:3001
   ```

   **Teacher App** — In `teacher-app/.env`:
   ```env
   VITE_API_URL=http://localhost:3001
   ```

4. **Start Backend Server**
   From the project root:
   ```bash
   npm run dev:server
   ```
   *(Or navigate into `backend` and run `npm start` or `npm run dev`)*
   Backend runs on `http://localhost:3001`

5. **Start Frontend Applications**
   Open separate terminal windows and run from the project root:

   - **Student Portal** (runs on `http://localhost:5173`):
     ```bash
     npm run dev:student
     ```
     *(Or inside `student-app/`: `npm run dev`)*

   - **Teacher Portal** (runs on `http://localhost:5174`):
     ```bash
     npm run dev:teacher
     ```
     *(Or inside `teacher-app/`: `npm run dev`)*

## Available Scripts

### From Project Root
| Command | Description |
|---------|-------------|
| `npm run dev:server` / `dev:backend` | Start Express backend server (`:3001`) |
| `npm run dev:student` | Start Student Vite frontend (`:5173`) |
| `npm run dev:teacher` | Start Teacher Vite frontend (`:5174`) |
| `npm run install:all` | Install all dependencies across all apps |
| `npm run build:student` | Build Student app for production |
| `npm run build:teacher` | Build Teacher app for production |

### From Subdirectories
| Directory | Command | Description |
|-----------|---------|-------------|
| `backend/` | `npm start` or `npm run dev` | Start backend server |
| `student-app/` | `npm run dev` | Start Student dev server |
| `teacher-app/` | `npm run dev` | Start Teacher dev server |

## Database Configuration

The application uses Aiven MySQL with SSL. The database configuration is in `backend/db.js`. The connection automatically:
- Creates all necessary tables on first run
- Handles SSL connections
- Manages connection pooling

## Deployment

### Backend → Render
- Set root directory to `backend`
- Build command: `npm install`
- Start command: `npm start`
- Add environment variables (DB credentials, JWT secret, FRONTEND_URL)

### Frontend → Vercel
- Framework: Vite
- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Add `VITE_API_URL` environment variable pointing to your Render backend URL

### Update CORS
Set `FRONTEND_URL` in the Render backend to your Vercel frontend URL.

## API Endpoints

- `POST /api/auth/login` — User login
- `POST /api/auth/register` — User registration
- `GET /api/quizzes` — Get quizzes
- `POST /api/quizzes` — Create quiz
- `GET /api/classes` — Get classes
- `POST /api/classes` — Create class
- ... and more (see route files in `backend/routes/`)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

ISC
