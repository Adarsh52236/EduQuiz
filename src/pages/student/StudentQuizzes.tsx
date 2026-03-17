import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, CheckCircle, Clock } from 'lucide-react';
import { Quiz, QuizAttempt, ClassEnrollment } from '@/types';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

export function StudentQuizzes() {
  const { user } = useAuth();
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [completedAttempts, setCompletedAttempts] = useState<QuizAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadQuizzes();
  }, [user]);

  const loadQuizzes = async () => {
    if (!user) return;
    try {
      // Fetch quizzes relevant to the authenticated student (backend handles filtering by enrollment and published status)
      const quizzesResponse = await fetch('/api/quizzes', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const allStudentQuizzes: Quiz[] = await quizzesResponse.json();

      // Fetch all quiz attempts for the student
      const attemptsResponse = await fetch(`/api/attempts?studentId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const allAttempts: QuizAttempt[] = await attemptsResponse.json();

      // Separate available and completed quizzes
      const completedQuizIds = new Set(allAttempts.filter(a => a.isCompleted).map(a => a.quizId));
      
      const available = allStudentQuizzes.filter(q => !completedQuizIds.has(q.id));
      const completed = allAttempts.filter(a => a.isCompleted);
      
      setAvailableQuizzes(available);
      setCompletedAttempts(completed);

    } catch (error) {
      console.error('Error loading quizzes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">My Quizzes</h2>
        <p className="text-muted-foreground">View and take assigned quizzes</p>
      </div>

      <Tabs defaultValue="available">
        <TabsList>
          <TabsTrigger value="available">
            Available ({availableQuizzes.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedAttempts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {availableQuizzes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No available quizzes</h3>
                <p className="text-muted-foreground">Check back later for new assignments</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableQuizzes.map((quiz) => (
                <Card key={quiz.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg">{quiz.title}</CardTitle>
                    <Badge variant={quiz.status === 'Active' ? 'default' : quiz.status === 'Upcoming' ? 'secondary' : 'outline'}>
                      {quiz.status}
                    </Badge>
                  </CardHeader>
                  <CardDescription className="line-clamp-2 px-6">
                    {quiz.description || 'No description provided'}
                  </CardDescription>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Teacher</span>
                        <span className="font-medium">{quiz.teacherName}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total Points</span>
                        <span className="font-medium">{quiz.totalPoints}</span>
                      </div>
                      {quiz.timeLimit && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{quiz.timeLimit} minutes</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Starts</span>
                        <span className="font-medium">{quiz.startTime ? new Date(quiz.startTime).toLocaleString() : 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Ends</span>
                        <span className="font-medium">{quiz.endTime ? new Date(quiz.endTime).toLocaleString() : 'N/A'}</span>
                      </div>
                      <Link to={`/student/quizzes/${quiz.id}`} className="w-full">
                        <Button className="w-full">
                          Start Quiz
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedAttempts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No completed quizzes</h3>
                <p className="text-muted-foreground">Complete your first quiz to see results here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {completedAttempts.map((attempt) => (
                <Card key={attempt.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <h4 className="font-medium">Quiz Attempt</h4>
                      <p className="text-sm text-muted-foreground">
                        Completed {new Date(attempt.submittedAt || attempt.startedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={attempt.score && attempt.score >= (attempt.totalPoints * 0.7) ? 'default' : 'secondary'}>
                        {attempt.score || 0} / {attempt.totalPoints}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        {attempt.score ? Math.round((attempt.score / attempt.totalPoints) * 100) : 0}%
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}