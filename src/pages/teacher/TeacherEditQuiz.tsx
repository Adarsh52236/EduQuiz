import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowLeft, Edit } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface Quiz {
  id: string;
  title: string;
  description: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer'; // Added type
  timeLimit: number;
  totalPoints: number; // Added totalPoints
  startTime: string; // Added startTime
  endTime: string; // Added endTime
  isPublished: boolean;
  createdAt: string;
  classId?: string;
  teacherName: string;
  status?: string;
}

interface QuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  questionType: 'multiple-choice' | 'true-false' | 'short-answer';
  points: number;
  orderIndex: number;
  options: string; // Stored as JSON string
  correctAnswer: string; // Stored as string
  createdAt: string;
}

export function TeacherEditQuiz() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    questionText: '',
    questionType: 'multiple-choice' as const,
    points: 10,
    options: ['', '', '', ''],
    correctAnswer: ''
  });

  useEffect(() => {
    if (!user || !quizId) return;
    loadQuizData();
  }, [user, quizId]);

  const loadQuizData = async () => {
    if (!quizId) return;
    setIsLoading(true);
    try {
      const quizResponse = await fetch(`/api/quizzes/${quizId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const quizData = await quizResponse.json();
      if (!quizResponse.ok) {
        throw new Error(quizData.message || 'Quiz not found');
      }
      setQuiz(quizData);

      const questionsResponse = await fetch(`/api/quizzes/${quizId}/questions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const questionData = await questionsResponse.json();
      if (!questionsResponse.ok) {
        throw new Error(questionData.message || 'Failed to load questions');
      }
      setQuestions(questionData);

    } catch (error: any) {
      console.error('Error loading quiz data:', error);
      toast.error(error.message || 'Failed to load quiz data');
      navigate('/teacher/quizzes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizUpdate = async () => {
    if (!quiz) return;
    try {
      const response = await fetch(`/api/quizzes/${quiz.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: quiz.title,
          description: quiz.description,
          type: quiz.type, // Added type
          timeLimit: quiz.timeLimit,
          totalPoints: quiz.totalPoints, // Added totalPoints
          startTime: quiz.startTime, // Added startTime
          endTime: quiz.endTime,     // Added endTime
          isPublished: quiz.isPublished
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update quiz');
      }
      toast.success('Quiz details updated');
    } catch (error: any) {
      console.error('Error updating quiz:', error);
      toast.error(error.message || 'Failed to update quiz');
    }
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion) return;

    try {
      const response = await fetch(`/api/quizzes/questions/${editingQuestion.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionText: editingQuestion.questionText,
          questionType: editingQuestion.questionType,
          points: editingQuestion.points,
          options: editingQuestion.questionType === 'multiple-choice' ? editingQuestion.options : null, // Ensure JSON string
          correctAnswer: editingQuestion.correctAnswer
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update question');
      }
      toast.success('Question updated successfully');
      setIsEditDialogOpen(false);
      setEditingQuestion(null);
      loadQuizData(); // Refresh questions
    } catch (error: any) {
      console.error('Error updating question:', error);
      toast.error(error.message || 'Failed to update question');
    }
  };

  const handleCreateQuestion = async () => {
    if (!quizId || !newQuestion.questionText.trim()) {
      toast.error('Please enter the question text');
      return;
    }

    try {
      const response = await fetch(`/api/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionText: newQuestion.questionText,
          questionType: newQuestion.questionType,
          points: newQuestion.points,
          options: newQuestion.questionType === 'multiple-choice' ? JSON.stringify(newQuestion.options) : null,
          correctAnswer: newQuestion.correctAnswer,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create question');
      }
      toast.success('Question added successfully');
      setIsCreateDialogOpen(false);
      loadQuizData(); // Refresh questions
      setNewQuestion({
        questionText: '',
        questionType: 'multiple-choice',
        points: 10,
        options: ['', '', '', ''],
        correctAnswer: ''
      });
    } catch (error: any) {
      console.error('Error creating question:', error);
      toast.error(error.message || 'Failed to create question');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      const response = await fetch(`/api/quizzes/questions/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete question');
      }
      toast.success('Question deleted');
      loadQuizData();
    } catch (error: any) {
      console.error('Error deleting question:', error);
      toast.error(error.message || 'Failed to delete question');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (!quiz) {
    return <div className="flex items-center justify-center h-full">Quiz not found.</div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/teacher/quizzes')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Quizzes
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit Quiz Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quiz-title">Quiz Title</Label>
            <Input
              id="quiz-title"
              value={quiz.title}
              onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-description">Description</Label>
            <Textarea
              id="quiz-description"
              value={quiz.description || ''}
              onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-type">Quiz Type</Label>
            <Select
              value={quiz.type}
              onValueChange={(value) => setQuiz({ ...quiz, type: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select quiz type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                <SelectItem value="true-false">True/False</SelectItem>
                <SelectItem value="short-answer">Short Answer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-total-points">Total Points</Label>
            <Input
              id="quiz-total-points"
              type="number"
              value={quiz.totalPoints || ''}
              onChange={(e) => setQuiz({ ...quiz, totalPoints: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-time-limit">Time Limit (minutes)</Label>
            <Input
              id="quiz-time-limit"
              type="number"
              value={quiz.timeLimit || ''}
              onChange={(e) => setQuiz({ ...quiz, timeLimit: Number(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quiz-start-time">Start Time</Label>
              <Input
                id="quiz-start-time"
                type="datetime-local"
                value={quiz.startTime ? new Date(quiz.startTime).toISOString().slice(0, 16) : ''}
                onChange={(e) => setQuiz({ ...quiz, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-end-time">End Time</Label>
              <Input
                id="quiz-end-time"
                type="datetime-local"
                value={quiz.endTime ? new Date(quiz.endTime).toISOString().slice(0, 16) : ''}
                onChange={(e) => setQuiz({ ...quiz, endTime: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="is-published"
              checked={quiz.isPublished}
              onCheckedChange={(checked) => setQuiz({ ...quiz, isPublished: checked })}
            />
            <Label htmlFor="is-published">Published</Label>
          </div>
          <Button onClick={handleQuizUpdate}>Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Quiz Questions</CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Question</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <Select
                    value={newQuestion.questionType}
                    onValueChange={(value) => setNewQuestion({ ...newQuestion, questionType: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select question type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                      <SelectItem value="true-false">True/False</SelectItem>
                      <SelectItem value="short-answer">Short Answer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question-text">Question Text</Label>
                  <Textarea
                    id="question-text"
                    value={newQuestion.questionText}
                    onChange={(e) => setNewQuestion({ ...newQuestion, questionText: e.target.value })}
                  />
                </div>

                {newQuestion.questionType === 'multiple-choice' && (
                  <div className="space-y-2">
                    <Label>Options</Label>
                    {newQuestion.options.map((opt, index) => (
                      <Input
                        key={index}
                        placeholder={`Option ${index + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...newQuestion.options];
                          newOptions[index] = e.target.value;
                          setNewQuestion({ ...newQuestion, options: newOptions });
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  {newQuestion.questionType === 'multiple-choice' ? (
                    <Select
                      value={newQuestion.correctAnswer}
                      onValueChange={(value) => setNewQuestion({ ...newQuestion, correctAnswer: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select correct answer" />
                      </SelectTrigger>
                      <SelectContent>
                        {newQuestion.options.map((opt, index) => (
                          opt && <SelectItem key={index} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : newQuestion.questionType === 'true-false' ? (
                     <Select
                      value={newQuestion.correctAnswer}
                      onValueChange={(value) => setNewQuestion({ ...newQuestion, correctAnswer: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select correct answer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="True">True</SelectItem>
                        <SelectItem value="False">False</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={newQuestion.correctAnswer}
                      onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Points</Label>
                  <Input
                    type="number"
                    value={newQuestion.points}
                    onChange={(e) => setNewQuestion({ ...newQuestion, points: Number(e.target.value) })}
                  />
                </div>

                <Button onClick={handleCreateQuestion} className="w-full">Create Question</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-muted-foreground">
              No questions have been added to this quiz yet.
            </p>
          ) : (
            <div className="space-y-4">
              {questions.map((q, index) => (
                <div key={q.id} className="p-4 border rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{index + 1}. {q.questionText}</p>
                    <p className="text-sm text-muted-foreground">Type: {q.questionType} | Points: {q.points}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditingQuestion({
                        ...q,
                        options: q.options ? JSON.parse(q.options) : ['', '', '', ''] // Parse options for editing
                      });
                      setIsEditDialogOpen(true);
                    }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteQuestion(q.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Question Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select
                  value={editingQuestion.questionType}
                  onValueChange={(value) => setEditingQuestion({ ...editingQuestion, questionType: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select question type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                    <SelectItem value="true-false">True/False</SelectItem>
                    <SelectItem value="short-answer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-question-text">Question Text</Label>
                <Textarea
                  id="edit-question-text"
                  value={editingQuestion.questionText}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, questionText: e.target.value })}
                />
              </div>

              {editingQuestion.questionType === 'multiple-choice' && (
                  <div className="space-y-2">
                    <Label>Options</Label>
                    {(editingQuestion.options as string[]).map((opt: string, index: number) => (
                      <Input
                        key={index}
                        placeholder={`Option ${index + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...(editingQuestion.options as string[])];
                          newOptions[index] = e.target.value;
                          setEditingQuestion({ ...editingQuestion, options: newOptions });
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  {editingQuestion.questionType === 'multiple-choice' ? (
                    <Select
                      value={editingQuestion.correctAnswer}
                      onValueChange={(value) => setEditingQuestion({ ...editingQuestion, correctAnswer: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select correct answer" />
                      </SelectTrigger>
                      <SelectContent>
                        {(editingQuestion.options as string[]).map((opt: string, index: number) => (
                          opt && <SelectItem key={index} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : editingQuestion.questionType === 'true-false' ? (
                     <Select
                      value={editingQuestion.correctAnswer}
                      onValueChange={(value) => setEditingQuestion({ ...editingQuestion, correctAnswer: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select correct answer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="True">True</SelectItem>
                        <SelectItem value="False">False</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={editingQuestion.correctAnswer}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Points</Label>
                  <Input
                    type="number"
                    value={editingQuestion.points}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, points: Number(e.target.value) })}
                  />
                </div>

              <Button onClick={handleUpdateQuestion} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}