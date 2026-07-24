import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Users, BarChart3, Award, BookOpen, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <GraduationCap className="h-12 w-12 text-primary" />
            <h1 className="text-5xl font-bold">EduQuiz</h1>
          </div>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Empower teachers to create engaging classroom quizzes and analyze student performance with detailed insights and analytics.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/auth/teacher/sign-in">
              <Button size="lg" className="text-lg px-8">
                I'm a Teacher
              </Button>
            </Link>
            <Link to="/auth/student/sign-in">
              <Button size="lg" variant="outline" className="text-lg px-8">
                I'm a Student
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Everything You Need for Effective Assessment</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <BookOpen className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Quiz Creation</CardTitle>
                <CardDescription>
                  Create multiple-choice, true/false, and short-answer questions with custom scoring and time limits.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Class Management</CardTitle>
                <CardDescription>
                  Organize students into classes, share class codes, and manage enrollments effortlessly.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Detailed Analytics</CardTitle>
                <CardDescription>
                  Visualize student performance with interactive charts, identify strengths and weaknesses.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Award className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Grade Cards</CardTitle>
                <CardDescription>
                  Automatically generate professional PDF grade cards with performance metrics and rankings.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Student Connections</CardTitle>
                <CardDescription>
                  Students can connect with classmates, view profiles, and collaborate on learning.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Real-time Tracking</CardTitle>
                <CardDescription>
                  Monitor quiz attempts in real-time and get instant notifications about student progress.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary/5 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Transform Your Classroom?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of educators using EduQuiz to make assessment easier and more effective.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/auth/teacher/sign-in">
              <Button size="lg" className="text-lg px-8">
                Get Started as Teacher
              </Button>
            </Link>
            <Link to="/auth/student/sign-in">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Join as Student
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground">
          <p>&copy; 2025 EduQuiz. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
