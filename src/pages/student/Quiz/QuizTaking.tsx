import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  timeLimit: number | null;
  totalPoints: number;
  startTime: string | null;
  endTime: string | null;
  status: string;
}

interface Question {
  id: string;
  quizId: string;
  questionText: string;
  questionType: 'multiple-choice' | 'true-false' | 'short-answer';
  points: number;
  orderIndex: number;
  options: string[] | null;
  correctAnswer: string;
}

const QuizTaking = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuizClosed, setIsQuizClosed] = useState(false);
  
  const hasLoadedRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load quiz and questions
  useEffect(() => {
    if (quizId && hasLoadedRef.current !== quizId) {
      hasLoadedRef.current = quizId;
      loadQuizData();
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [quizId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0 && !isSubmitting) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [timeLeft, isSubmitting]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft === 0 && questions.length > 0 && attemptId && !isSubmitting) {
      handleSubmitQuiz();
    }
  }, [timeLeft, questions.length, attemptId, isSubmitting]);

  const loadQuizData = async () => {
    if (!quizId || !user) {
      setError('Missing quiz ID or user information');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Step 1: Load quiz details
      const quizResponse = await fetch(`/api/quizzes/${quizId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!quizResponse.ok) {
        const errorData = await quizResponse.json().catch(() => ({ message: 'Failed to load quiz' }));
        throw new Error(errorData.message || `Failed to load quiz (${quizResponse.status})`);
      }

      const quizData: Quiz = await quizResponse.json();
      console.log('[QuizTaking] Quiz loaded:', quizData);

      // Step 2: Verify quiz is accessible
      const now = new Date();
      
      // Check if quiz has started
      if (quizData.startTime) {
        const startTime = new Date(quizData.startTime);
        if (now < startTime) {
          throw new Error(`Quiz hasn't started yet. It will begin at ${startTime.toLocaleString()}`);
        }
      }

      // Check if quiz has ended (show warning but allow viewing for review)
      let isClosed = false;
      if (quizData.endTime) {
        const endTime = new Date(quizData.endTime);
        if (now > endTime) {
          isClosed = true;
          // Don't throw error, just set a flag - we'll show a warning in the UI
        }
      }

      // Only block if quiz is not published or not active/upcoming
      if (quizData.status === 'Draft') {
        throw new Error('This quiz is not available yet.');
      }

      // Check if quiz has ended
      if (quizData.endTime) {
        const endTime = new Date(quizData.endTime);
        if (now > endTime) {
          setIsQuizClosed(true);
          toast.warning('This quiz has ended. You can still view it but cannot submit new answers.');
        }
      }

      setQuiz(quizData);

      // Step 3: Load questions
      const questionsResponse = await fetch(`/api/quizzes/${quizId}/questions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!questionsResponse.ok) {
        const errorData = await questionsResponse.json().catch(() => ({ message: 'Failed to load questions' }));
        console.error('[QuizTaking] Questions loading error:', errorData);
        throw new Error(errorData.message || `Failed to load questions (${questionsResponse.status})`);
      }

      const questionsData: Question[] = await questionsResponse.json();
      console.log('[QuizTaking] Questions loaded:', questionsData.length);
      console.log('[QuizTaking] First question sample:', questionsData[0]);

      if (questionsData.length === 0) {
        throw new Error('This quiz has no questions yet. Please contact your teacher.');
      }

      // Validate question data structure
      const invalidQuestions = questionsData.filter(q => !q.id || !q.questionText);
      if (invalidQuestions.length > 0) {
        console.error('[QuizTaking] Invalid questions found:', invalidQuestions);
        throw new Error('Some questions have invalid data. Please contact your teacher.');
      }

      setQuestions(questionsData);

      // Step 4: Start quiz attempt
      const attemptResponse = await fetch('/api/attempts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quizId })
      });

      if (!attemptResponse.ok) {
        const errorData = await attemptResponse.json().catch(() => ({ message: 'Failed to start attempt' }));
        console.error('[QuizTaking] Attempt creation failed:', errorData);
        
        // Provide more specific error messages for attempt creation
        if (errorData.message.includes('not published')) {
          throw new Error('This quiz is not published yet. Please contact your teacher.');
        } else if (errorData.message.includes('not enrolled')) {
          throw new Error('You are not enrolled in the class for this quiz. Please contact your teacher.');
        } else if (errorData.message.includes('not started')) {
          throw new Error(errorData.message); // Use the specific timing message
        } else if (errorData.message.includes('active attempt')) {
          throw new Error('You already have an active attempt for this quiz. Please check your previous attempts.');
        }
        
        throw new Error(errorData.message || 'Failed to start quiz attempt');
      }

      const attemptData = await attemptResponse.json();
      console.log('[QuizTaking] Attempt started:', attemptData.id);
      setAttemptId(attemptData.id);

      // Step 5: Set timer
      if (quizData.timeLimit) {
        setTimeLeft(quizData.timeLimit * 60); // Convert minutes to seconds
      } else {
        setTimeLeft(0); // No time limit
      }

    } catch (err: any) {
      console.error('[QuizTaking] Error loading quiz:', err);
      
      // Provide more specific error messages based on the error
      let userMessage = err.message || 'Failed to load quiz';
      
      if (err.message.includes('403')) {
        userMessage = 'You don\'t have permission to access this quiz. Please check if you\'re enrolled in the correct class.';
      } else if (err.message.includes('404')) {
        userMessage = 'Quiz not found. It may have been deleted or you don\'t have access.';
      } else if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
        userMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err.message.includes('questions')) {
        userMessage = 'Error loading quiz questions. Please contact your teacher or try again later.';
      }
      
      setError(userMessage);
      toast.error(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitQuiz = useCallback(async () => {
    if (!attemptId || questions.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    // Check for unanswered questions
    const unansweredQuestions = questions.filter(q => !answers[q.id] || answers[q.id].trim() === '');
    
    if (unansweredQuestions.length > 0) {
      const confirmSubmit = window.confirm(
        `You have ${unansweredQuestions.length} unanswered question(s). Are you sure you want to submit?`
      );
      if (!confirmSubmit) {
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      
      // Format answers for submission
      const formattedAnswers = questions.map(q => ({
        questionId: q.id,
        answer: answers[q.id] || ''
      }));

      toast.loading('Submitting quiz...', { id: 'submit-quiz' });

      const response = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answers: formattedAnswers })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to submit quiz' }));
        console.error('[QuizTaking] Submission error response:', errorData);
        throw new Error(errorData.message || 'Failed to submit quiz');
      }

      const result = await response.json();
      const scorePercentage = result.totalPossiblePoints > 0 
        ? Math.round((result.score / result.totalPossiblePoints) * 100)
        : 0;
      
      toast.success(`Quiz submitted! Score: ${scorePercentage}%`, { id: 'submit-quiz' });
      
      // Navigate to review page
      setTimeout(() => {
        navigate(`/student/quiz/${quizId}/review?attemptId=${attemptId}`);
      }, 1500);

    } catch (err: any) {
      console.error('[QuizTaking] Error submitting quiz:', err);
      console.error('[QuizTaking] Attempt ID:', attemptId);
      console.error('[QuizTaking] Formatted answers:', formattedAnswers);
      toast.error(err.message || 'Failed to submit quiz', { id: 'submit-quiz' });
      setIsSubmitting(false);
      
      // Show detailed error in development
      if (process.env.NODE_ENV === 'development') {
        alert(`Submission Error: ${err.message}\nAttempt ID: ${attemptId}\nCheck console for details.`);
      }
    }
  }, [attemptId, questions, answers, quizId, navigate, isSubmitting]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Quiz</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => navigate('/student/quizzes')} variant="outline">
                  Back to Quizzes
                </Button>
                <Button onClick={loadQuizData}>
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">No quiz data available.</p>
          <Button onClick={() => navigate('/student/quizzes')} className="mt-4">
            Back to Quizzes
          </Button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).filter(key => answers[key] && answers[key].trim() !== '').length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <div className="container mx-auto p-4 pb-20">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-background border-b pb-4 mb-6 shadow-sm">
        {isQuizClosed && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This quiz has ended. You can review the questions but cannot submit new answers.
            </AlertDescription>
          </Alert>
        )}
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">{quiz.title}</CardTitle>
                {quiz.description && (
                  <p className="text-sm text-muted-foreground">{quiz.description}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {answeredCount} of {questions.length} answered
                </div>
                {timeLeft > 0 && (
                  <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
                    <Clock className="h-4 w-4" />
                    <span className="font-semibold">{formatTime(timeLeft)}</span>
                  </div>
                )}
              </div>
            </div>
            <Progress value={progress} className="mt-3" />
          </CardHeader>
        </Card>
      </div>

      {/* Questions - Google Forms Style */}
      <div className="max-w-3xl mx-auto space-y-6">
        {questions.map((question, index) => (
          <Card key={question.id} className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Question Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Question {index + 1}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {question.points} {question.points === 1 ? 'point' : 'points'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {question.questionType.replace('-', ' ')}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold">{question.questionText}</h3>
                  </div>
                </div>

                {/* Multiple Choice */}
                {question.questionType === 'multiple-choice' && question.options && (
                  <RadioGroup
                    value={answers[question.id] || ''}
                    onValueChange={(value) => handleAnswerSelect(question.id, value)}
                  >
                    <div className="space-y-2">
                      {question.options.map((option: string, optIndex: number) => (
                        <div
                          key={optIndex}
                          className={`flex items-center space-x-3 p-3 border rounded-lg transition-all cursor-pointer ${
                            answers[question.id] === option
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50 hover:border-primary/50'
                          }`}
                          onClick={() => handleAnswerSelect(question.id, option)}
                        >
                          <RadioGroupItem value={option} id={`q${index}-opt${optIndex}`} />
                          <Label
                            htmlFor={`q${index}-opt${optIndex}`}
                            className="flex-1 cursor-pointer text-base"
                          >
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                )}

                {/* True/False */}
                {question.questionType === 'true-false' && (
                  <RadioGroup
                    value={answers[question.id] || ''}
                    onValueChange={(value) => handleAnswerSelect(question.id, value)}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        className={`flex items-center space-x-3 p-4 border-2 rounded-lg transition-all cursor-pointer ${
                          answers[question.id] === 'True'
                            ? 'border-primary bg-primary/10'
                            : 'hover:bg-muted/50 hover:border-primary/50'
                        }`}
                        onClick={() => handleAnswerSelect(question.id, 'True')}
                      >
                        <RadioGroupItem value="True" id={`q${index}-true`} />
                        <Label htmlFor={`q${index}-true`} className="flex-1 cursor-pointer text-base font-medium">
                          True
                        </Label>
                      </div>
                      <div
                        className={`flex items-center space-x-3 p-4 border-2 rounded-lg transition-all cursor-pointer ${
                          answers[question.id] === 'False'
                            ? 'border-primary bg-primary/10'
                            : 'hover:bg-muted/50 hover:border-primary/50'
                        }`}
                        onClick={() => handleAnswerSelect(question.id, 'False')}
                      >
                        <RadioGroupItem value="False" id={`q${index}-false`} />
                        <Label htmlFor={`q${index}-false`} className="flex-1 cursor-pointer text-base font-medium">
                          False
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                )}

                {/* Short Answer */}
                {question.questionType === 'short-answer' && (
                  <div className="space-y-2">
                    <Textarea
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerSelect(question.id, e.target.value)}
                      placeholder="Type your answer here..."
                      className="min-h-[120px] text-base"
                    />
                    {answers[question.id] && (
                      <p className="text-xs text-muted-foreground">
                        {answers[question.id].length} character{answers[question.id].length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Submit Button - Fixed at Bottom */}
        <div className="sticky bottom-0 bg-background border-t pt-4 pb-4 mt-8 shadow-lg">
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  {questions.length - answeredCount > 0 ? (
                    <span className="text-orange-600 font-medium">
                      {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} unanswered
                    </span>
                  ) : (
                    <span className="text-green-600 font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      All questions answered
                    </span>
                  )}
                </div>
                <Button
                  onClick={handleSubmitQuiz}
                  size="lg"
                  disabled={isSubmitting || isQuizClosed}
                  className="bg-green-600 hover:bg-green-700 text-lg px-8"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : isQuizClosed ? (
                    'Quiz Closed'
                  ) : (
                    'Submit Quiz'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuizTaking;
