import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, GripVertical, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QuizQuestion {
  id: string;
  questionText: string;
  questionType: 'multiple-choice' | 'true-false' | 'short-answer';
  points: number;
  options: string[];
  correctAnswer: string;
}

interface Class {
  id: string;
  name: string;
  classCode: string;
}

export default function CreateQuiz() {
  console.log('CreateQuiz component rendering...');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showClassDialog, setShowClassDialog] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  console.log('CreateQuiz state:', { user: user?.displayName, isLoading, classes: classes.length, questions: questions.length });

  useEffect(() => {
    console.log('CreateQuiz useEffect running...');
    const initialize = async () => {
      try {
        console.log('Loading classes...');
        await loadClasses();
        console.log('Classes loaded successfully');
        
        // Add initial question
        const initialQuestion: QuizQuestion = {
          id: `q-${Date.now()}-${Math.random()}`,
          questionText: '',
          questionType: 'multiple-choice',
          points: 1,
          options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
          correctAnswer: ''
        };
        setQuestions([initialQuestion]);
        console.log('Initial question added');
      } catch (error: any) {
        console.error('Error initializing CreateQuiz:', error);
        setError(error.message || 'Failed to initialize');
        toast.error('Failed to load data: ' + (error.message || 'Unknown error'));
      } finally {
        console.log('Setting isLoading to false');
        setIsLoading(false);
      }
    };
    
    initialize();
  }, []);

  const loadClasses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/classes', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (response.ok) {
        setClasses(data);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: `q-${Date.now()}-${Math.random()}`,
      questionText: '',
      questionType: 'multiple-choice',
      points: 1,
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      correctAnswer: ''
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, field: keyof QuizQuestion, value: any) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return { ...q, options: [...q.options, `Option ${q.options.length + 1}`] };
      }
      return q;
    }));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options.length > 2) {
        const newOptions = q.options.filter((_, i) => i !== optionIndex);
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const handleQuestionTypeChange = (questionId: string, type: 'multiple-choice' | 'true-false' | 'short-answer') => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        let options = q.options;
        let correctAnswer = '';
        
        if (type === 'true-false') {
          options = ['True', 'False'];
        } else if (type === 'short-answer') {
          options = [];
        } else if (type === 'multiple-choice' && q.questionType !== 'multiple-choice') {
          options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
        }
        
        return { ...q, questionType: type, options, correctAnswer };
      }
      return q;
    }));
  };

  const validateQuiz = (): boolean => {
    if (!quizTitle.trim()) {
      toast.error('Please enter a quiz title');
      return false;
    }

    if (questions.length === 0) {
      toast.error('Please add at least one question');
      return false;
    }

    for (const q of questions) {
      if (!q.questionText.trim()) {
        toast.error('All questions must have text');
        return false;
      }
      if (!q.correctAnswer.trim()) {
        toast.error('All questions must have a correct answer');
        return false;
      }
      if (q.questionType === 'multiple-choice' && q.options.length < 2) {
        toast.error('Multiple choice questions must have at least 2 options');
        return false;
      }
    }

    return true;
  };

  const handleCreateQuiz = async () => {
    if (!validateQuiz()) return;
    
    if (classes.length === 0) {
      toast.error('You need to create a class first');
      return;
    }

    setShowClassDialog(true);
  };

  const handleSaveAndPublish = async () => {
    if (!selectedClassId) {
      toast.error('Please select a class');
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Calculate total points
      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
      
      // Determine the quiz type based on questions (use the first question's type or 'multiple-choice' as default)
      const quizType = questions.length > 0 ? questions[0].questionType : 'multiple-choice';

      // Create quiz
      const quizResponse = await fetch('/api/quizzes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: quizTitle,
          description: quizDescription,
          type: quizType, // Use first question's type (backend only accepts: 'multiple-choice', 'true-false', 'short-answer')
          classId: selectedClassId,
          timeLimit: timeLimit,
          totalPoints: totalPoints,
          startTime: startTime || new Date().toISOString(),
          endTime: endTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          isPublished: true
        })
      });

      const quizData = await quizResponse.json();
      if (!quizResponse.ok) throw new Error(quizData.message || 'Failed to create quiz');

      // Create questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await fetch('/api/questions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            quizId: quizData.id,
            questionText: q.questionText,
            questionType: q.questionType,
            points: q.points,
            orderIndex: i,
            options: q.questionType === 'short-answer' ? null : JSON.stringify(q.options),
            correctAnswer: q.correctAnswer
          })
        });
      }

      toast.success('Quiz created and published successfully!');
      setShowClassDialog(false);
      navigate('/teacher/quizzes');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create quiz');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  console.log('Render check - isLoading:', isLoading, 'user:', user, 'error:', error);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center p-6">
          <div className="text-red-500 mb-4">⚠️ Error Loading Quiz Editor</div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => {
            setError(null);
            setIsLoading(true);
            window.location.reload();
          }}>Reload Page</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    console.log('Rendering loading state');
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading quiz editor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('No user found, redirecting to login');
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to create quizzes</p>
          <Button onClick={() => navigate('/auth/teacher/sign-in')}>Go to Login</Button>
        </div>
      </div>
    );
  }

  console.log('Rendering main form with', questions.length, 'questions');

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Quiz Header */}
      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <Input
            placeholder="Untitled Quiz"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            className="text-3xl font-bold border-none shadow-none p-0 h-auto focus-visible:ring-0"
          />
          <Textarea
            placeholder="Quiz description (optional)"
            value={quizDescription}
            onChange={(e) => setQuizDescription(e.target.value)}
            className="border-none shadow-none p-0 resize-none focus-visible:ring-0 text-muted-foreground"
            rows={2}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Time Limit (minutes)</Label>
              <Input
                type="number"
                min="1"
                value={timeLimit}
                onChange={(e) => setTimeLimit(parseInt(e.target.value) || 30)}
              />
            </div>
            <div>
              <Label>Start Time</Label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label>End Time</Label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Total Points: <span className="font-semibold">{totalPoints}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      {questions.map((question, qIndex) => (
        <Card key={question.id} className="relative">
          <CardHeader className="pb-4">
            <div className="flex items-start gap-2">
              <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-move" />
              <div className="flex-1 space-y-4">
                <Input
                  placeholder={`Question ${qIndex + 1}`}
                  value={question.questionText}
                  onChange={(e) => updateQuestion(question.id, 'questionText', e.target.value)}
                  className="text-lg font-medium"
                />
                
                <div className="flex items-center gap-4">
                  <Select
                    value={question.questionType}
                    onValueChange={(value: any) => handleQuestionTypeChange(question.id, value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                      <SelectItem value="true-false">True/False</SelectItem>
                      <SelectItem value="short-answer">Short Answer</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <Label>Points:</Label>
                    <Input
                      type="number"
                      min="1"
                      value={question.points}
                      onChange={(e) => updateQuestion(question.id, 'points', parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                  </div>
                </div>
              </div>
              
              {questions.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQuestion(question.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Multiple Choice Options */}
            {question.questionType === 'multiple-choice' && (
              <div className="space-y-2">
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      checked={question.correctAnswer === option}
                      onChange={() => updateQuestion(question.id, 'correctAnswer', option)}
                      className="h-4 w-4 text-primary"
                    />
                    <Input
                      value={option}
                      onChange={(e) => updateOption(question.id, oIndex, e.target.value)}
                      placeholder={`Option ${oIndex + 1}`}
                      className="flex-1"
                    />
                    {question.options.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(question.id, oIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addOption(question.id)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              </div>
            )}

            {/* True/False Options */}
            {question.questionType === 'true-false' && (
              <div className="space-y-2">
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      checked={question.correctAnswer === option}
                      onChange={() => updateQuestion(question.id, 'correctAnswer', option)}
                      className="h-4 w-4 text-primary"
                    />
                    <Label className="flex-1">{option}</Label>
                  </div>
                ))}
              </div>
            )}

            {/* Short Answer */}
            {question.questionType === 'short-answer' && (
              <div className="space-y-2">
                <Label>Correct Answer (for grading reference)</Label>
                <Input
                  value={question.correctAnswer}
                  onChange={(e) => updateQuestion(question.id, 'correctAnswer', e.target.value)}
                  placeholder="Enter the correct answer"
                />
                <p className="text-xs text-muted-foreground">
                  Short answer questions need to be graded manually
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add Question Button */}
      <Button
        variant="outline"
        onClick={addQuestion}
        className="w-full h-12 border-dashed"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Question
      </Button>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {questions.length} question{questions.length !== 1 ? 's' : ''} • {totalPoints} point{totalPoints !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/teacher/quizzes')}>
              Cancel
            </Button>
            <Button onClick={handleCreateQuiz} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              Create Quiz
            </Button>
          </div>
        </div>
      </div>

      {/* Class Selection Dialog */}
      <Dialog open={showClassDialog} onOpenChange={setShowClassDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Class</DialogTitle>
            <DialogDescription>
              Choose which class this quiz should be assigned to
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {classes.map((cls) => (
                <Card
                  key={cls.id}
                  className={`cursor-pointer transition-colors ${
                    selectedClassId === cls.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedClassId(cls.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{cls.name}</p>
                        <p className="text-sm text-muted-foreground">Code: {cls.classCode}</p>
                      </div>
                      {selectedClassId === cls.id && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-primary-foreground text-xs">✓</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowClassDialog(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveAndPublish} disabled={!selectedClassId || isSaving} className="flex-1">
              {isSaving ? 'Publishing...' : 'Publish Quiz'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
