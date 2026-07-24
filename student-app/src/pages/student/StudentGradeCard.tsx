import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Download, TrendingUp, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Quiz {
  id: string;
  title: string;
  description: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  timeLimit: number;
  totalPoints: number;
  startTime: string;
  endTime: string;
  isPublished: boolean;
  createdAt: string;
  classId?: string;
  teacherName: string;
  status: 'Upcoming' | 'Active' | 'Closed';
}

interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  score: number;
  totalPoints: number;
  submittedAt: string;
  timeTaken: number;
}

interface ClassEnrollment {
  id: string;
  studentId: string;
  classId: string;
  enrolledAt: string;
  className: string;
  teacherName: string;
}

export function StudentGradeCard() {
  const { user } = useAuth();
  const [enrolledClasses, setEnrolledClasses] = useState<ClassEnrollment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    totalScore: 0,
    totalPossiblePoints: 0,
    averagePercentage: 0,
    rank: '-'
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `API call failed: ${response.statusText}`);
    }
    return response.json();
  };

  useEffect(() => {
    if (!user) return;
    loadEnrolledClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClassId) {
      loadGradeData(selectedClassId);
    } else {
      setAttempts([]);
      setQuizzes({});
      setStats({
        totalQuizzes: 0,
        totalScore: 0,
        totalPossiblePoints: 0,
        averagePercentage: 0,
        rank: '-'
      });
    }
  }, [selectedClassId]);

  const loadEnrolledClasses = async () => {
    setIsLoading(true);
    try {
      const data: ClassEnrollment[] = await fetchWithAuth('/api/enrollments');
      setEnrolledClasses(data);
      if (data.length > 0) {
        setSelectedClassId(data[0].classId); // Select the first enrolled class by default
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load enrolled classes');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGradeData = async (classId: string) => {
    if (!user) return;
    try {
      // Fetch completed attempts for the selected class
      const attemptsData: QuizAttempt[] = await fetchWithAuth(`/api/attempts?isCompleted=true`);
      const classAttempts = attemptsData.filter(attempt => {
        const quiz = quizzes[attempt.quizId];
        return quiz && quiz.classId === classId;
      });

      // Fetch all quizzes
      const allQuizzes: Quiz[] = await fetchWithAuth('/api/quizzes');
      const quizMap: Record<string, Quiz> = {};
      allQuizzes.forEach(q => {
        quizMap[q.id] = q;
      });
      setQuizzes(quizMap);

      // Filter attempts again after quizzes are loaded
      const filteredClassAttempts = attemptsData.filter(attempt => {
        const quiz = quizMap[attempt.quizId];
        return quiz && quiz.classId === classId;
      });
      setAttempts(filteredClassAttempts);

      // Calculate statistics
      const totalScore = filteredClassAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
      const totalPossiblePoints = filteredClassAttempts.reduce((sum, a) => sum + a.totalPoints, 0);
      const averagePercentage = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;

      // Fetch student's rank for the selected class
      const myPerformanceData = await fetchWithAuth(`/api/analytics/my-performance/${classId}`);
      const studentRank = myPerformanceData?.myPerformance?.student_rank || '-';

      setStats({
        totalQuizzes: filteredClassAttempts.length,
        totalScore,
        totalPossiblePoints,
        averagePercentage: Math.round(averagePercentage),
        rank: studentRank
      });

    } catch (error: any) {
      toast.error(error.message || 'Failed to load grade data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadGradeCard = async () => {
    if (!user || !selectedClassId) {
      toast.error('Please select a class to download the grade card.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/grade-card/${selectedClassId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const className = enrolledClasses.find(cls => cls.classId === selectedClassId)?.className || 'class';
      a.download = `grade-card-${className.replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Grade card downloaded successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download grade card. Please try again later.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading grade card...</p>
        </div>
      </div>
    );
  }

  if (enrolledClasses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center hover:shadow-md transition-shadow">
          <CardContent className="py-12">
            <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Classes Joined</h3>
            <p className="text-muted-foreground mb-4">Join a class to view and download your grade cards.</p>
            <Link to="/student/enroll">
              <Button>Join a Classroom</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">My Grade Card</h2>
          <p className="text-muted-foreground">View your overall performance and download detailed reports</p>
        </div>
        <Button onClick={handleDownloadGradeCard} disabled={!selectedClassId} className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Select Class
          </CardTitle>
          <CardDescription>Choose a class to view your grade card and performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="class-select">Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger id="class-select">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {enrolledClasses.map(cls => (
                    <SelectItem key={cls.classId} value={cls.classId}>{cls.className}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overall Performance */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Overall Performance
          </CardTitle>
          <CardDescription>Your cumulative academic performance for the selected class</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Quizzes</CardTitle>
                <Award className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.totalQuizzes}</div>
                <p className="text-xs text-muted-foreground mt-1">Completed attempts</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Score</CardTitle>
                <Award className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.totalScore}</div>
                <p className="text-xs text-muted-foreground mt-1">Points earned</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Possible</CardTitle>
                <Award className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.totalPossiblePoints}</div>
                <p className="text-xs text-muted-foreground mt-1">Maximum points</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.averagePercentage}%</div>
                <div className="mt-2">
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all" 
                      style={{ width: `${Math.min(stats.averagePercentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Overall performance</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Performance Status</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {stats.averagePercentage >= 90 ? 'Excellent! Keep up the great work!' :
                       stats.averagePercentage >= 70 ? 'Good performance! Keep improving!' :
                       stats.averagePercentage >= 50 ? 'Average performance. More practice needed.' :
                       'Needs improvement. Consider seeking help from teachers.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-secondary/5 border-secondary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <Award className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Your Rank in Class</p>
                    <p className="text-3xl font-bold text-secondary-foreground mt-1">{stats.rank}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-blue-500" />
            Quiz Results
          </CardTitle>
          <CardDescription>Detailed breakdown of your quiz performances for the selected class</CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Award className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No completed quizzes yet</p>
              <p className="text-sm mt-1">Complete quizzes to see your grades here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attempts.map((attempt) => {
                const quiz = quizzes[attempt.quizId];
                const percentage = attempt.totalPoints > 0 ? (attempt.score / attempt.totalPoints) * 100 : 0;
                
                return (
                  <Card key={attempt.id} className="hover:shadow-md transition-shadow border-2 hover:border-primary/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Award className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-lg">{quiz?.title || 'Quiz'}</h4>
                              <p className="text-sm text-muted-foreground">
                                Completed on {new Date(attempt.submittedAt).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-1">Score</p>
                            <p className="font-bold text-lg">{attempt.score} / {attempt.totalPoints}</p>
                          </div>
                          <Badge 
                            variant={percentage >= 90 ? 'default' : percentage >= 70 ? 'secondary' : 'outline'}
                            className="text-base px-3 py-1"
                          >
                            {Math.round(percentage)}%
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
