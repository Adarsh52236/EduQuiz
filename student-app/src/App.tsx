import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';

// Layouts
import { StudentLayout } from './components/layout/StudentLayout';

// Pages
import LandingPage from './pages/LandingPage';
import StudentAuth from './pages/auth/StudentAuth';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import AutoEnroll from './pages/student/AutoEnroll';

// Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentProfile from './pages/student/Profile/StudentProfile';
import ViewStudentProfile from './pages/student/Profile/ViewStudentProfile';
import StudentQuizzes from './pages/student/Quiz/StudentQuizzes';
import QuizTaking from './pages/student/Quiz/QuizTaking';
import QuizReview from './pages/student/Quiz/QuizReview';
import Connections from './pages/student/Connections/Connections';
import { StudentGradeCard } from './pages/student/StudentGradeCard';
import StudentEnroll from './pages/student/StudentEnroll'; // Import StudentEnroll
import StudentLeaderboard from './pages/student/StudentLeaderboard'; // Import StudentLeaderboard
import { StudentAnalytics } from './pages/student/StudentAnalytics'; // Import StudentAnalytics
import Arena from './pages/student/Arena/Arena';
import PracticeQuestionsPage from './pages/student/PracticeQuestionsPage';


import { useEffect } from 'react';

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.href = to;
  }, [to]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="text-muted-foreground animate-pulse">Redirecting to Teacher Portal...</p>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/student/sign-in" element={<StudentAuth />} />
          <Route path="/auth/student/sign-up" element={<StudentAuth />} />
          <Route path="/auth/student/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/student/reset-password" element={<ResetPassword />} />
          <Route path="/join/:classCode" element={<AutoEnroll />} />
          <Route path="/enroll/:classCode" element={<AutoEnroll />} />

          {/* Cross-App Bridge: Redirect Teacher URLs to Teacher App (Port 5174) */}
          <Route path="/auth/teacher/*" element={<ExternalRedirect to="http://localhost:5174/auth/teacher/sign-in" />} />
          <Route path="/teacher/*" element={<ExternalRedirect to="http://localhost:5174/teacher/dashboard" />} />

          {/* Student Routes */}
          <Route
            path="/student/*"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentLayout>
                  <Routes>
                    <Route path="dashboard" element={<StudentDashboard />} />
                    <Route path="profile" element={<StudentProfile />} />
                    <Route path="profile/:studentId" element={<ViewStudentProfile />} />
                    <Route path="quizzes" element={<StudentQuizzes />} />
                    <Route path="quiz/:quizId" element={<QuizTaking />} />
                    <Route path="quiz/:quizId/review" element={<QuizReview />} />
                    <Route path="connections" element={<Connections />} />
                    <Route path="grade-card" element={<StudentGradeCard />} />
                    <Route path="enroll" element={<StudentEnroll />} /> {/* New route for enrollment */}
                    <Route path="leaderboard" element={<StudentLeaderboard />} /> {/* New route for leaderboard */}
                    <Route path="analytics" element={<StudentAnalytics />} /> {/* New route for analytics */}
                    <Route path="arena" element={<Arena />} />
                    <Route path="questions" element={<PracticeQuestionsPage />} />
                    <Route path="practice" element={<PracticeQuestionsPage />} />
                    <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
                  </Routes>
                </StudentLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
        <SonnerToaster position="top-right" richColors />
      </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;