import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Loader2, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Zap, Target } from 'lucide-react';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptStartedAt, setAttemptStartedAt] = useState<string | null>(null);
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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quizId]);

  // Timer countdown
  useEffect(() => {
    if (!attemptStartedAt || !quiz?.timeLimit || quiz.timeLimit <= 0 || isSubmitting) return;

    const computeRemainingSeconds = () => {
      const startedMs = new Date(attemptStartedAt).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
      const totalSeconds = quiz.timeLimit * 60;
      return Math.max(0, totalSeconds - elapsedSeconds);
    };

    setTimeLeft(computeRemainingSeconds());

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(computeRemainingSeconds());
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [attemptStartedAt, quiz?.timeLimit, isSubmitting]);

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
      if (!token) throw new Error('No authentication token found');

      const quizResponse = await fetch(`/api/quizzes/${quizId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!quizResponse.ok) throw new Error('Failed to load quiz');
      const quizData: Quiz = await quizResponse.json();

      const now = new Date();
      if (quizData.startTime && now < new Date(quizData.startTime)) {
        throw new Error(`Quiz hasn't started yet.`);
      }
      if (quizData.endTime && now > new Date(quizData.endTime)) {
        setIsQuizClosed(true);
        toast.warning('This quiz has ended. You can still view it but cannot submit new answers.');
      }
      if (quizData.status === 'Draft') throw new Error('This quiz is not available yet.');

      setQuiz(quizData);

      const questionsResponse = await fetch(`/api/quizzes/${quizId}/questions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!questionsResponse.ok) throw new Error('Failed to load questions');
      const questionsData: Question[] = await questionsResponse.json();
      if (questionsData.length === 0) throw new Error('This quiz has no questions.');
      setQuestions(questionsData);

      const attemptResponse = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId })
      });
      if (!attemptResponse.ok) {
        const errorData = await attemptResponse.json();
        throw new Error(errorData.message || 'Failed to start quiz attempt');
      }
      const attemptData = await attemptResponse.json();
      setAttemptId(attemptData.id);
      setAttemptStartedAt(attemptData.startedAt || null);

      if (quizData.timeLimit) setTimeLeft(quizData.timeLimit * 60);
      else setTimeLeft(0);

    } catch (err: any) {
      setError(err.message || 'Failed to load quiz');
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitQuiz = useCallback(async () => {
    if (!attemptId || questions.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    const unansweredQuestions = questions.filter(q => !answers[q.id] || answers[q.id].trim() === '');
    if (unansweredQuestions.length > 0) {
      const confirmSubmit = window.confirm(`You have ${unansweredQuestions.length} unanswered question(s). Are you sure you want to submit?`);
      if (!confirmSubmit) {
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const formattedAnswers = questions.map(q => ({
        questionId: q.id,
        answer: answers[q.id] || ''
      }));

      toast.loading('Submitting to Arena...', { id: 'submit-quiz' });

      const response = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: formattedAnswers })
      });

      if (!response.ok) throw new Error('Failed to submit quiz');

      const result = await response.json();
      const scorePercentage = result.totalPossiblePoints > 0 ? Math.round((result.score / result.totalPossiblePoints) * 100) : 0;
      
      toast.success(`Mission Accomplished! Score: ${scorePercentage}%`, { id: 'submit-quiz' });
      setTimeout(() => navigate(`/student/quiz/${quizId}/review?attemptId=${attemptId}`), 1500);

    } catch (err: any) {
      toast.error(err.message || 'Failed to submit quiz', { id: 'submit-quiz' });
      setIsSubmitting(false);
    }
  }, [attemptId, questions, answers, quizId, navigate, isSubmitting]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quiz || questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen p-4">
        <Card className="max-w-md w-full border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Arena Error</h3>
            <p className="text-muted-foreground mb-4">{error || "No data available."}</p>
            <Button onClick={() => navigate('/student/dashboard')}>Return to Hub</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).filter(key => answers[key] && answers[key].trim() !== '').length;
  const progress = (answeredCount / questions.length) * 100;
  const currentQuestion = questions[currentIndex];

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col bg-background rounded-xl border border-white/10 relative overflow-hidden">
      {/* Top Bar: Progress and Timer */}
      <div className="flex-shrink-0 h-16 border-b border-white/10 bg-card/30 backdrop-blur-md px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/student/dashboard')} className="text-muted-foreground">
            <ChevronLeft className="h-4 w-4 mr-1" /> Leave
          </Button>
          <div className="h-6 w-px bg-white/10" />
          <h1 className="font-bold text-lg">{quiz.title}</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{answeredCount}/{questions.length} Solved</span>
            <Progress value={progress} className="w-32 h-2" />
          </div>
          {timeLeft > 0 && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-md border ${timeLeft < 300 ? 'border-destructive text-destructive bg-destructive/10 animate-pulse' : 'border-white/10 bg-black/40'}`}>
              <Clock className="h-4 w-4" />
              <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
            </div>
          )}
          <Button onClick={handleSubmitQuiz} disabled={isSubmitting || isQuizClosed} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'SUBMIT'}
          </Button>
        </div>
      </div>

      {isQuizClosed && (
        <Alert className="rounded-none border-x-0 border-t-0 border-b border-destructive bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Mission time expired. You can view the problem set but cannot submit.</AlertDescription>
        </Alert>
      )}

      {/* Split Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANE: Problem Description */}
        <div className="w-1/2 border-r border-white/10 flex flex-col bg-black/20">
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="flex items-center gap-3 mb-6">
              <Badge className="bg-white/10 hover:bg-white/10 text-foreground font-mono text-sm border-0">
                Problem {currentIndex + 1}
              </Badge>
              <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5">
                {currentQuestion.points} XP
              </Badge>
              {answers[currentQuestion.id] && (
                <Badge className="bg-green-500/20 text-green-400 border-0 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Attempted
                </Badge>
              )}
            </div>
            
            <h2 className="text-3xl font-bold mb-8 leading-tight">
              {currentQuestion.questionText}
            </h2>

            {/* AI Hint Section */}
            <div className="mt-12 border border-primary/20 bg-primary/5 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Zap className="h-5 w-5" /> OmniBot Hint
                </div>
                {!showHint[currentQuestion.id] && (
                  <Button size="sm" variant="outline" className="h-8 border-primary/30 text-primary hover:bg-primary/10" onClick={() => setShowHint(prev => ({ ...prev, [currentQuestion.id]: true }))}>
                    Reveal Hint (-10% XP)
                  </Button>
                )}
              </div>
              {showHint[currentQuestion.id] && (
                <div className="p-4 text-sm text-muted-foreground bg-black/40">
                  <p>Consider the core definition of the concepts mentioned. Break down the problem into smaller logical steps. What is the fundamental relationship between the variables?</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Left Pane Footer: Navigation */}
          <div className="h-16 border-t border-white/10 bg-card/30 flex items-center justify-between px-6">
            <Button variant="ghost" disabled={currentIndex === 0} onClick={() => setCurrentIndex(c => c - 1)}>
              <ChevronLeft className="h-4 w-4 mr-2" /> Prev
            </Button>
            <div className="flex gap-1">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-mono transition-all ${
                    currentIndex === idx ? 'bg-primary text-primary-foreground font-bold' :
                    answers[q.id] ? 'bg-white/10 text-white hover:bg-white/20' : 'text-muted-foreground hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <Button variant="ghost" disabled={currentIndex === questions.length - 1} onClick={() => setCurrentIndex(c => c + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* RIGHT PANE: Input / Editor Area */}
        <div className="w-1/2 flex flex-col bg-background">
          <div className="h-12 border-b border-white/5 bg-card/30 flex items-center px-4 gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Solution Workspace</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar flex flex-col justify-center">
            <div className="max-w-xl mx-auto w-full">
              
              {currentQuestion.questionType === 'multiple-choice' && currentQuestion.options && (
                <RadioGroup value={answers[currentQuestion.id] || ''} onValueChange={(val) => handleAnswerSelect(currentQuestion.id, val)} className="space-y-4">
                  {currentQuestion.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`relative flex items-center space-x-3 p-5 rounded-xl border-2 transition-all cursor-pointer overflow-hidden ${
                        answers[currentQuestion.id] === opt
                          ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                          : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/40'
                      }`}
                      onClick={() => handleAnswerSelect(currentQuestion.id, opt)}
                    >
                      <RadioGroupItem value={opt} id={`opt-${i}`} className="mt-0.5" />
                      <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer text-lg leading-relaxed font-medium">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {currentQuestion.questionType === 'true-false' && (
                <RadioGroup value={answers[currentQuestion.id] || ''} onValueChange={(val) => handleAnswerSelect(currentQuestion.id, val)} className="grid grid-cols-2 gap-6">
                  {['True', 'False'].map((opt) => (
                    <div
                      key={opt}
                      className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 transition-all cursor-pointer ${
                        answers[currentQuestion.id] === opt
                          ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                          : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/40'
                      }`}
                      onClick={() => handleAnswerSelect(currentQuestion.id, opt)}
                    >
                      <RadioGroupItem value={opt} id={`tf-${opt}`} className="sr-only" />
                      <span className={`text-2xl font-bold tracking-wider uppercase ${answers[currentQuestion.id] === opt ? 'text-primary' : 'text-muted-foreground'}`}>{opt}</span>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {currentQuestion.questionType === 'short-answer' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Textarea
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                      placeholder="Enter your solution here..."
                      className="min-h-[300px] text-lg p-6 bg-black/40 border-white/10 focus-visible:ring-primary focus-visible:border-primary resize-none font-mono"
                    />
                  </div>
                  <div className="flex justify-end">
                    <span className="text-xs text-muted-foreground font-mono">
                      {answers[currentQuestion.id]?.length || 0} chars
                    </span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default QuizTaking;
