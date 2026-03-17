import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Clock, CheckCircle, Search, Loader2, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  type: string;
  classId: string | null;
  timeLimit: number | null;
  totalPoints: number;
  startTime: string | null;
  endTime: string | null;
  isPublished: boolean;
  status: 'Active' | 'Upcoming' | 'Closed' | 'Draft';
  teacherName: string;
  className: string | null;
  canTake: boolean;
}

interface QuizAttempt {
  id: string;
  quizId: string;
  score: number;
  totalPoints: number;
  submittedAt: string;
  timeTaken: number;
  isCompleted: boolean;
}

const StudentQuizzes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming' | 'closed'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      
      // Fetch quizzes
      const quizzesResponse = await fetch('/api/quizzes', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!quizzesResponse.ok) {
        throw new Error('Failed to load quizzes');
      }

      const quizzesData: Quiz[] = await quizzesResponse.json();
      console.log(`[StudentQuizzes] Loaded ${quizzesData.length} quizzes`);
      setQuizzes(quizzesData);

      // Fetch attempts
      const attemptsResponse = await fetch('/api/attempts?isCompleted=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (attemptsResponse.ok) {
        const attemptsData: QuizAttempt[] = await attemptsResponse.json();
        console.log(`[StudentQuizzes] Loaded ${attemptsData.length} completed attempts`);
        setAttempts(attemptsData);
      }

    } catch (err: any) {
      console.error('[StudentQuizzes] Error loading data:', err);
      setError(err.message || 'Failed to load quizzes');
      toast.error(err.message || 'Failed to load quizzes');
    } finally {
      setIsLoading(false);
    }
  };

  const getQuizAttemptInfo = (quizId: string) => {
    const quizAttempts = attempts.filter(a => a.quizId === quizId);
    if (quizAttempts.length === 0) {
      return null;
    }
    
    const bestAttempt = quizAttempts.reduce((best, current) => {
      const bestScore = best.score / best.totalPoints;
      const currentScore = current.score / current.totalPoints;
      return currentScore > bestScore ? current : best;
    });

    return {
      bestScore: Math.round((bestAttempt.score / bestAttempt.totalPoints) * 100),
      attemptsCount: quizAttempts.length,
      lastAttempted: new Date(bestAttempt.submittedAt).toLocaleDateString()
    };
  };

  const filteredQuizzes = quizzes.filter(quiz => {
    // Search filter
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (quiz.className && quiz.className.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (quiz.teacherName && quiz.teacherName.toLowerCase().includes(searchTerm.toLowerCase()));

    // Status filter
    const matchesStatus = filterStatus === 'all' || 
                         quiz.status.toLowerCase() === filterStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const availableQuizzes = filteredQuizzes.filter(q => {
    const attemptInfo = getQuizAttemptInfo(q.id);
    return !attemptInfo || q.status === 'Active'; // Show active quizzes even if attempted
  });

  const completedQuizzes = filteredQuizzes.filter(q => {
    const attemptInfo = getQuizAttemptInfo(q.id);
    return attemptInfo !== null;
  }).map(q => ({
    quiz: q,
    attempt: attempts.find(a => a.quizId === q.id && a.isCompleted)
  }));

  const handleStartQuiz = (quizId: string) => {
    navigate(`/student/quiz/${quizId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading quizzes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Quizzes</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={loadData}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">My Quizzes</h2>
        <p className="text-muted-foreground">View and take quizzes assigned to your classes</p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search quizzes by title, class, or teacher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
            size="sm"
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'active' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('active')}
            size="sm"
          >
            Active
          </Button>
          <Button
            variant={filterStatus === 'upcoming' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('upcoming')}
            size="sm"
          >
            Upcoming
          </Button>
          <Button
            variant={filterStatus === 'closed' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('closed')}
            size="sm"
          >
            Closed
          </Button>
        </div>
      </div>

      <Tabs defaultValue="available" className="space-y-4">
        <TabsList>
          <TabsTrigger value="available">
            Available ({availableQuizzes.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedQuizzes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {availableQuizzes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No available quizzes</h3>
                <p className="text-muted-foreground text-center">
                  {quizzes.length === 0 
                    ? "You haven't been assigned any quizzes yet. Check back later!"
                    : "No quizzes match your current filters."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableQuizzes.map((quiz) => {
                const attemptInfo = getQuizAttemptInfo(quiz.id);
                const canTake = quiz.status === 'Active' && quiz.canTake;

                return (
                  <Card key={quiz.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg line-clamp-2">{quiz.title}</CardTitle>
                        <Badge 
                          variant={
                            quiz.status === 'Active' ? 'default' :
                            quiz.status === 'Upcoming' ? 'secondary' :
                            'outline'
                          }
                          className="ml-2 shrink-0"
                        >
                          {quiz.status}
                        </Badge>
                      </div>
                      {quiz.description && (
                        <CardDescription className="line-clamp-2 mt-2">
                          {quiz.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="space-y-2 mb-4 flex-1">
                        {quiz.className && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Class</span>
                            <span className="font-medium">{quiz.className}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Teacher</span>
                          <span className="font-medium">{quiz.teacherName}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Points</span>
                          <span className="font-medium">{quiz.totalPoints}</span>
                        </div>
                        {quiz.timeLimit && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{quiz.timeLimit} minutes</span>
                          </div>
                        )}
                        {quiz.startTime && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Starts</span>
                            <span className="font-medium text-xs">
                              {new Date(quiz.startTime).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {quiz.endTime && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Ends</span>
                            <span className="font-medium text-xs">
                              {new Date(quiz.endTime).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {attemptInfo && (
                          <div className="pt-2 border-t">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Best Score</span>
                              <Badge variant="secondary">{attemptInfo.bestScore}%</Badge>
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => handleStartQuiz(quiz.id)}
                        disabled={!canTake}
                        className="w-full"
                        variant={canTake ? 'default' : 'outline'}
                      >
                        {canTake ? 'Start Quiz' : quiz.status === 'Upcoming' ? 'Not Started Yet' : 'Quiz Closed'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedQuizzes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No completed quizzes</h3>
                <p className="text-muted-foreground">Complete your first quiz to see results here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {completedQuizzes.map(({ quiz, attempt }) => {
                if (!attempt) return null;
                const scorePercentage = Math.round((attempt.score / attempt.totalPoints) * 100);

                return (
                  <Card key={quiz.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{quiz.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {quiz.className && `${quiz.className} • `}
                            Completed {new Date(attempt.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <Badge 
                            variant={scorePercentage >= 70 ? 'default' : scorePercentage >= 50 ? 'secondary' : 'destructive'}
                            className="text-lg px-3 py-1"
                          >
                            {scorePercentage}%
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {attempt.score} / {attempt.totalPoints} points
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/student/quiz/${quiz.id}/review?attemptId=${attempt.id}`)}
                          className="flex-1"
                        >
                          View Results
                        </Button>
                        {quiz.status === 'Active' && (
                          <Button
                            size="sm"
                            onClick={() => handleStartQuiz(quiz.id)}
                            className="flex-1"
                          >
                            Retake Quiz
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentQuizzes;
