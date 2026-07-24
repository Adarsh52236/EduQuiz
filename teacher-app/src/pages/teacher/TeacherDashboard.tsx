import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, FileCheck, TrendingUp, Plus, ArrowUpRight, ArrowDownRight, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Quiz, QuizAttempt } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    totalClasses: 0,
    totalAttempts: 0,
    averageScore: 0
  });
  const [recentQuizzes, setRecentQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        const quizzesResponse = await fetch('/api/quizzes', { headers });
        const quizzes = await quizzesResponse.json();

        const classesResponse = await fetch('/api/classes', { headers });
        const classes = await classesResponse.json();

        const attemptsResponse = await fetch('/api/attempts', { headers });
        const attempts = await attemptsResponse.json();

        const teacherQuizIds = quizzes.map((q: Quiz) => q.id);
        const teacherAttempts = attempts.filter((a: QuizAttempt) => teacherQuizIds.includes(a.quizId));

        let totalPercentage = 0;
        let validAttempts = 0;
        teacherAttempts.forEach((a: QuizAttempt) => {
          if (a.totalPoints > 0 && a.score !== null) {
            totalPercentage += (a.score / a.totalPoints) * 100;
            validAttempts++;
          }
        });
        const avgScore = validAttempts > 0 ? totalPercentage / validAttempts : 0;

        setStats({
          totalQuizzes: quizzes.length,
          totalClasses: classes.length,
          totalAttempts: teacherAttempts.length,
          averageScore: Math.round(avgScore)
        });

        const sortedQuizzes = [...quizzes].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setRecentQuizzes(sortedQuizzes.slice(0, 5));

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-primary"></div>
          <span className="text-sm font-medium text-slate-500 tracking-wide uppercase">Initializing Workspace...</span>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: 'Active Curriculum',
      value: stats.totalQuizzes,
      icon: BookOpen,
      trend: '+12%',
      trendUp: true,
      subtext: 'vs last term'
    },
    {
      title: 'Active Cohorts',
      value: stats.totalClasses,
      icon: Users,
      trend: '+2',
      trendUp: true,
      subtext: 'new enrollments'
    },
    {
      title: 'Total Submissions',
      value: stats.totalAttempts,
      icon: FileCheck,
      trend: '+24%',
      trendUp: true,
      subtext: 'this week'
    },
    {
      title: 'Global Avg. Score',
      value: `${stats.averageScore}%`,
      icon: TrendingUp,
      trend: '-1.2%',
      trendUp: false,
      subtext: 'vs historical avg'
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Institutional Overview</h2>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, {user?.displayName}. Here's your high-level summary for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-200 text-slate-700 font-medium h-9">
            Export Report
          </Button>
          <Link to="/teacher/quizzes/new">
            <Button className="bg-primary hover:bg-primary/90 text-white font-medium h-9 shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> New Assessment
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i} className="border-slate-200 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </div>
                  <div className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${kpi.trendUp ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {kpi.trendUp ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                    {kpi.trend}
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{kpi.value}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-medium text-slate-600">{kpi.title}</p>
                    <span className="text-xs text-slate-400">({kpi.subtext})</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Recent Quizzes Grid */}
        <Card className="md:col-span-2 border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 py-4 px-6 rounded-t-xl">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">Recent Assessments</CardTitle>
              <CardDescription className="text-xs mt-0.5">Latest curriculum updates</CardDescription>
            </div>
            <Link to="/teacher/quizzes">
              <Button variant="ghost" size="sm" className="text-primary font-medium text-xs h-8">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentQuizzes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="bg-slate-50 p-4 rounded-full mb-3">
                  <BookOpen className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">No assessments found</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mb-4">You haven't created any curriculum content yet. Start building your first assessment to begin.</p>
                <Link to="/teacher/quizzes/new">
                  <Button size="sm" className="shadow-sm">Create Assessment</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentQuizzes.map((quiz) => (
                  <div key={quiz.id} className="flex items-center justify-between p-4 px-6 hover:bg-slate-50/80 transition-colors group">
                    <div className="flex-1 min-w-0 flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${Number(quiz.isPublished) > 0 ? 'bg-green-500' : 'bg-amber-400'}`} />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 truncate">{quiz.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="font-mono">{quiz.totalPoints} pts</span>
                          <span className="text-slate-300">•</span>
                          <span>{quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : 'Unknown Date'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${Number(quiz.isPublished) > 0 ? 'border-green-200 text-green-700 bg-green-50' : 'border-amber-200 text-amber-700 bg-amber-50'}`}>
                        {Number(quiz.isPublished) > 0 ? 'Published' : 'Draft'}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem asChild>
                            <Link to={`/teacher/quizzes/${quiz.id}`}>Edit Details</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:bg-red-50">Archive</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Center */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6 rounded-t-xl">
              <CardTitle className="text-base font-semibold text-slate-800">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Link to="/teacher/quizzes/new" className="block">
                <Button variant="outline" className="w-full justify-start h-10 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-sm">
                  <Plus className="mr-3 h-4 w-4 text-slate-400" /> Create Assessment
                </Button>
              </Link>
              <Link to="/teacher/classes/new" className="block">
                <Button variant="outline" className="w-full justify-start h-10 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-sm">
                  <Users className="mr-3 h-4 w-4 text-slate-400" /> Create Cohort
                </Button>
              </Link>
              <Link to="/teacher/analytics" className="block">
                <Button variant="outline" className="w-full justify-start h-10 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-sm">
                  <TrendingUp className="mr-3 h-4 w-4 text-slate-400" /> View Heatmaps
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          {/* Info Card */}
          <Card className="border-none shadow-sm rounded-xl bg-gradient-to-br from-primary to-blue-700 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardContent className="p-6 relative z-10">
              <h3 className="font-semibold text-lg mb-2">OmniBot AI Integration Active</h3>
              <p className="text-blue-100 text-sm mb-4 leading-relaxed">
                Automated grading and personalized hints are currently active for all published assessments.
              </p>
              <Button size="sm" variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none font-medium text-xs">
                Configure AI Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
