import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';

// Layouts
import { TeacherLayout } from './components/layout/TeacherLayout';

// Pages
import LandingPage from './pages/LandingPage';
import TeacherAuth from './pages/auth/TeacherAuth';
// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherAnalytics from "./pages/teacher/Analytics/TeacherAnalytics";
import TeacherClasses from "./pages/teacher/TeacherClasses";
import TeacherQuizzes from "./pages/teacher/TeacherQuizzes";
import CreateQuiz from "./pages/teacher/CreateQuiz";
import QuizEditor from "./pages/teacher/QuizEditor/QuizEditor";
import QuizAnalytics from "./pages/teacher/QuizAnalytics";

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/teacher/sign-in" element={<TeacherAuth />} />
          <Route path="/auth/teacher/sign-up" element={<TeacherAuth />} />

          {/* Teacher Routes */}
          <Route
            path="/teacher/*"
            element={
              <ProtectedRoute requiredRole="teacher">
                <TeacherLayout>
                  <Routes>
                    <Route path="dashboard" element={<TeacherDashboard />} />
                    <Route path="quizzes" element={<TeacherQuizzes />} />
                    <Route path="quizzes/create" element={<CreateQuiz />} />
                    <Route path="quizzes/:quizId" element={<QuizEditor />} />
                    <Route path="quizzes/:quizId/analytics" element={<QuizAnalytics />} />
                    <Route path="classes" element={<TeacherClasses />} />
                    <Route path="analytics" element={<TeacherAnalytics />} />
                    <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
                  </Routes>
                </TeacherLayout>
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