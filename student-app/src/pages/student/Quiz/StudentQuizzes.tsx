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
    // Sort chronological first to determine attempt numbers (Attempt #1, #2...)
    const chronologicalAttempts = attempts
      .filter(a => a.quizId === quizId && a.isCompleted)
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

    if (chronologicalAttempts.length === 0) {
      return null;
    }

    const attemptsWithIndex = chronologicalAttempts.map((a, index) => ({
      ...a,
      attemptNumber: index + 1,
      percentage: Math.round(((a.score || 0) / (a.totalPoints || 1)) * 100)
    }));

    // Newest attempt first for recent listings
    const sortedDesc = [...attemptsWithIndex].reverse();

    const bestAttempt = attemptsWithIndex.reduce((best, current) => {
      const bestScore = (best.score || 0) / (best.totalPoints || 1);
      const currentScore = (current.score || 0) / (current.totalPoints || 1);
      return currentScore > bestScore ? current : best;
    }, attemptsWithIndex[0]);

    const latestAttempt = sortedDesc[0];

    return {
      bestScore: bestAttempt.percentage,
      bestAttempt,
      latestScore: latestAttempt.percentage,
      latestAttempt,
      attemptsCount: attemptsWithIndex.length,
      allAttempts: sortedDesc, // newest first
      lastAttempted: new Date(latestAttempt.submittedAt).toLocaleDateString()
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
  }).map(q => {
    const attemptInfo = getQuizAttemptInfo(q.id)!;
    return {
      quiz: q,
      attemptInfo,
      latestAttempt: attemptInfo.latestAttempt,
      attempts: attemptInfo.allAttempts
    };
  });

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
                            <span className="font-medium">{quiz.className || (quiz as any).classname}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Teacher</span>
                          <span className="font-medium">{quiz.teacherName || (quiz as any).teachername || 'Instructor'}</span>
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
                          <div className="pt-2 border-t space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">
                                Attempts: {attemptInfo.attemptsCount}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-xs">
                                  Latest: {attemptInfo.latestScore}%
                                </Badge>
                                <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                  Best: {attemptInfo.bestScore}%
                                </Badge>
                              </div>
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
            <div className="space-y-4">
              {completedQuizzes.map(({ quiz, attemptInfo, latestAttempt, attempts }) => {
                return (
                  <Card key={quiz.id} className="border border-white/10 bg-card/60">
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h4 className="font-bold text-lg text-white">{quiz.title}</h4>
                            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                              {attemptInfo.attemptsCount} {attemptInfo.attemptsCount === 1 ? 'Attempt' : 'Attempts'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {quiz.className && `${quiz.className} • `}
                            Instructor: {quiz.teacherName || 'Instructor'} • Last taken on {new Date(latestAttempt.submittedAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Latest Score</p>
                            <Badge 
                              variant={latestAttempt.percentage >= 70 ? 'default' : latestAttempt.percentage >= 50 ? 'secondary' : 'destructive'}
                              className="text-base px-2.5 py-0.5 mt-0.5"
                            >
                              {latestAttempt.percentage}%
                            </Badge>
                          </div>
                          <div className="text-right pl-3 border-l border-white/10">
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Best Score</p>
                            <Badge 
                              variant={attemptInfo.bestScore >= 70 ? 'default' : attemptInfo.bestScore >= 50 ? 'secondary' : 'destructive'}
                              className="text-base px-2.5 py-0.5 mt-0.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            >
                              {attemptInfo.bestScore}%
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* All Attempts History Breakdown */}
                      <div className="my-4">
                        <p className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          All Completed Attempts ({attempts.length}):
                        </p>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {attempts.map((att: any) => (
                            <div 
                              key={att.id}
                              className="flex items-center justify-between p-3.5 rounded-lg bg-black/40 border border-white/5 hover:border-white/20 transition-all text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-sm">Attempt #{att.attemptNumber}</span>
                                  {att.id === latestAttempt.id && (
                                    <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.2 rounded font-medium">
                                      Latest
                                    </span>
                                  )}
                                  {att.percentage === attemptInfo.bestScore && (
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-medium">
                                      Best
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">
                                  {new Date(att.submittedAt).toLocaleDateString()} at {new Date(att.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <span className={`font-bold text-base ${
                                    att.percentage >= 70 ? 'text-emerald-400' : att.percentage >= 50 ? 'text-yellow-400' : 'text-rose-400'
                                  }`}>
                                    {att.percentage}%
                                  </span>
                                  <p className="text-[10px] text-slate-400">{att.score} / {att.totalPoints} pts</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/student/quiz/${quiz.id}/review?attemptId=${att.id}`)}
                                  className="h-8 text-xs border-white/10 hover:bg-white/10 px-3"
                                >
                                  Review
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 flex justify-end gap-2 border-t border-white/5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/student/quiz/${quiz.id}/review?attemptId=${latestAttempt.id}`)}
                          className="text-xs"
                        >
                          Review Latest ({latestAttempt.percentage}%)
                        </Button>
                        {quiz.status === 'Active' && (
                          <Button
                            size="sm"
                            onClick={() => handleStartQuiz(quiz.id)}
                            className="text-xs bg-primary hover:bg-primary/90"
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
