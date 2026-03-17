import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchWithAuth } from '../../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
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
import { ScrollArea } from '../../components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { User, TrendingUp, Clock, Award, Target } from 'lucide-react';

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
import { toast } from 'sonner';

interface StudentPerformance {
  studentId: string;
  overallPerformance: {
    quizzesTaken: number;
    totalAttempts: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    averageTimeSpent: number;
  };
  performanceOverTime: {
    labels: string[];
    scores: number[];
    attempts: number[];
  };
  subjectPerformance: {
    subject: string;
    quizzesTaken: number;
    averageScore: number;
    totalAttempts: number;
  }[];
  recentAttempts: {
    quizTitle: string;
    className: string;
    score: number;
    totalPoints: number;
    percentage: number;
    timeSpent: number;
    submittedAt: string;
    rank: number;
  }[];
  improvementTrend: {
    month: string;
    avgScore: number;
    attempts: number;
  }[];
}

export function StudentAnalytics() {
  const { user } = useAuth();
  const [performanceData, setPerformanceData] = useState<StudentPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadStudentPerformance();
    }
  }, [user]);

  const loadStudentPerformance = async () => {
    try {
      setIsLoading(true);
      const data = await fetchWithAuth(`/api/analytics/student-performance/${user?.id}`);
      setPerformanceData(data);
    } catch (error: any) {
      console.error('Error loading student performance:', error);
      toast.error(error.message || 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const performanceChartData = {
    labels: performanceData?.performanceOverTime.labels || [],
    datasets: [
      {
        label: 'Average Score',
        data: performanceData?.performanceOverTime.scores || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const subjectChartData = {
    labels: performanceData?.subjectPerformance.map(s => s.subject) || [],
    datasets: [
      {
        label: 'Average Score',
        data: performanceData?.subjectPerformance.map(s => s.averageScore) || [],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(168, 85, 247, 0.8)'
        ],
        borderRadius: 4
      }
    ]
  };

  const improvementChartData = {
    labels: performanceData?.improvementTrend.map(t => t.month) || [],
    datasets: [
      {
        label: 'Monthly Average Score',
        data: performanceData?.improvementTrend.map(t => t.avgScore) || [],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!performanceData || performanceData.overallPerformance.totalAttempts === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Performance Data Available</h3>
          <p className="text-muted-foreground">Complete some quizzes to see your performance analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Performance Analytics</h1>
        <Badge variant="outline" className="text-sm">
          Last updated: {new Date().toLocaleDateString()}
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quizzes Taken</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.overallPerformance.quizzesTaken}</div>
            <p className="text-xs text-muted-foreground">
              {performanceData.overallPerformance.totalAttempts} total attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(performanceData.overallPerformance.averageScore || 0)}%</div>
              <p className="text-xs text-muted-foreground">
                Range: {Math.round(performanceData.overallPerformance.lowestScore || 0)}% - {Math.round(performanceData.overallPerformance.highestScore || 0)}%
              </p>
            </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.overallPerformance.averageTimeSpent}m</div>
            <p className="text-xs text-muted-foreground">
              Per quiz attempt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Performance</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(performanceData.overallPerformance.highestScore)}%</div>
            <p className="text-xs text-muted-foreground">
              Highest score achieved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Over Time (Last 30 Days)</CardTitle>
            <CardDescription>Your daily average scores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Line data={performanceChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </CardContent>
        </Card>

        {/* Subject Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Subject</CardTitle>
            <CardDescription>Average scores across different subjects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Bar 
                data={subjectChartData} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      ticks: {
                        callback: function(value) {
                          return value + '%';
                        }
                      }
                    }
                  }
                }} 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Improvement Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Improvement Trend</CardTitle>
          <CardDescription>Your progress over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Line 
              data={improvementChartData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: 'top' as const,
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                      callback: function(value) {
                        return value + '%';
                      }
                    }
                  }
                }
              }} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent Attempts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Quiz Attempts</CardTitle>
          <CardDescription>Your latest quiz performances</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceData.recentAttempts.map((attempt, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{attempt.quizTitle}</TableCell>
                    <TableCell>{attempt.className}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={attempt.percentage >= 80 ? "default" : attempt.percentage >= 60 ? "secondary" : "destructive"}
                      >
                        {attempt.percentage}%
                      </Badge>
                    </TableCell>
                    <TableCell>{attempt.timeSpent} min</TableCell>
                    <TableCell>
                      <Badge variant="outline">#{attempt.rank}</Badge>
                    </TableCell>
                    <TableCell>{new Date(attempt.submittedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Subject Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Performance Breakdown</CardTitle>
          <CardDescription>Detailed performance by subject</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {performanceData.subjectPerformance.map((subject, index) => (
              <Card key={index} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{subject.subject}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Average Score:</span>
                    <span className="font-semibold">{subject.averageScore}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Quizzes Taken:</span>
                    <span className="font-semibold">{subject.quizzesTaken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Attempts:</span>
                    <span className="font-semibold">{subject.totalAttempts}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}