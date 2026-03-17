import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Check, X, HelpCircle, Loader2, ArrowLeft } from 'lucide-react';
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
  questions: QuestionReview[];
}

const QuizReview = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviewData, setReviewData] = useState<QuizReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId || !user) return;
    loadReviewData();
  }, [quizId, user]);

  const loadReviewData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const attemptId = searchParams.get('attemptId');

      if (!attemptId) {
        // If no attemptId, get the most recent attempt for this quiz
        const attemptsResponse = await fetch(`/api/attempts?quizId=${quizId}&isCompleted=true`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!attemptsResponse.ok) {
          throw new Error('Failed to load quiz attempts');
        }

        const attempts = await attemptsResponse.json();
        if (attempts.length === 0) {
          setError('No completed attempts found for this quiz');
          setIsLoading(false);
          return;
        }

        // Use the most recent attempt
        const latestAttempt = attempts.sort((a: any, b: any) => 
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        )[0];
        
        await loadAttemptDetails(latestAttempt.id, token!);
      } else {
        await loadAttemptDetails(attemptId, token!);
      }
    } catch (error: any) {
      console.error('Error loading review data:', error);
      setError(error.message || 'Failed to load quiz review');
      toast.error(error.message || 'Failed to load quiz review');
    } finally {
      setIsLoading(false);
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

    setReviewData({
      quizId: quiz.id,
      quizTitle: quiz.title,
      attemptId: attempt.id,
      score: attempt.score,
      totalPoints: attempt.totalPoints,
      percentage: Math.round(percentage),
      submittedAt: attempt.submittedAt,
      timeTaken: attempt.timeTaken,
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

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/student/quizzes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Quizzes
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Review: {reviewData.quizTitle}</span>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {reviewData.score} / {reviewData.totalPoints}
              </div>
              <Badge 
                variant={reviewData.percentage >= 80 ? 'default' : reviewData.percentage >= 60 ? 'secondary' : 'destructive'}
                className="mt-1"
              >
                {reviewData.percentage}%
              </Badge>
            </div>
          </CardTitle>
          <div className="mt-4 text-sm text-muted-foreground">
            Submitted: {new Date(reviewData.submittedAt).toLocaleString()} • 
            Time Taken: {Math.round(reviewData.timeTaken / 60)} minutes
          </div>
        </CardHeader>
        <CardContent>
          {reviewData.questions.map((q, index) => (
            <div key={q.id} className="mb-6 pb-6 border-b last:border-b-0">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <HelpCircle className="mr-2" />
                  Question {index + 1}: {q.questionText}
                </h3>
                <Badge variant={q.isCorrect ? 'default' : 'destructive'}>
                  {q.pointsEarned} / {q.points} pts
                </Badge>
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