import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Plus, Eye, Copy, BookOpen, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Import Select components

interface Quiz {
  id: string;
  title: string;
  description: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer'; // Added type
  timeLimit: number;
  totalPoints: number; // Changed from 'points' to 'totalPoints' to match backend
  startTime: string; // Added startTime
  endTime: string; // Added endTime
  isPublished: boolean;
  createdAt: string;
  classId?: string;
  teacherName: string; // Added teacherName
  status?: string; // Added status
}

interface Class { // Added Class interface for dropdown
  id: string;
  name: string;
}

export default function TeacherQuizzes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<Class[]>([]); // New state for teacher's classes
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    description: '',
    type: 'multiple-choice' as 'multiple-choice' | 'true-false' | 'short-answer', // Added type
    timeLimit: 30,
    totalPoints: 0, // Changed from 'points' to 'totalPoints'
    startTime: '', // Added startTime
    endTime: '', // Added endTime
    classId: ''
  });

  useEffect(() => {
    if (!user) return;
    loadQuizzes();
    loadClasses(); // Load classes for the dropdown
  }, [user]);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/quizzes', { // Use relative path
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load quizzes');
      setQuizzes(data);
    } catch (error: any) {
      console.error('Error loading quizzes:', error);
      toast.error(error.message || 'Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => { // New function to load classes
    try {
      const response = await fetch('/api/classes', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load classes');
      setClasses(data);
    } catch (error: any) {
      console.error('Error loading classes:', error);
      toast.error(error.message || 'Failed to load classes for quiz assignment');
    }
  };

  const handleCreateQuiz = async () => {
    if (!user || !newQuiz.title.trim() || !newQuiz.type) {
      toast.error('Please enter quiz title and type');
      return;
    }

    try {
      const response = await fetch('/api/quizzes', { // Use relative path
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newQuiz,
          teacherId: user.id,
          startTime: newQuiz.startTime || null, // Ensure null if empty
          endTime: newQuiz.endTime || null,     // Ensure null if empty
          totalPoints: newQuiz.totalPoints || 0,
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create quiz');
      
      toast.success('Quiz created successfully!');
      setShowCreateDialog(false);
      setNewQuiz({ title: '', description: '', type: 'multiple-choice', timeLimit: 30, totalPoints: 0, startTime: '', endTime: '', classId: '' });
      loadQuizzes();
    } catch (error: any) {
      console.error('Error creating quiz:', error);
      toast.error('Failed to create quiz: ' + error.message);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    
    try {
      const response = await fetch(`/api/quizzes/${quizId}`, { // Use relative path
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to delete quiz');
      toast.success('Quiz deleted successfully!');
      setQuizzes(quizzes.filter(q => q.id !== quizId));
    } catch (error: any) {
      console.error('Error deleting quiz:', error);
      toast.error('Failed to delete quiz: ' + error.message);
    }
  };

  const handlePublishToggle = async (quizId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/quizzes/${quizId}`, { // Use relative path
        method: 'PUT', // Changed to PUT as per backend
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPublished: !currentStatus })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update quiz');
      
      toast.success(`Quiz ${!currentStatus ? 'published' : 'unpublished'} successfully!`);
      setQuizzes(quizzes.map(q => q.id === quizId ? { ...q, isPublished: !currentStatus } : q)); // Update locally
    } catch (error: any) {
      console.error('Error updating quiz:', error);
      toast.error('Failed to update quiz: ' + error.message);
    }
  };

  const copyQuizCode = (quizId: string) => {
    navigator.clipboard.writeText(quizId);
    toast.success('Quiz ID copied to clipboard!');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading quizzes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">My Quizzes</h2>
          <p className="text-muted-foreground">Create and manage your quiz collection</p>
        </div>
        <Button onClick={() => navigate('/teacher/quizzes/create')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Quiz
        </Button>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Quiz</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newQuiz.title}
                onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                placeholder="Enter quiz title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newQuiz.description}
                onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })}
                placeholder="Enter quiz description"
              />
            </div>
            <div>
              <Label htmlFor="type">Quiz Type</Label>
              <Select value={newQuiz.type} onValueChange={(value: 'multiple-choice' | 'true-false' | 'short-answer') => setNewQuiz({ ...newQuiz, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a quiz type" />
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
                <Label htmlFor="totalPoints">Total Points</Label>
                <Input
                  id="totalPoints"
                  type="number"
                  value={newQuiz.totalPoints}
                  onChange={(e) => setNewQuiz({ ...newQuiz, totalPoints: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  value={newQuiz.timeLimit}
                  onChange={(e) => setNewQuiz({ ...newQuiz, timeLimit: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={newQuiz.startTime}
                  onChange={(e) => setNewQuiz({ ...newQuiz, startTime: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={newQuiz.endTime}
                  onChange={(e) => setNewQuiz({ ...newQuiz, endTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="classId">Assign to Class (Optional)</Label>
              <Select value={newQuiz.classId} onValueChange={(value) => setNewQuiz({ ...newQuiz, classId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateQuiz} className="w-full" disabled={!newQuiz.title || !newQuiz.type}>
              Create Quiz
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((quiz) => (
          <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{quiz.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{quiz.description || 'No description'}</p>
                </div>
                <Badge variant={quiz.isPublished ? 'default' : 'secondary'}>
                  {quiz.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{quiz.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Points:</span>
                  <span className="font-medium">{quiz.totalPoints}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Time Limit:</span>
                  <span className="font-medium">{quiz.timeLimit} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium">{quiz.status}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Starts:</span>
                  <span className="font-medium">{quiz.startTime ? new Date(quiz.startTime).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ends:</span>
                  <span className="font-medium">{quiz.endTime ? new Date(quiz.endTime).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">{new Date(quiz.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/teacher/quizzes/${quiz.id}`)}
                  className="flex-1 min-w-[80px]"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/teacher/quizzes/${quiz.id}/analytics`)}
                  className="flex-1 min-w-[100px]"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Analytics
                </Button>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyQuizCode(quiz.id)}
                  title="Copy Quiz ID"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePublishToggle(quiz.id, quiz.isPublished)}
                  className="flex-1"
                >
                  {quiz.isPublished ? 'Unpublish' : 'Publish'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteQuiz(quiz.id)}
                  className="text-red-600 hover:text-red-700"
                  title="Delete Quiz"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {quizzes.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
          <p className="text-muted-foreground mb-4">Create your first quiz to get started</p>
          <Button onClick={() => navigate('/teacher/quizzes/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Quiz
          </Button>
        </div>
      )}
    </div>
  );
}
