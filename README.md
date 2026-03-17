# Quiz Web Application

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

## Quick Start

### Prerequisites

- Node.js 18+ installed
- MySQL database (Aiven MySQL configured)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Adarsh52236/Quiz_web.git
   cd Quiz_web
   ```

2. **Set up Backend**
   ```bash
   cd backend
   npm install
   ```
   
   Copy `backend/.env.example` to `backend/.env` and fill in your database and JWT values:
   ```bash
   cp .env.example .env
   ```
   Required variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV`.

3. **Start Backend Server**
   ```bash
   cd backend
   npm start
   ```
   Backend will run on `http://localhost:3001`

4. **Set up Frontend**
   ```bash
   # From project root
   npm install
   ```
   
   Create a `.env` file in the root folder:
   ```env
   VITE_API_URL=http://localhost:3001
   ```

5. **Start Frontend Development Server**
   ```bash
   npm run dev
   ```
   Frontend will run on `http://localhost:5173`

## Project Structure

```
Quiz_web/
├── backend/           # Express.js backend server
│   ├── routes/        # API routes
│   ├── db.js          # Database configuration
│   └── index.js       # Server entry point
├── src/               # React frontend
│   ├── components/    # React components
│   ├── pages/         # Page components
│   ├── contexts/      # React contexts
│   └── config/        # Configuration files
├── dist/              # Production build output
└── public/            # Static assets
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deployment Summary

1. **Deploy Backend** to Render
   - Set root directory to `backend`
   - Build command: `npm install`
   - Start command: `npm start`
   - Add environment variables (see DEPLOYMENT.md)

2. **Deploy Frontend** to Vercel
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
   - Add `VITE_API_URL` environment variable pointing to your Render backend URL

3. **Update CORS**: Set `FRONTEND_URL` in Render backend to your Vercel frontend URL

## Available Scripts

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Backend
- `npm start` - Start production server
- `npm run dev` - Start development server (if configured)

## Database Configuration

The application uses Aiven MySQL with SSL. The database configuration is in `backend/db.js`. The connection automatically:
- Creates all necessary tables on first run
- Handles SSL connections
- Manages connection pooling

## Environment Variables

### Backend (.env)
- `DB_HOST` - MySQL host
- `DB_PORT` - MySQL port
- `DB_USER` - MySQL username
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - Database name
- `PORT` - Backend server port
- `JWT_SECRET` - Secret for JWT tokens
- `FRONTEND_URL` - Frontend URL for CORS

### Frontend (.env)
- `VITE_API_URL` - Backend API URL

## API Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/quizzes` - Get quizzes
- `POST /api/quizzes` - Create quiz
- `GET /api/classes` - Get classes
- `POST /api/classes` - Create class
- ... and more (see route files in `backend/routes/`)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

ISC

## Support

For deployment help, see [DEPLOYMENT.md](./DEPLOYMENT.md)
