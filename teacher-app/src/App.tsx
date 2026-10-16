import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';

// Layouts
import { TeacherLayout } from './components/layout/TeacherLayout';

// Pages
import TeacherAuth from './pages/auth/TeacherAuth';
// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherAnalytics from "./pages/teacher/Analytics/TeacherAnalytics";
import TeacherClasses from "./pages/teacher/TeacherClasses";
import TeacherQuizzes from "./pages/teacher/TeacherQuizzes";
import CreateQuiz from "./pages/teacher/CreateQuiz";
import QuizEditor from "./pages/teacher/QuizEditor/QuizEditor";
import QuizAnalytics from "./pages/teacher/QuizAnalytics";
import TeacherNetwork from "./pages/teacher/TeacherNetwork";

import { useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.href = to;
  }, [to]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="text-muted-foreground animate-pulse">Redirecting to Student Portal...</p>
    </div>
  );
}

function TeacherRootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      </div>
    );
  }
  if (isAuthenticated && user?.role === 'teacher') {
    return <Navigate to="/teacher/dashboard" replace />;
  }
  return <Navigate to="/auth/teacher/sign-in" replace />;
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Routes - No duplicate landing page on 5174; redirect to sign-in or dashboard */}
          <Route path="/" element={<TeacherRootRedirect />} />
          <Route path="/auth/teacher/sign-in" element={<TeacherAuth />} />
          <Route path="/auth/teacher/sign-up" element={<TeacherAuth />} />

          {/* Cross-App Bridge: Redirect Student URLs to Student App (Port 5173) */}
          <Route path="/auth/student/*" element={<ExternalRedirect to="http://localhost:5173/auth/student/sign-in" />} />
          <Route path="/student/*" element={<ExternalRedirect to="http://localhost:5173/student/dashboard" />} />

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
                    <Route path="network" element={<TeacherNetwork />} />
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
        <Toaster />
        <SonnerToaster position="top-right" richColors />
      </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;