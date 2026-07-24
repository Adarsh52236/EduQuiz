import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Award, Clock, TrendingUp, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface QuizAttempt {
  id: string;
  studentId: string;
  studentName: string;
  score: number;
  totalPoints: number;
  timeTaken: number;
  submittedAt: string;
  accuracy: number;
}

interface QuizDetails {
  id: string;
  title: string;
  description: string;
  totalPoints: number;
  timeLimit: number;
}

interface QuestionAnalytics {
  questionId: string;
  questionText: string;
  totalAttempts: number;
  correctAttempts: number;
  difficulty: string;
}

export default function QuizAnalytics() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizDetails | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [questionAnalytics, setQuestionAnalytics] = useState<QuestionAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = async (url: string) => {
    console.log('[QuizAnalytics] Fetching:', url);
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[QuizAnalytics] Error response:', response.status, errorText);
      throw new Error(`Failed to fetch data from ${url}: ${response.status} ${response.statusText}`);
    }

    return response.json();
  };

  useEffect(() => {
    loadQuizAnalytics();
  }, [quizId]);

  const loadQuizAnalytics = async () => {
    console.log('[QuizAnalytics] Loading analytics for quiz:', quizId);
    setLoading(true);
    try {
      // Fetch quiz details
      console.log('[QuizAnalytics] Fetching quiz details...');
      const quizData = await fetchWithAuth(`/api/quizzes/${quizId}`);
      console.log('[QuizAnalytics] Quiz data:', quizData);
      setQuiz(quizData);

      // Fetch all attempts for this quiz
      console.log('[QuizAnalytics] Fetching attempts...');
      const attemptsData = await fetchWithAuth(`/api/attempts?quizId=${quizId}&isCompleted=true`);
      console.log('[QuizAnalytics] Attempts data:', attemptsData);
      
      const processedAttempts = attemptsData.map((attempt: any) => ({
        ...attempt,
        accuracy: attempt.totalPoints > 0 ? (attempt.score / attempt.totalPoints) * 100 : 0
      }));

      setAttempts(processedAttempts);

      // Fetch question-level analytics
      await loadQuestionAnalytics(processedAttempts);

    } catch (error: any) {
      console.error('[QuizAnalytics] Error loading quiz analytics:', error);
      toast.error(`Failed to load analytics: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestionAnalytics = async (attemptsData: QuizAttempt[]) => {
    try {
      console.log('[QuizAnalytics] Fetching questions...');
      const questions = await fetchWithAuth(`/api/quizzes/${quizId}/questions`);
      console.log('[QuizAnalytics] Questions:', questions.length);
      
      const analytics = await Promise.all(questions.map(async (question: any) => {
        // Get all answers for this question
        const answers = await fetchWithAuth(`/api/answers?questionId=${question.id}`);
        
        const totalAttempts = answers.length;
        const correctAttempts = answers.filter((a: any) => a.isCorrect).length;
        const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

        let difficulty = 'Medium';
        if (accuracy >= 80) difficulty = 'Easy';
        else if (accuracy < 50) difficulty = 'Hard';

        return {
          questionId: question.id,
          questionText: question.questionText,
          totalAttempts,
          correctAttempts,
          difficulty
        };
      }));

      console.log('[QuizAnalytics] Question analytics:', analytics);
      setQuestionAnalytics(analytics);
    } catch (error: any) {
      console.error('[QuizAnalytics] Error loading question analytics:', error);
      toast.error(`Failed to load question analytics: ${error.message}`);
    }
  };

  const exportData = () => {
    // Create CSV content
    const csvContent = [
      ['Student Name', 'Score', 'Total Points', 'Accuracy %', 'Time Taken (min)', 'Submitted At'].join(','),
      ...attempts.map(attempt => [
        attempt.studentName,
        attempt.score,
        attempt.totalPoints,
        attempt.accuracy.toFixed(2),
        Math.round(attempt.timeTaken / 60),
        new Date(attempt.submittedAt).toLocaleString()
      ].join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz?.title || 'quiz'}-analytics.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analytics exported successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Quiz not found</p>
        <Button onClick={() => navigate('/teacher/quizzes')} className="mt-4">
          Back to Quizzes
        </Button>
      </div>
    );
  }

  const avgScore = attempts.length > 0
    ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
    : 0;

  const avgAccuracy = attempts.length > 0
    ? attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length
    : 0;

  const avgTime = attempts.length > 0
    ? attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length / 60
    : 0;

  const topPerformers = [...attempts].sort((a, b) => b.score - a.score).slice(0, 5);
  const bottomPerformers = [...attempts].sort((a, b) => a.score - b.score).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/teacher/quizzes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold">{quiz.title}</h2>
            <p className="text-muted-foreground">{quiz.description}</p>
          </div>
        </div>
        <Button onClick={exportData}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attempts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgScore.toFixed(1)} / {quiz.totalPoints}
            </div>
            <Progress value={avgAccuracy} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgAccuracy.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgTime.toFixed(1)} min</div>
          </CardContent>
        </Card>
      </div>

      {/* Question Difficulty Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Question Difficulty Analysis</CardTitle>
          <CardDescription>Performance breakdown by question</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {questionAnalytics.map((qa, index) => (
              <div key={qa.questionId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Q{index + 1}: {qa.questionText}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {qa.correctAttempts} / {qa.totalAttempts} correct
                    </p>
                  </div>
                  <Badge
                    variant={qa.difficulty === 'Easy' ? 'default' : qa.difficulty === 'Hard' ? 'destructive' : 'secondary'}
                  >
                    {qa.difficulty}
                  </Badge>
                </div>
                <Progress
                  value={(qa.correctAttempts / qa.totalAttempts) * 100}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top & Bottom Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Accuracy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPerformers.map((attempt, index) => (
                  <TableRow key={attempt.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{attempt.studentName}</TableCell>
                    <TableCell>
                      {attempt.score} / {attempt.totalPoints}
                    </TableCell>
                    <TableCell>{attempt.accuracy.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Students Needing Support</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Accuracy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bottomPerformers.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-medium">{attempt.studentName}</TableCell>
                    <TableCell>
                      {attempt.score} / {attempt.totalPoints}
                    </TableCell>
                    <TableCell>{attempt.accuracy.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* All Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>All Submissions</CardTitle>
          <CardDescription>Complete list of student attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Accuracy</TableHead>
                <TableHead>Time Taken</TableHead>
                <TableHead>Submitted At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell className="font-medium">{attempt.studentName}</TableCell>
                  <TableCell>
                    {attempt.score} / {attempt.totalPoints}
                  </TableCell>
                  <TableCell>
                    <Badge variant={attempt.accuracy >= 70 ? 'default' : attempt.accuracy >= 50 ? 'secondary' : 'destructive'}>
                      {attempt.accuracy.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell>{Math.round(attempt.timeTaken / 60)} min</TableCell>
                  <TableCell>{new Date(attempt.submittedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
