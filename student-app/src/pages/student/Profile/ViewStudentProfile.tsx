import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, BookOpen, User, ArrowLeft, Loader2, UserPlus, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function ViewStudentProfile() {
  const { studentId } = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'accepted'>('none');

  useEffect(() => {
    if (user && studentId) {
      loadProfile();
    }
  }, [user, studentId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Get the specific student profile
      const userResponse = await fetch(`/api/users/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!userResponse.ok) {
        if (userResponse.status === 404) {
          throw new Error('Student not found');
        }
        throw new Error('Failed to fetch student profile');
      }
      
      const studentProfile = await userResponse.json();
      
      if (studentProfile.role !== 'student') {
        throw new Error('User is not a student');
      }
      
      setProfile(studentProfile);

      // Get student stats
      const attemptsResponse = await fetch(`/api/attempts?studentId=${studentId}&isCompleted=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (attemptsResponse.ok) {
        const attempts = await attemptsResponse.json();
        
        const totalQuizzes = attempts.length;
        const totalScore = attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0);
        const totalPossiblePoints = attempts.reduce((sum: number, a: any) => sum + (a.totalPoints || 0), 0);
        const averageScore = totalPossiblePoints > 0 
          ? Math.round((totalScore / totalPossiblePoints) * 100)
          : 0;

        setStats({
          totalQuizzes,
          averageScore,
          rank: averageScore >= 90 ? 'Excellent' : averageScore >= 70 ? 'Good' : averageScore >= 50 ? 'Average' : 'Needs Improvement'
        });

        // Get recent attempts with quiz titles (last 5)
        const attemptsWithQuizzes = await Promise.all(
          attempts.slice(0, 5).map(async (attempt: any) => {
            try {
              const quizResponse = await fetch(`/api/quizzes/${attempt.quizId}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              if (quizResponse.ok) {
                const quiz = await quizResponse.json();
                return { ...attempt, quizTitle: quiz.title };
              }
              return { ...attempt, quizTitle: 'Unknown Quiz' };
            } catch {
              return { ...attempt, quizTitle: 'Unknown Quiz' };
            }
          })
        );
        
        const sorted = attemptsWithQuizzes
          .sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        
        setRecentAttempts(sorted);
      }

      // Check connection status
      if (user && studentId !== user.id) {
        try {
          const connectionsResponse = await fetch('/api/connections', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (connectionsResponse.ok) {
            const connections = await connectionsResponse.json();
            const connection = connections.find((c: any) => 
              (c.studentId === user.id && c.connectedStudentId === studentId) ||
              (c.studentId === studentId && c.connectedStudentId === user.id)
            );
            
            if (connection) {
              setIsConnected(connection.status === 'accepted');
              setConnectionStatus(connection.status);
            } else {
              setIsConnected(false);
              setConnectionStatus('none');
            }
          }
        } catch (error) {
          console.error('Error checking connection status:', error);
        }
      }
    } catch (error: any) {
      console.error('[ViewStudentProfile] Error:', error);
      toast.error(error.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendConnectionRequest = async () => {
    if (!user || !studentId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ connectedStudentId: studentId })
      });

      if (response.ok) {
        toast.success('Connection request sent!');
        setConnectionStatus('pending');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send connection request');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send connection request');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <Button onClick={() => navigate('/student/connections')}>Back to Connections</Button>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/student/connections')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Student Profile</h1>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <Avatar className="h-32 w-32">
              <AvatarImage src={profile.avatar} alt={profile.displayName} />
              <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                {getInitials(profile.displayName)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-bold">{profile.displayName}</h2>
              <div className="flex items-center gap-2 justify-center md:justify-start mt-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-muted-foreground text-lg">{profile.email}</p>
              </div>
              {profile.bio && <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{profile.bio}</p>}
              <div className="flex gap-2 mt-4 justify-center md:justify-start">
                <Badge variant="secondary">Student</Badge>
                {stats && <Badge>{stats.rank}</Badge>}
                {connectionStatus === 'accepted' && <Badge variant="default">Connected</Badge>}
                {connectionStatus === 'pending' && <Badge variant="outline">Request Pending</Badge>}
              </div>
              {user && studentId !== user.id && connectionStatus === 'none' && (
                <Button 
                  onClick={handleSendConnectionRequest} 
                  className="mt-4"
                  size="sm"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Send Connection Request
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quizzes Completed</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalQuizzes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.averageScore}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.rank}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Attempts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Quiz Attempts</CardTitle>
          <CardDescription>Latest quiz submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAttempts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAttempts.map((attempt: any) => {
                  const percentage = Math.round((attempt.score / attempt.totalPoints) * 100);
                  return (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-medium">{attempt.quizTitle}</TableCell>
                      <TableCell>
                        <Badge variant={percentage >= 80 ? 'default' : percentage >= 60 ? 'secondary' : 'destructive'}>
                          {percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(attempt.submittedAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No quiz attempts yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
