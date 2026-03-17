import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, BookOpen, Award, Download, Filter, User } from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Class {
  id: string;
  name: string;
}

interface Quiz {
  id: string;
  title: string;
}

interface Student {
  id: string;
  displayName: string;
}

export default function TeacherAnalytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [classFilter, setClassFilter] = useState('all');
  const [quizFilter, setQuizFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all'); // New state for student filter
  const [classes, setClasses] = useState<Class[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [students, setStudents] = useState<Student[]>([]); // State to store students for filter
  const [selectedQuizDetails, setSelectedQuizDetails] = useState<any>(null);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<any>(null); // New state for per-student analytics

  useEffect(() => {
    if (!user) return;
    loadClassesQuizzesAndStudents();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
    if (quizFilter !== 'all') {
      loadPerQuizAnalytics(quizFilter);
    } else {
      setSelectedQuizDetails(null);
    }
    if (studentFilter !== 'all') {
      loadPerStudentAnalytics(studentFilter);
    } else {
      setSelectedStudentDetails(null);
    }
  }, [user, timeRange, classFilter, quizFilter, studentFilter]);

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    console.log('[TeacherAnalytics] Fetching:', url);
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      let errorMessage = `API call failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
        console.error('[TeacherAnalytics] Error response:', response.status, errorData);
      } catch (e) {
        console.error('[TeacherAnalytics] Error response (non-JSON):', response.status, response.statusText);
      }
      throw new Error(errorMessage);
    }
    return response.json();
  };

  const loadClassesQuizzesAndStudents = async () => {
    try {
      console.log('[TeacherAnalytics] Loading classes, quizzes, and students...');
      
      const classesData: Class[] = await fetchWithAuth('/api/classes');
      console.log('[TeacherAnalytics] Classes loaded:', classesData.length);
      setClasses(classesData);

      const quizzesData: Quiz[] = await fetchWithAuth('/api/quizzes');
      console.log('[TeacherAnalytics] Quizzes loaded:', quizzesData.length);
      setQuizzes(quizzesData);

      // Get unique students from all teacher's classes via enrollments
      const studentsSet = new Set<string>();
      const studentsMap = new Map<string, Student>();
      
      for (const cls of classesData) {
        try {
          const enrollments = await fetchWithAuth(`/api/enrollments?classId=${cls.id}`);
          console.log(`[TeacherAnalytics] Enrollments for class ${cls.name}:`, enrollments.length);
          
          // Extract unique students from enrollments
          for (const enrollment of enrollments) {
            if (enrollment.studentId && !studentsSet.has(enrollment.studentId)) {
              studentsSet.add(enrollment.studentId);
              // Try to get student details from enrollment or fetch separately
              if (enrollment.studentName) {
                studentsMap.set(enrollment.studentId, {
                  id: enrollment.studentId,
                  displayName: enrollment.studentName
                });
              }
            }
          }
        } catch (err) {
          console.error(`[TeacherAnalytics] Error fetching enrollments for class ${cls.id}:`, err);
        }
      }
      
      const studentsArray = Array.from(studentsMap.values());
      console.log('[TeacherAnalytics] Unique students found:', studentsArray.length);
      setStudents(studentsArray);
    } catch (error: any) {
      console.error('[TeacherAnalytics] Error loading data:', error);
      toast.error(error.message || 'Failed to load classes, quizzes, and students for filters.');
    }
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      console.log('[TeacherAnalytics] Loading analytics with filters:', {
        timeRange,
        classFilter,
        quizFilter,
        studentFilter
      });
      
      const params = new URLSearchParams({
        timeRange,
        classId: classFilter,
        quizId: quizFilter,
        studentId: studentFilter // Include studentFilter in params
      });
      
      const response = await fetch(`/api/analytics?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        console.error('[TeacherAnalytics] Analytics API error:', data);
        throw new Error(data.message || 'Failed to load analytics');
      }
      console.log('[TeacherAnalytics] Analytics loaded:', data);
      setAnalytics(data);
    } catch (error: any) {
      console.error('[TeacherAnalytics] Error loading analytics:', error);
      setAnalytics(null);
      toast.error(error.message || 'Failed to load analytics data.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPerQuizAnalytics = async (quizId: string) => {
    try {
      const params = new URLSearchParams({
        timeRange,
        classId: classFilter
      });
      const response = await fetch(`/api/analytics/quiz-analytics/${quizId}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load per-quiz analytics');
      setSelectedQuizDetails(data);
    } catch (error: any) {
      console.error('Error loading per-quiz analytics:', error);
      setSelectedQuizDetails(null);
      toast.error(error.message || 'Failed to load per-quiz analytics data.');
    }
  };

  const loadPerStudentAnalytics = async (studentId: string) => {
    try {
      const params = new URLSearchParams({
        timeRange,
        classId: classFilter
      });
      const response = await fetch(`/api/analytics/student-analytics/${classFilter}/${studentId}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load per-student analytics');
      setSelectedStudentDetails(data);
    } catch (error: any) {
      console.error('Error loading per-student analytics:', error);
      setSelectedStudentDetails(null);
      toast.error(error.message || 'Failed to load per-student analytics data.');
    }
  };

  const handleExport = (format: 'pdf' | 'csv', reportType: string) => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({
      format,
      reportType,
      timeRange,
      classId: classFilter,
      quizId: quizFilter,
      studentId: studentFilter // Include studentFilter in export params
    });
    const url = `/api/analytics/export?${params.toString()}`;
    
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(errorData => {
          throw new Error(errorData.message || 'Failed to generate report');
        });
      }
      return response.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_report_${reportType}_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded successfully!');
    })
    .catch((error: any) => {
      toast.error(error.message || 'Failed to download report');
    });
  };

  const performanceData = {
    labels: analytics?.performanceOverTime?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Average Score',
        data: analytics?.performanceOverTime?.scores || [65, 72, 78, 82, 85, 88, 90],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Participation Rate',
        data: analytics?.performanceOverTime?.participation || [80, 85, 88, 90, 92, 94, 95],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const quizDifficultyData = {
    labels: analytics?.quizDifficulty?.labels || ['Easy', 'Medium', 'Hard'],
    datasets: [{
      data: analytics?.quizDifficulty?.counts || [15, 25, 10],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(251, 191, 36, 0.8)',
        'rgba(239, 68, 68, 0.8)'
      ],
      borderWidth: 0
    }]
  };

  const topStudentsData = {
    labels: analytics?.topStudents?.labels || ['Student A', 'Student B', 'Student C', 'Student D', 'Student E'],
    datasets: [{
      label: 'Average Score',
      data: analytics?.topStudents?.scores || [95, 92, 88, 85, 82],
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
      borderRadius: 4
    }]
  };

  if (isLoading) return <div className="flex items-center justify-center h-full">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex space-x-2">
          <Button onClick={() => handleExport('csv', 'overall-dashboard')} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => handleExport('pdf', 'overall-dashboard')} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={quizFilter} onValueChange={setQuizFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Quiz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quizzes</SelectItem>
              {quizzes.map(quiz => (
                <SelectItem key={quiz.id} value={quiz.id}>{quiz.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={studentFilter} onValueChange={setStudentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Student" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {students.map(student => (
                <SelectItem key={student.id} value={student.id}>{student.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalStudents || 0}</div>
            <p className="text-xs text-muted-foreground">+{analytics?.newStudentsThisWeek || 0} this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quizzes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalQuizzes || 0}</div>
            <p className="text-xs text-muted-foreground">{analytics?.publishedQuizzes || 0} published</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Quizzes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.activeQuizzes || 0}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.averageScore || 0}%</div>
            <p className="text-xs text-muted-foreground">+{analytics?.scoreImprovement || 0}% improvement</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Quiz Analytics */}
      {quizFilter !== 'all' && selectedQuizDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Analytics for {quizzes.find(q => q.id === quizFilter)?.title}</CardTitle>
            <CardDescription>Detailed insights for the selected quiz</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Average Score</p>
                <p className="text-3xl font-bold text-primary">{selectedQuizDetails.averageScore || 0}%</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Attempts</p>
                <p className="text-3xl font-bold">{selectedQuizDetails.totalAttempts || 0}</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Average Time Taken</p>
                <p className="text-3xl font-bold">{selectedQuizDetails.averageTimeTaken || 0} min</p>
              </div>
            </div>

            {/* Question Difficulty Levels */}
            {selectedQuizDetails.questionAnalysis && selectedQuizDetails.questionAnalysis.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Question Analysis</h3>
                <ScrollArea className="h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Question</TableHead>
                        <TableHead>Correct %</TableHead>
                        <TableHead>Avg Time (s)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuizDetails.questionAnalysis.map((q: any) => (
                        <TableRow key={q.questionId}>
                          <TableCell className="font-medium">{q.questionText}</TableCell>
                          <TableCell>{q.correctPercentage}%</TableCell>
                          <TableCell>{q.averageTimeSeconds}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            {/* Highest & Lowest Performing Students */}
            {selectedQuizDetails.topStudents && selectedQuizDetails.topStudents.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Top Performing Students</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedQuizDetails.topStudents.map((s: any) => (
                      <TableRow key={s.studentId}>
                        <TableCell className="font-medium">{s.studentName}</TableCell>
                        <TableCell>{s.score}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <Line data={performanceData} options={{ responsive: true, maintainAspectRatio: false }} height={300} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quiz Difficulty Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <Doughnut data={quizDifficultyData} options={{ responsive: true, maintainAspectRatio: false }} height={300} />
          </CardContent>
        </Card>
      </div>

      {/* Top Students */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Students</CardTitle>
        </CardHeader>
        <CardContent>
          <Bar data={topStudentsData} options={{ responsive: true, maintainAspectRatio: false }} height={250} />
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Quiz Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics?.recentAttempts?.map((attempt: any) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-medium">{attempt.studentName}</TableCell>
                    <TableCell>{attempt.quizTitle}</TableCell>
                    <TableCell>{attempt.score}%</TableCell>
                    <TableCell>{attempt.timeSpent} min</TableCell>
                    <TableCell>
                      <Badge variant={attempt.score >= 80 ? 'default' : attempt.score >= 60 ? 'secondary' : 'destructive'}>
                        {attempt.score >= 80 ? 'Excellent' : attempt.score >= 60 ? 'Good' : 'Needs Improvement'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )) || (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No recent attempts</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}