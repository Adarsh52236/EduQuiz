import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Quiz, QuizQuestion } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Clock } from 'lucide-react';

export function StudentTakeQuiz() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !quizId) return;
    loadQuiz();
  }, [user, quizId]);

  const loadQuiz = async () => {
    if (!quizId) return;
    try {
      const quizResponse = await fetch(`/api/quizzes/${quizId}`);
      const quizData = await quizResponse.json();
      if (!quizResponse.ok) {
        throw new Error(quizData.message || 'Quiz not found');
      }
      setQuiz(quizData);
      if (quizData.timeLimit) {
        setTimeLeft(quizData.timeLimit * 60);
      }

      const questionsResponse = await fetch(`/api/quizzes/${quizId}/questions`);
      const questionData = await questionsResponse.json();
      if (!questionsResponse.ok) {
        throw new Error(questionData.message || 'Failed to load questions');
      }
      setQuestions(questionData);

    } catch (error: any) {
      console.error('Error loading quiz:', error);
      toast.error(error.message || 'Failed to load quiz');
      navigate('/student/quizzes');
    } finally {
      setIsLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitQuiz = async () => {
    if (!user || !quiz || questions.length === 0) return;

    let score = 0;
    const now = new Date().toISOString();
    const attemptId = `qatt_${Date.now()}`;

    try {
      // Grade the quiz
      questions.forEach(q => {
        if (answers[q.id] && answers[q.id] === q.correctAnswer) {
          score += q.points;
        }
      });

      // Create quiz attempt
      const attemptResponse = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: attemptId,
          quizId: quiz.id,
          studentId: user.id,
          startedAt: now, // This should be set on start
          submittedAt: now,
          score,
          totalPoints: quiz.totalPoints,
          timeTaken: quiz.timeLimit ? (quiz.timeLimit * 60) - (timeLeft || 0) : null,
          isCompleted: '1'
        }),
      });
      const attemptData = await attemptResponse.json();
      if (!attemptResponse.ok) {
        throw new Error(attemptData.message || 'Failed to submit quiz attempt');
      }

      // Save individual answers
      for (const q of questions) {
        const answerResponse = await fetch('/api/answers', { // Assuming an /api/answers endpoint
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `qans_${Date.now()}`,
            attemptId,
            questionId: q.id,
            answer: answers[q.id] || '',
            isCorrect: (answers[q.id] === q.correctAnswer).toString(),
            pointsEarned: answers[q.id] === q.correctAnswer ? q.points : 0
          }),
        });
        if (!answerResponse.ok) {
          const errorData = await answerResponse.json();
          throw new Error(errorData.message || 'Failed to save answer');
        }
      }

      toast.success('Quiz submitted successfully!');
      navigate('/student/quizzes');

    } catch (error: any) {
      console.error('Error submitting quiz:', error);
      toast.error(error.message || 'Failed to submit quiz');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading quiz...</div>;
  }

  if (!quiz) {
    return <div className="flex items-center justify-center h-full">Quiz not found.</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{quiz.title}</CardTitle>
            <p className="text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p>
          </div>
          {timeLeft !== null && (
            <div className="flex items-center gap-2 font-medium text-lg">
              <Clock className="h-5 w-5" />
              {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {currentQuestion ? (
            <div>
              <p className="font-semibold text-lg mb-4">{currentQuestion.questionText}</p>
              <div className="mt-4 space-y-4">
                {currentQuestion.questionType === 'multiple-choice' && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  >
                    {JSON.parse(currentQuestion.options || '[]').map((option: string, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`option-${index}`} />
                        <Label htmlFor={`option-${index}`}>{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {currentQuestion.questionType === 'true-false' && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="True" id="true" />
                      <Label htmlFor="true">True</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="False" id="false" />
                      <Label htmlFor="false">False</Label>
                    </div>
                  </RadioGroup>
                )}

                {currentQuestion.questionType === 'short-answer' && (
                  <Input
                    placeholder="Your answer..."
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  />
                )}
              </div>
            </div>
          ) : (
            <p>No questions in this quiz.</p>
          )}

          <div className="mt-6 flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => setCurrentQuestionIndex(p => p - 1)} 
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>
            {currentQuestionIndex < questions.length - 1 ? (
              <Button onClick={() => setCurrentQuestionIndex(p => p + 1)}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmitQuiz}>Submit Quiz</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
