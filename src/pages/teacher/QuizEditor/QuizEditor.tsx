import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Question {
  id?: string;
  questionText: string; // Changed from 'question'
  questionType: 'multiple-choice' | 'true-false' | 'short-answer'; // Added questionType
  options: string[];
  correctAnswer: string; // Changed from number (index) to string (actual answer text)
  points: number;
}

interface Quiz {
  id?: string;
  title: string;
  description: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer'; // Added type
  totalPoints: number; // Changed from 'points' to 'totalPoints'
  timeLimit: number;
  startTime: string; // Added startTime
  endTime: string; // Added endTime
  isPublished: boolean;
  classId?: string;
  questions: Question[];
}

export default function QuizEditor() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz>({
    title: '',
    description: '',
    type: 'multiple-choice', // Default type
    totalPoints: 0,
    timeLimit: 30,
    startTime: '',
    endTime: '',
    isPublished: false,
    questions: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialQuestionIds, setInitialQuestionIds] = useState<Set<string>>(new Set()); // To track questions loaded from backend

  useEffect(() => {
    if (!user) {
      navigate('/login'); // Redirect to login if user is not authenticated
      return;
    }
    if (quizId && quizId !== 'new') {
      loadQuiz();
    } else {
      setLoading(false);
    }
  }, [user, quizId, navigate]);

  const loadQuiz = async () => {
    setLoading(true);
    try {
      // Fetch quiz details
      const quizResponse = await fetch(`/api/quizzes/${quizId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const quizData = await quizResponse.json();
      if (!quizResponse.ok) throw new Error(quizData.message || 'Failed to load quiz details');

      // Fetch quiz questions
      const questionsResponse = await fetch(`/api/quizzes/${quizId}/questions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const questionsData = await questionsResponse.json();
      if (!questionsResponse.ok) throw new Error(questionsData.message || 'Failed to load quiz questions');

      // Map backend question structure to frontend interface
      const formattedQuestions: Question[] = questionsData.map((q: any) => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options, // Already parsed by backend
        correctAnswer: q.correctAnswer,
        points: q.points
      }));

      setQuiz({
        id: quizData.id,
        title: quizData.title,
        description: quizData.description || '',
        type: quizData.type,
        totalPoints: quizData.totalPoints,
        timeLimit: quizData.timeLimit,
        startTime: quizData.startTime ? new Date(quizData.startTime).toISOString().slice(0, 16) : '',
        endTime: quizData.endTime ? new Date(quizData.endTime).toISOString().slice(0, 16) : '',
        isPublished: quizData.isPublished,
        classId: quizData.classId,
        questions: formattedQuestions
      });

      setInitialQuestionIds(new Set(formattedQuestions.map(q => q.id!)));

    } catch (error: any) {
      console.error('Error loading quiz:', error);
      toast.error(error.message || 'Failed to load quiz');
      navigate('/teacher/quizzes'); // Navigate back on error
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!quiz.title.trim()) {
      toast.error('Please enter a quiz title');
      return;
    }

    if (quiz.questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    // Basic validation for questions
    for (const q of quiz.questions) {
      if (!q.questionText.trim()) {
        toast.error('Question text cannot be empty');
        return;
      }
      if (q.questionType === 'multiple-choice' && q.options.some(opt => !opt.trim())) {
        toast.error('Multiple choice options cannot be empty');
        return;
      }
      if (!q.correctAnswer.trim()) {
        toast.error('Correct answer cannot be empty');
        return;
      }
      if (q.points <= 0) {
        toast.error('Question points must be greater than 0');
        return;
      }
    }

    setSaving(true);
    try {
      let currentQuizId = quizId;

      // 1. Create or Update Quiz Details
      if (quizId === 'new') {
        const response = await fetch('/api/quizzes', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: quiz.title,
            description: quiz.description,
            type: quiz.type,
            timeLimit: quiz.timeLimit,
            totalPoints: calculateTotalPoints(), // Send calculated total points
            startTime: quiz.startTime || null,
            endTime: quiz.endTime || null,
            isPublished: quiz.isPublished,
            classId: quiz.classId || null,
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create quiz');
        currentQuizId = data.id; // Get the newly created quiz ID
        toast.success('Quiz created successfully!');
      } else {
        const response = await fetch(`/api/quizzes/${quizId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: quiz.title,
            description: quiz.description,
            type: quiz.type,
            timeLimit: quiz.timeLimit,
            totalPoints: calculateTotalPoints(), // Send calculated total points
            startTime: quiz.startTime || null,
            endTime: quiz.endTime || null,
            isPublished: quiz.isPublished,
            classId: quiz.classId || null,
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update quiz');
        toast.success('Quiz updated successfully!');
      }

      // 2. Handle Questions (Create/Update)
      const currentQuestionIds = new Set(quiz.questions.map(q => q.id).filter(Boolean) as string[]);
      const questionsToDelete = Array.from(initialQuestionIds).filter(id => !currentQuestionIds.has(id));

      // Delete removed questions
      for (const qId of questionsToDelete) {
        await fetch(`/api/quizzes/questions/${qId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
      }

      for (const question of quiz.questions) {
        if (question.id && initialQuestionIds.has(question.id)) {
          // Update existing question
          await fetch(`/api/quizzes/questions/${question.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              questionText: question.questionText,
              questionType: question.questionType,
              points: question.points,
              options: question.options,
              correctAnswer: question.correctAnswer,
            })
          });
        } else {
          // Create new question
          await fetch(`/api/quizzes/${currentQuizId}/questions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              questionText: question.questionText,
              questionType: question.questionType,
              points: question.points,
              options: question.options,
              correctAnswer: question.correctAnswer,
            })
          });
        }
      }
      
      navigate('/teacher/quizzes');
    } catch (error: any) {
      console.error('Error saving quiz:', error);
      toast.error('Failed to save quiz: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      questionText: '',
      questionType: 'multiple-choice', // Default type
      options: ['', '', '', ''],
      correctAnswer: '',
      points: 10
    };
    setQuiz({ ...quiz, questions: [...quiz.questions, newQuestion] });
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updatedQuestions = [...quiz.questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setQuiz({ ...quiz, questions: updatedQuestions });
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updatedQuestions = [...quiz.questions];
    updatedQuestions[questionIndex].options[optionIndex] = value;
    setQuiz({ ...quiz, questions: updatedQuestions });
  };

  const removeQuestion = async (index: number) => {
    const questionToRemove = quiz.questions[index];
    if (questionToRemove.id) {
      // If it's an existing question, delete from backend
      try {
        const response = await fetch(`/api/quizzes/questions/${questionToRemove.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to delete question from backend');
        toast.success('Question deleted successfully!');
        setInitialQuestionIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(questionToRemove.id!); // Remove from tracking set
          return newSet;
        });
      } catch (error: any) {
        console.error('Error deleting question:', error);
        toast.error(error.message || 'Failed to delete question');
        return; // Prevent removing from UI if backend deletion fails
      }
    }
    const updatedQuestions = quiz.questions.filter((_, i) => i !== index);
    setQuiz({ ...quiz, questions: updatedQuestions });
  };

  const calculateTotalPoints = () => {
    return quiz.questions.reduce((total, q) => total + q.points, 0);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading quiz...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/teacher/quizzes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Quizzes
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setQuiz({ ...quiz, isPublished: !quiz.isPublished })}> 
            {quiz.isPublished ? 'Unpublish' : 'Publish'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Quiz'}
          </Button>
        </div>
      </div>

      {/* Quiz Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Quiz Title</Label>
            <Input
              id="title"
              value={quiz.title}
              onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              placeholder="Enter quiz title"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={quiz.description}
              onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
              placeholder="Enter quiz description"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="quiz-type">Quiz Type</Label>
            <Select
              value={quiz.type}
              onValueChange={(value: 'multiple-choice' | 'true-false' | 'short-answer') =>
                setQuiz({ ...quiz, type: value })
              }
            >
              <SelectTrigger id="quiz-type">
                <SelectValue placeholder="Select quiz type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                <SelectItem value="true-false">True/False</SelectItem>
                <SelectItem value="short-answer">Short Answer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
              <Input
                id="timeLimit"
                type="number"
                value={quiz.timeLimit}
                onChange={(e) => setQuiz({ ...quiz, timeLimit: parseInt(e.target.value) || 0 })}
                min="1"
              />
            </div>
            <div>
              <Label htmlFor="totalPoints">Total Points</Label>
              <Input
                id="totalPoints"
                type="number"
                value={calculateTotalPoints()}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={quiz.startTime}
                onChange={(e) => setQuiz({ ...quiz, startTime: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={quiz.endTime}
                onChange={(e) => setQuiz({ ...quiz, endTime: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Questions</h3>
          <Button onClick={addQuestion} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>

        {quiz.questions.map((question, index) => (
          <Card key={question.id || `new-${index}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Question {index + 1}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQuestion(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor={`question-text-${index}`}>Question Text</Label>
                <Textarea
                  id={`question-text-${index}`}
                  value={question.questionText}
                  onChange={(e) => updateQuestion(index, 'questionText', e.target.value)}
                  placeholder="Enter question text"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor={`question-type-${index}`}>Question Type</Label>
                <Select
                  value={question.questionType}
                  onValueChange={(value: 'multiple-choice' | 'true-false' | 'short-answer') =>
                    updateQuestion(index, 'questionType', value)
                  }
                >
                  <SelectTrigger id={`question-type-${index}`}>
                    <SelectValue placeholder="Select question type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                    <SelectItem value="true-false">True/False</SelectItem>
                    <SelectItem value="short-answer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {question.questionType === 'multiple-choice' && (
                <div className="grid grid-cols-2 gap-4">
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="space-y-2">
                      <Label htmlFor={`option-${index}-${optionIndex}`}>
                        Option {optionIndex + 1}
                      </Label>
                      <Input
                        id={`option-${index}-${optionIndex}`}
                        value={option}
                        onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                        placeholder={`Option ${optionIndex + 1}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {question.questionType === 'true-false' && (
                <div>
                  <Label htmlFor={`correct-answer-${index}`}>Correct Answer</Label>
                  <Select
                    value={question.correctAnswer}
                    onValueChange={(value) => updateQuestion(index, 'correctAnswer', value)}
                  >
                    <SelectTrigger id={`correct-answer-${index}`}>
                      <SelectValue placeholder="Select correct answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="True">True</SelectItem>
                      <SelectItem value="False">False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {question.questionType === 'short-answer' && (
                <div>
                  <Label htmlFor={`correct-answer-${index}`}>Correct Answer</Label>
                  <Input
                    id={`correct-answer-${index}`}
                    value={question.correctAnswer}
                    onChange={(e) => updateQuestion(index, 'correctAnswer', e.target.value)}
                    placeholder="Enter correct answer"
                  />
                </div>
              )}

              {question.questionType === 'multiple-choice' && (
                <div>
                  <Label htmlFor={`mc-correct-answer-${index}`}>Correct Answer (Select Option Text)</Label>
                  <Select
                    value={question.correctAnswer}
                    onValueChange={(value) => updateQuestion(index, 'correctAnswer', value)}
                  >
                    <SelectTrigger id={`mc-correct-answer-${index}`}>
                      <SelectValue placeholder="Select correct option" />
                    </SelectTrigger>
                    <SelectContent>
                      {question.options.map((option, optIdx) => (
                        <SelectItem key={optIdx} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor={`points-${index}`}>Points</Label>
                <Input
                  id={`points-${index}`}
                  type="number"
                  value={question.points}
                  onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 0)}
                  min="1"
                />
              </div>
            </CardContent>
          </Card>
        ))}

        {quiz.questions.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-muted-foreground mb-4">
                <Plus className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No questions yet</h3>
              <p className="text-muted-foreground mb-4">Add your first question to get started</p>
              <Button onClick={addQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}