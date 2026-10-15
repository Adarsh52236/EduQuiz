import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Check, X, HelpCircle, Loader2, ArrowLeft, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface QuestionReview {
  id: string;
  questionText: string;
  questionType: 'multiple-choice' | 'true-false' | 'short-answer';
  options: string[] | null;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  points: number;
  pointsEarned: number;
}

interface QuizReviewData {
  quizId: string;
  quizTitle: string;
  attemptId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  submittedAt: string;
  timeTaken: number;
  timeUtilizationPercent: number | null;
  questions: QuestionReview[];
}

interface AttemptSummary {
  id: string;
  attemptNumber: number;
  score: number;
  totalPoints: number;
  percentage: number;
  submittedAt: string;
  timeTaken: number;
  isLatest: boolean;
  isBest: boolean;
}

const QuizReview = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviewData, setReviewData] = useState<QuizReviewData | null>(null);
  const [allAttempts, setAllAttempts] = useState<AttemptSummary[]>([]);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [votedImpQuestions, setVotedImpQuestions] = useState<Set<string>>(new Set());
  const [impCounts, setImpCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAttempt, setIsLoadingAttempt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleImp = async (questionId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/practice/questions/${questionId}/rate-imp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVotedImpQuestions(prev => {
          const next = new Set(prev);
          if (data.hasVotedImp) next.add(questionId);
          else next.delete(questionId);
          return next;
        });
        setImpCounts(prev => ({
          ...prev,
          [questionId]: data.impVotesCount
        }));
        toast.success(data.message);
      }
    } catch (err) {
      toast.error('Failed to rate question as IMP');
    }
  };

  useEffect(() => {
    if (!quizId || !user) return;
    loadReviewData();
  }, [quizId, user]);

  const loadReviewData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const urlAttemptId = searchParams.get('attemptId');

      // Fetch all completed attempts for this quiz
      const attemptsResponse = await fetch(`/api/attempts?quizId=${quizId}&isCompleted=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!attemptsResponse.ok) {
        throw new Error('Failed to load quiz attempts');
      }

      const rawAttempts = await attemptsResponse.json();
      const completedAttempts = rawAttempts.filter((a: any) => a.isCompleted);

      if (completedAttempts.length === 0) {
        setError('No completed attempts found for this quiz');
        setIsLoading(false);
        return;
      }

      // Sort chronologically (oldest first) to establish attempt numbers: #1, #2...
      const chronological = [...completedAttempts].sort((a: any, b: any) => 
        new Date(a.submittedAt || a.startedAt).getTime() - new Date(b.submittedAt || b.startedAt).getTime()
      );

      // Find highest score percentage
      let highestPercent = -1;
      chronological.forEach((a: any) => {
        const pct = a.totalPoints > 0 ? (a.score / a.totalPoints) * 100 : 0;
        if (pct > highestPercent) highestPercent = pct;
      });

      const processedAttempts: AttemptSummary[] = chronological.map((a: any, idx: number) => {
        const pct = a.totalPoints > 0 ? Math.round((a.score / a.totalPoints) * 100) : 0;
        return {
          id: a.id,
          attemptNumber: idx + 1,
          score: a.score,
          totalPoints: a.totalPoints,
          percentage: pct,
          submittedAt: a.submittedAt,
          timeTaken: a.timeTaken,
          isLatest: idx === chronological.length - 1,
          isBest: pct === Math.round(highestPercent) && highestPercent >= 0
        };
      });

      setAllAttempts(processedAttempts);

      // Determine which attempt to view: URL attemptId if valid, else latest attempt
      let targetAttemptId = urlAttemptId;
      if (!targetAttemptId || !processedAttempts.some(a => a.id === targetAttemptId)) {
        targetAttemptId = processedAttempts[processedAttempts.length - 1].id;
      }

      setCurrentAttemptId(targetAttemptId);
      await loadAttemptDetails(targetAttemptId, token!);
    } catch (error: any) {
      console.error('Error loading review data:', error);
      setError(error.message || 'Failed to load quiz review');
      toast.error(error.message || 'Failed to load quiz review');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAttempt = async (attemptId: string) => {
    if (attemptId === currentAttemptId || isLoadingAttempt) return;
    setIsLoadingAttempt(true);
    setCurrentAttemptId(attemptId);
    navigate(`/student/quiz/${quizId}/review?attemptId=${attemptId}`, { replace: true });
    try {
      const token = localStorage.getItem('token');
      await loadAttemptDetails(attemptId, token!);
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch attempt');
    } finally {
      setIsLoadingAttempt(false);
    }
  };

  const loadAttemptDetails = async (attemptId: string, token: string) => {
    // Fetch attempt details
    const attemptResponse = await fetch(`/api/attempts?quizId=${quizId}&isCompleted=true`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const attempts = await attemptResponse.json();
    const attempt = attempts.find((a: any) => a.id === attemptId);

    if (!attempt) {
      throw new Error('Attempt not found');
    }

    // Fetch quiz details
    const quizResponse = await fetch(`/api/quizzes/${quizId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!quizResponse.ok) {
      throw new Error('Failed to load quiz details');
    }

    const quiz = await quizResponse.json();

    // Fetch questions
    const questionsResponse = await fetch(`/api/quizzes/${quizId}/questions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!questionsResponse.ok) {
      throw new Error('Failed to load questions');
    }

    const questions = await questionsResponse.json();

    // Fetch answers for this attempt
    const answersResponse = await fetch(`/api/answers?attemptId=${attemptId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!answersResponse.ok) {
      throw new Error('Failed to load answers');
    }

    const answers = await answersResponse.json();
    const answersMap = new Map(answers.map((a: any) => [a.questionId, a]));

    // Combine questions with answers
    const questionsWithAnswers: QuestionReview[] = questions.map((q: any) => {
      const answer = answersMap.get(q.id);
      const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
      
      return {
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: options,
        correctAnswer: q.correctAnswer,
        userAnswer: answer?.answer || 'Not answered',
        isCorrect: answer?.isCorrect || false,
        points: q.points,
        pointsEarned: answer?.pointsEarned || 0
      };
    });

    const percentage = attempt.totalPoints > 0 
      ? (attempt.score / attempt.totalPoints) * 100 
      : 0;

    const timeLimitMinutes: number | null = quiz.timeLimit ?? null;
    const timeUtilizationPercent =
      timeLimitMinutes && timeLimitMinutes > 0
        ? Math.round((attempt.timeTaken / (timeLimitMinutes * 60)) * 100)
        : null;

    setReviewData({
      quizId: quiz.id,
      quizTitle: quiz.title,
      attemptId: attempt.id,
      score: attempt.score,
      totalPoints: attempt.totalPoints,
      percentage: Math.round(percentage),
      submittedAt: attempt.submittedAt,
      timeTaken: attempt.timeTaken,
      timeUtilizationPercent,
      questions: questionsWithAnswers
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading quiz review...</p>
        </div>
      </div>
    );
  }

  if (error || !reviewData) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center p-6">
          <div className="text-red-500 mb-4">⚠️ Error Loading Review</div>
          <p className="text-muted-foreground mb-4">{error || 'Quiz review not found'}</p>
          <Button onClick={() => navigate('/student/quizzes')}>Back to Quizzes</Button>
        </div>
      </div>
    );
  }

  const currentAttemptInfo = allAttempts.find(a => a.id === reviewData.attemptId);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/student/quizzes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Quizzes
        </Button>
      </div>

      {/* Attempt History Switcher */}
      {allAttempts.length > 1 && (
        <div className="mb-6 p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <span>Quiz Attempt History</span>
                <Badge variant="outline" className="text-xs font-normal">
                  {allAttempts.length} Total Attempts
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click any attempt to inspect its full answers, score breakdown, and questions.
              </p>
            </div>
            {currentAttemptInfo && (
              <div className="text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/40 shrink-0">
                Viewing: <span className="font-semibold text-foreground">Attempt #{currentAttemptInfo.attemptNumber}</span> ({currentAttemptInfo.percentage}%)
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {allAttempts.map((att) => {
              const isSelected = att.id === reviewData.attemptId;
              return (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => handleSelectAttempt(att.id)}
                  disabled={isLoadingAttempt}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/40'
                      : 'bg-muted/30 hover:bg-muted/70 text-muted-foreground hover:text-foreground border-border/50'
                  }`}
                >
                  <span className="font-semibold">Attempt #{att.attemptNumber}</span>
                  <span className={`font-mono px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    isSelected
                      ? 'bg-black/20 text-white'
                      : att.percentage >= 80 ? 'bg-emerald-500/10 text-emerald-400' : att.percentage >= 60 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {att.score}/{att.totalPoints} ({att.percentage}%)
                  </span>
                  {att.isBest && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Best
                    </span>
                  )}
                  {att.isLatest && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Latest
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xl sm:text-2xl font-bold">Review: {reviewData.quizTitle}</span>
                {currentAttemptInfo && (
                  <Badge variant="outline" className="font-mono text-xs">
                    Attempt #{currentAttemptInfo.attemptNumber}
                  </Badge>
                )}
                {currentAttemptInfo?.isLatest && (
                  <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">
                    Latest Attempt
                  </Badge>
                )}
                {currentAttemptInfo?.isBest && (
                  <Badge variant="default" className="text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    Best Score
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-2xl sm:text-3xl font-bold font-mono">
                {reviewData.score} / {reviewData.totalPoints}
              </div>
              <Badge 
                variant={reviewData.percentage >= 80 ? 'default' : reviewData.percentage >= 60 ? 'secondary' : 'destructive'}
                className="mt-1 text-sm px-2.5 py-0.5"
              >
                {reviewData.percentage}%
              </Badge>
            </div>
          </CardTitle>
          <div className="mt-3 text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
            <span>Submitted: {new Date(reviewData.submittedAt).toLocaleString()}</span>
            <span>•</span>
            <span>Time Taken: {Math.round(reviewData.timeTaken / 60)} minutes</span>
            {reviewData.timeUtilizationPercent !== null && (
              <>
                <span>•</span>
                <span>Time Utilization: {reviewData.timeUtilizationPercent}%</span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {reviewData.questions.map((q, index) => (
            <div key={q.id} className="mb-6 pb-6 border-b last:border-b-0">
              <div className="flex items-start justify-between mb-4 gap-2">
                <h3 className="text-lg font-semibold flex items-center">
                  <HelpCircle className="mr-2 h-5 w-5 text-muted-foreground shrink-0" />
                  <span>Question {index + 1}: {q.questionText}</span>
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant={votedImpQuestions.has(q.id) ? "default" : "outline"}
                    className={`h-7 text-xs flex items-center gap-1.5 transition-all ${
                      votedImpQuestions.has(q.id)
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                        : 'border-white/10 text-slate-400 hover:text-amber-300 hover:border-amber-500/30'
                    }`}
                    onClick={() => handleToggleImp(q.id)}
                  >
                    <Star className={`h-3.5 w-3.5 ${votedImpQuestions.has(q.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
                    {votedImpQuestions.has(q.id) ? 'Marked IMP ⭐' : 'Mark as IMP'}
                    {impCounts[q.id] !== undefined ? ` (${impCounts[q.id]})` : ''}
                  </Button>
                  <Badge variant={q.isCorrect ? 'default' : 'destructive'}>
                    {q.pointsEarned} / {q.points} pts
                  </Badge>
                </div>
              </div>

              {/* Display options for multiple-choice and true-false */}
              {(q.questionType === 'multiple-choice' || q.questionType === 'true-false') && q.options && (
                <div className="space-y-2">
                  {q.options.map((option, i) => {
                    const isCorrect = option === q.correctAnswer;
                    const isUserChoice = option === q.userAnswer;
                    
                    return (
                      <Alert 
                        key={i} 
                        variant={isUserChoice && isCorrect ? 'default' : isUserChoice && !isCorrect ? 'destructive' : 'secondary'}
                        className={!isUserChoice && isCorrect ? 'border-green-500' : ''}
                      >
                        <div className="flex items-center">
                          {isUserChoice && isCorrect && <Check className="h-4 w-4 mr-2 text-green-600" />}
                          {isUserChoice && !isCorrect && <X className="h-4 w-4 mr-2 text-red-600" />}
                          {!isUserChoice && isCorrect && <Check className="h-4 w-4 mr-2 text-green-500" />}
                          <AlertDescription className={isUserChoice ? 'font-medium' : ''}>
                            {option}
                            {isUserChoice && <span className="ml-2 text-xs">(Your answer)</span>}
                            {!isUserChoice && isCorrect && <span className="ml-2 text-xs text-green-600">(Correct answer)</span>}
                          </AlertDescription>
                        </div>
                      </Alert>
                    );
                  })}
                </div>
              )}

              {/* Display short answer */}
              {q.questionType === 'short-answer' && (
                <div className="space-y-3">
                  <Alert variant={q.isCorrect ? 'default' : 'destructive'}>
                    <AlertDescription>
                      <div className="font-medium mb-2">Your Answer:</div>
                      <div>{q.userAnswer || 'Not answered'}</div>
                    </AlertDescription>
                  </Alert>
                  {!q.isCorrect && (
                    <Alert variant="secondary" className="border-green-500">
                      <AlertDescription>
                        <div className="font-medium mb-2 text-green-600">Correct Answer:</div>
                        <div>{q.correctAnswer}</div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {!q.isCorrect && (
                <div className="mt-3 text-sm text-muted-foreground">
                  <strong>Points Earned:</strong> {q.pointsEarned} / {q.points}
                </div>
              )}
            </div>
          ))}
          
          <div className="flex justify-between items-center mt-6 pt-6 border-t">
            <div>
              <div className="text-sm text-muted-foreground">Total Score</div>
              <div className="text-2xl font-bold">
                {reviewData.score} / {reviewData.totalPoints} ({reviewData.percentage}%)
              </div>
            </div>
            <Link to="/student/quizzes">
              <Button>Back to Quizzes</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizReview;