import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Quiz } from '@/types'; // Assuming Quiz type is defined in types.ts
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, Search, Filter, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Class {
  id: string;
  name: string;
}

interface ClassroomOverview {
  classId: string;
  totalStudents: number;
  activeQuizzes: number;
  participationRate: number;
}

interface PerQuizAnalytics {
  quizId: string;
  averageScore: number;
  totalAttempts: number;
  questionPerformance: any[]; // Adjust type as needed
  timeTakenDistribution: any[]; // Adjust type as needed
  highestPerformingStudents: any[]; // Adjust type as needed
  lowestPerformingStudents: any[]; // Adjust type as needed
}

interface PerStudentAnalytics {
  studentId: string;
  classId: string;
  quizScores: any[]; // Adjust type as needed
  averageAccuracy: number;
  attendanceRate: number;
}

interface LeaderboardEntry {
  student_rank: number;
  studentName: string;
  totalScore: number;
}

export function TeacherAnalytics() {
  const { user } = useAuth();
  const socket = useSocket();
  const [classes, setClasses] = useState<Class[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [classroomOverview, setClassroomOverview] = useState<ClassroomOverview | null>(null);
  const [perQuizAnalytics, setPerQuizAnalytics] = useState<PerQuizAnalytics | null>(null);
  const [perStudentAnalytics, setPerStudentAnalytics] = useState<PerStudentAnalytics[]>([]); // Array for all students in a class
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  // Advanced filtering state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [minScore, setMinScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadClasses();
  }, [user]);

  // Reload leaderboard when filters change
  useEffect(() => {
    if (selectedClassId) {
      loadLeaderboard(selectedClassId);
    }
  }, [searchTerm, minScore, maxScore, startDate, endDate]);

  // Listen for real-time leaderboard updates
  useEffect(() => {
    if (!socket || !selectedClassId) return;

    const handleLeaderboardUpdate = (data: { classId: string; leaderboard: LeaderboardEntry[] }) => {
      if (data.classId === selectedClassId) {
        // Apply current filters to the new leaderboard data
        let filteredLeaderboard = data.leaderboard;
        
        if (searchTerm) {
          filteredLeaderboard = filteredLeaderboard.filter(entry => 
            entry.studentName.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        if (minScore) {
          filteredLeaderboard = filteredLeaderboard.filter(entry => 
            entry.totalScore >= parseInt(minScore)
          );
        }
        
        if (maxScore) {
          filteredLeaderboard = filteredLeaderboard.filter(entry => 
            entry.totalScore <= parseInt(maxScore)
          );
        }
        
        setLeaderboard(filteredLeaderboard);
      }
    };

    socket.on('leaderboardUpdate', handleLeaderboardUpdate);

    return () => {
      socket.off('leaderboardUpdate', handleLeaderboardUpdate);
    };
  }, [socket, selectedClassId, searchTerm, minScore, maxScore]);

  useEffect(() => {
    if (selectedClassId) {
      loadClassroomOverview(selectedClassId);
      loadLeaderboard(selectedClassId);
      loadPerStudentAnalytics(selectedClassId);
      loadQuizzesForClass(selectedClassId);
    } else {
      setClassroomOverview(null);
      setLeaderboard([]);
      setPerStudentAnalytics([]);
      setQuizzes([]);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedQuizId) {
      loadPerQuizAnalytics(selectedQuizId);
    } else {
      setPerQuizAnalytics(null);
    }
  }, [selectedQuizId]);

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

  const loadClasses = async () => {
    setIsLoading(true);
    try {
      const data = await fetchWithAuth('/api/classes');
      setClasses(data);
      if (data.length > 0) {
        setSelectedClassId(data[0].id); // Select the first class by default
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load classes');
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuizzesForClass = async (classId: string) => {
    try {
      const data = await fetchWithAuth(`/api/quizzes?classId=${classId}`);
      setQuizzes(data);
      if (data.length > 0) {
        setSelectedQuizId(data[0].id); // Select the first quiz by default
      } else {
        setSelectedQuizId('');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load quizzes for class');
    }
  };

  const loadClassroomOverview = async (classId: string) => {
    try {
      const data = await fetchWithAuth(`/api/analytics/classroom-overview/${classId}`);
      setClassroomOverview(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load classroom overview');
    }
  };

  const loadPerQuizAnalytics = async (quizId: string) => {
    try {
      const data = await fetchWithAuth(`/api/analytics/quiz-analytics/${quizId}`);
      setPerQuizAnalytics(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load per-quiz analytics');
    }
  };

  const loadPerStudentAnalytics = async (classId: string) => {
    try {
      // Fetch enrollments and then individual student analytics
      const enrollmentsData = await fetchWithAuth(`/api/classes/${classId}/enrollments`);
      if (enrollmentsData.enrollments && enrollmentsData.enrollments.length > 0) {
        const studentAnalyticsPromises = enrollmentsData.enrollments.map((enrollment: any) =>
          fetchWithAuth(`/api/analytics/student-analytics/${classId}/${enrollment.studentId}`)
            .catch(err => {
              console.error(`Failed to load analytics for student ${enrollment.studentId}:`, err);
              return null;
            })
        );
        const allStudentAnalytics = await Promise.all(studentAnalyticsPromises);
        setPerStudentAnalytics(allStudentAnalytics.filter((analytics: any) => analytics !== null));
      } else {
        setPerStudentAnalytics([]);
      }
    } catch (error: any) {
      console.error('Error loading per-student analytics:', error);
      toast.error(error.message || 'Failed to load per-student analytics');
      setPerStudentAnalytics([]);
    }
  };

  const loadLeaderboard = async (classId: string) => {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (minScore) params.append('minScore', minScore);
      if (maxScore) params.append('maxScore', maxScore);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetchWithAuth(`/api/analytics/leaderboard/${classId}?${params}`);
      setLeaderboard(response.leaderboard);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load leaderboard');
    }
  };

  const handleExport = async (format: 'csv' | 'pdf', reportType: string) => {
    if (!selectedClassId && (reportType === 'classroom-overview' || reportType === 'per-student-analytics' || reportType === 'leaderboard')) {
      toast.error('Please select a class to export this report.');
      return;
    }
    if (!selectedQuizId && reportType === 'per-quiz-analytics') {
      toast.error('Please select a quiz to export this report.');
      return;
    }

    try {
      let url = `/api/analytics/export?format=${format}&reportType=${reportType}`;
      if (selectedClassId) url += `&classId=${selectedClassId}`;
      if (selectedQuizId) url += `&quizId=${selectedQuizId}`;

      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}${url}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to export report');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `analytics_report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Report exported successfully!');
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Failed to export report');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
        <p className="text-muted-foreground">Detailed insights into your classes and student performance</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="class-select">Select Class</Label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger id="class-select">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedClassId && quizzes.length > 0 && (
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="quiz-select">Select Quiz</Label>
            <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
              <SelectTrigger id="quiz-select">
                <SelectValue placeholder="Select a quiz" />
              </SelectTrigger>
              <SelectContent>
                {quizzes.map(quiz => (
                  <SelectItem key={quiz.id} value={quiz.id}>{quiz.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Classroom Overview */}
      {selectedClassId && classroomOverview ? (
        <Card>
          <CardHeader>
            <CardTitle>Classroom Overview</CardTitle>
            <CardDescription>Summary for {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
              <span className="text-4xl font-bold">{classroomOverview.totalStudents}</span>
              <span className="text-muted-foreground">Total Students</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
              <span className="text-4xl font-bold">{classroomOverview.activeQuizzes}</span>
              <span className="text-muted-foreground">Active Quizzes</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
              <span className="text-4xl font-bold">{classroomOverview.participationRate.toFixed(2)}%</span>
              <span className="text-muted-foreground">Participation Rate</span>
            </div>
          </CardContent>
          <div className="p-4 flex justify-end gap-2">
            <Button onClick={() => handleExport('csv', 'classroom-overview')} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={() => handleExport('pdf', 'classroom-overview')} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>
          </div>
        </Card>
      ) : selectedClassId && (
        <Card>
          <CardHeader>
            <CardTitle>Classroom Overview</CardTitle>
            <CardDescription>Summary for {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Loading classroom data...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Quiz Analytics */}
      {selectedQuizId && perQuizAnalytics ? (
        <Card>
          <CardHeader>
            <CardTitle>Per-Quiz Analytics</CardTitle>
            <CardDescription>Insights for {quizzes.find(q => q.id === selectedQuizId)?.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                <span className="text-4xl font-bold">{perQuizAnalytics.averageScore.toFixed(2)}</span>
                <span className="text-muted-foreground">Average Score</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                <span className="text-4xl font-bold">{perQuizAnalytics.totalAttempts}</span>
                <span className="text-muted-foreground">Total Attempts</span>
              </div>
            </div>

            {/* Question Difficulty */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Question Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {perQuizAnalytics.questionPerformance.length > 0 ? (
                  <div className="space-y-2">
                    {perQuizAnalytics.questionPerformance.map((q: any) => (
                      <div key={q.questionId} className="flex justify-between items-center">
                        <p className="text-sm">{q.questionText}</p>
                        <Badge variant="secondary">{q.accuracy ? q.accuracy.toFixed(2) : 0}% Correct</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No question performance data.</p>
                )}
              </CardContent>
            </Card>

            {/* Time Taken Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Time Taken Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {perQuizAnalytics.timeTakenDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={perQuizAnalytics.timeTakenDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timeRange" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="hsl(var(--chart-3))" name="Students" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground">No time taken data.</p>
                )}
              </CardContent>
            </Card>

            {/* Top/Bottom Students */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Highest Performing Students</CardTitle>
                </CardHeader>
                <CardContent>
                  {perQuizAnalytics.highestPerformingStudents.length > 0 ? (
                    <div className="space-y-2">
                      {perQuizAnalytics.highestPerformingStudents.map((s: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <p className="text-sm">{s.studentName}</p>
                          <Badge variant="default">{s.score} / {s.totalPoints}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No data.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lowest Performing Students</CardTitle>
                </CardHeader>
                <CardContent>
                  {perQuizAnalytics.lowestPerformingStudents.length > 0 ? (
                    <div className="space-y-2">
                      {perQuizAnalytics.lowestPerformingStudents.map((s: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <p className="text-sm">{s.studentName}</p>
                          <Badge variant="destructive">{s.score} / {s.totalPoints}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No data.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
          <div className="p-4 flex justify-end gap-2">
            <Button onClick={() => handleExport('csv', 'per-quiz-analytics')} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={() => handleExport('pdf', 'per-quiz-analytics')} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>
          </div>
        </Card>
      ) : selectedQuizId && (
        <Card>
          <CardHeader>
            <CardTitle>Per-Quiz Analytics</CardTitle>
            <CardDescription>Insights for {quizzes.find(q => q.id === selectedQuizId)?.title}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No quiz data available</p>
              <p className="text-sm mt-1">Students need to attempt this quiz to see analytics</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Student Analytics (for all students in selected class) */}
      {selectedClassId && perStudentAnalytics.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Per-Student Analytics</CardTitle>
            <CardDescription>Performance of students in {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {perStudentAnalytics.map((studentData: any) => (
              <Card key={studentData.studentId} className="p-4">
                <CardTitle className="text-lg mb-2">{studentData.studentName || studentData.studentId}</CardTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col items-center justify-center p-2 border rounded-lg">
                    <span className="text-2xl font-bold">{studentData.averageAccuracy?.toFixed(2) || '0.00'}%</span>
                    <span className="text-muted-foreground text-sm">Avg. Accuracy</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 border rounded-lg">
                    <span className="text-2xl font-bold">{studentData.attendanceRate?.toFixed(2) || '0.00'}%</span>
                    <span className="text-muted-foreground text-sm">Attendance Rate</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 border rounded-lg">
                    <span className="text-2xl font-bold">{studentData.quizScores?.length || 0}</span>
                    <span className="text-muted-foreground text-sm">Quizzes Attempted</span>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Quiz Scores:</h4>
                  {studentData.quizScores && studentData.quizScores.length > 0 ? (
                    <div className="space-y-1">
                      {studentData.quizScores.map((score: any, index: number) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{score.quizTitle}</span>
                          <span>{score.score} / {score.totalPoints}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No quiz scores available.</p>
                  )}
                </div>
              </Card>
            ))}
          </CardContent>
          <div className="p-4 flex justify-end gap-2">
            <Button onClick={() => handleExport('csv', 'per-student-analytics')} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={() => handleExport('pdf', 'per-student-analytics')} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>
          </div>
        </Card>
      ) : selectedClassId && (
        <Card>
          <CardHeader>
            <CardTitle>Per-Student Analytics</CardTitle>
            <CardDescription>Performance of students in {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No student data available</p>
              <p className="text-sm mt-1">Students need to complete quizzes to see analytics</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      {selectedClassId ? (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Leaderboard
                </CardTitle>
                <CardDescription>Top students in {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
              </div>
              <Button 
                onClick={() => setShowFilters(!showFilters)}
                variant="outline" 
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
            
            {/* Search Bar */}
            <div className="flex gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 p-4 border rounded-lg bg-muted/50">
                <div>
                  <Label htmlFor="min-score">Min Score</Label>
                  <Input
                    id="min-score"
                    type="number"
                    placeholder="0"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="max-score">Max Score</Label>
                  <Input
                    id="max-score"
                    type="number"
                    placeholder="100"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {leaderboard.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((entry, index) => (
                    <TableRow key={entry.studentId || index}>
                      <TableCell>
                        <Badge 
                          variant={entry.student_rank === 1 ? "default" : entry.student_rank === 2 ? "secondary" : entry.student_rank === 3 ? "outline" : "outline"}
                          className={entry.student_rank === 1 ? "bg-yellow-500" : entry.student_rank === 2 ? "bg-gray-400" : entry.student_rank === 3 ? "bg-orange-600" : ""}
                        >
                          #{entry.student_rank}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{entry.studentName}</TableCell>
                      <TableCell className="text-right font-bold">{entry.totalScore}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No students found matching your criteria
              </div>
            )}
          </CardContent>
          <div className="p-4 flex justify-end gap-2">
            <Button onClick={() => handleExport('csv', 'leaderboard')} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={() => handleExport('pdf', 'leaderboard')} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>
          </div>
        </Card>
      ) : selectedClassId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Leaderboard
            </CardTitle>
            <CardDescription>Top students in {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No leaderboard data available</p>
              <p className="text-sm mt-1">Students need to complete quizzes to appear on the leaderboard</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
