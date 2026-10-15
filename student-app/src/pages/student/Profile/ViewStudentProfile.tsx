import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Award, BookOpen, User, ArrowLeft, Loader2, UserPlus, Mail, Trophy, Zap, Swords, Flame, Shield } from 'lucide-react';
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
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [isSendingChallenge, setIsSendingChallenge] = useState(false);

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

  const loadAvailableQuizzes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/quizzes', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const quizzes = await response.json();
        setAvailableQuizzes(quizzes || []);
        if (quizzes.length > 0) {
          setSelectedQuizId(quizzes[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load quizzes for challenge:', err);
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

  const handleOpenChallenge = () => {
    loadAvailableQuizzes();
    setShowChallengeDialog(true);
  };

  const handleSendChallenge = async () => {
    if (!selectedQuizId || !studentId) {
      toast.error('Please select a quiz to challenge');
      return;
    }

    setIsSendingChallenge(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/connections/challenge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          challengedStudentId: studentId,
          quizId: selectedQuizId
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to dispatch 1v1 challenge');
      }

      toast.success(`⚔️ 1v1 Challenge dispatched to ${profile.displayName}!`);
      setShowChallengeDialog(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to issue challenge');
    } finally {
      setIsSendingChallenge(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading student profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <p className="text-muted-foreground">Student profile not found or unavailable.</p>
        <Button onClick={() => navigate('/student/connections')}>Back to Connections</Button>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const elo = profile.eloRating || 1200;
  const xp = profile.globalXp || 0;

  const getEloTier = (rating: number) => {
    if (rating >= 1800) return { name: 'Grandmaster', color: 'text-red-400 border-red-500/30 bg-red-500/10' };
    if (rating >= 1600) return { name: 'Master', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' };
    if (rating >= 1400) return { name: 'Diamond', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' };
    if (rating >= 1200) return { name: 'Gold', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
    if (rating >= 1000) return { name: 'Silver', color: 'text-slate-300 border-slate-500/30 bg-slate-500/10' };
    return { name: 'Bronze', color: 'text-amber-600 border-amber-600/30 bg-amber-600/10' };
  };

  const tier = getEloTier(elo);

  return (
    <div className="space-y-6 w-full pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/student/connections')} className="hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Student Profile
            <Badge variant="outline" className={`text-xs ${tier.color}`}>
              {tier.name} Tier
            </Badge>
          </h1>
          <p className="text-xs text-slate-400">Competitive LeetCode & Arena Record</p>
        </div>
      </div>

      {/* Profile Header Card */}
      <Card className="bg-[#12131a] border-slate-800/80 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-80 h-32 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <Avatar className="h-28 w-28 border-2 border-primary/30 shadow-lg">
              <AvatarImage src={profile.avatar} alt={profile.displayName} />
              <AvatarFallback className="text-2xl bg-primary/20 text-primary font-bold">
                {getInitials(profile.displayName)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <h2 className="text-2xl font-bold text-white">{profile.displayName}</h2>
                <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700">
                  Student
                </Badge>
                {connectionStatus === 'accepted' && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Friends List
                  </Badge>
                )}
                {connectionStatus === 'pending' && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                    Request Pending
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 justify-center md:justify-start mt-1 text-slate-400 text-sm">
                <Mail className="h-3.5 w-3.5" />
                <span>{profile.email}</span>
              </div>

              {profile.bio && (
                <p className="mt-2 text-sm text-slate-300 max-w-2xl">{profile.bio}</p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mt-5 justify-center md:justify-start">
                {user && studentId !== user.id && connectionStatus === 'none' && (
                  <Button 
                    onClick={handleSendConnectionRequest} 
                    className="bg-primary hover:bg-primary/90 text-white"
                    size="sm"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Friend
                  </Button>
                )}

                {user && studentId !== user.id && connectionStatus === 'accepted' && (
                  <Button 
                    onClick={handleOpenChallenge} 
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-orange-500/20"
                    size="sm"
                  >
                    <Swords className="h-4 w-4 mr-2" />
                    Challenge to 1v1 Battle
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Competitive Box */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center min-w-[180px]">
              <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Competitive ELO</div>
              <div className="text-3xl font-black text-amber-400 tracking-tight flex items-center justify-center gap-1">
                <Trophy className="h-6 w-6 text-amber-400" />
                {elo}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                {xp} Total XP
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-[#12131a] border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-400">Competitive ELO</CardTitle>
            <Trophy className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{elo}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{tier.name} League</p>
          </CardContent>
        </Card>

        <Card className="bg-[#12131a] border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-400">Platform XP</CardTitle>
            <Zap className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{xp}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Global Score</p>
          </CardContent>
        </Card>

        <Card className="bg-[#12131a] border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-400">Quizzes Taken</CardTitle>
            <BookOpen className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats?.totalQuizzes || 0}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Completed Exms</p>
          </CardContent>
        </Card>

        <Card className="bg-[#12131a] border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-400">Accuracy</CardTitle>
            <Award className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats?.averageScore || 0}%</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Avg Quiz Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Attempts */}
      <Card className="bg-[#12131a] border-slate-800">
        <CardHeader>
          <CardTitle className="text-base text-white">Recent Quiz Attempts</CardTitle>
          <CardDescription className="text-xs text-slate-400">Latest class tests and platform submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAttempts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Quiz Title</TableHead>
                  <TableHead className="text-slate-400">Score</TableHead>
                  <TableHead className="text-slate-400">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAttempts.map((attempt: any) => {
                  const percentage = Math.round((attempt.score / attempt.totalPoints) * 100);
                  return (
                    <TableRow key={attempt.id} className="border-slate-800/60">
                      <TableCell className="font-medium text-slate-200">{attempt.quizTitle}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={percentage >= 80 ? 'text-emerald-400 border-emerald-500/30' : percentage >= 60 ? 'text-amber-400 border-amber-500/30' : 'text-red-400 border-red-500/30'}>
                          {percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs">{new Date(attempt.submittedAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">No quiz attempts recorded yet.</div>
          )}
        </CardContent>
      </Card>

      {/* 1v1 Challenge Modal */}
      <Dialog open={showChallengeDialog} onOpenChange={setShowChallengeDialog}>
        <DialogContent className="bg-[#12131a] border-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Swords className="h-5 w-5 text-amber-400" />
              Challenge {profile.displayName} to 1v1 Arena
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Only friends on your list can be challenged (Clash of Clans rule). Pick a quiz to face off.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs text-slate-300">Select Quiz Arena</Label>
              {availableQuizzes.length === 0 ? (
                <div className="p-3 text-center border border-dashed border-amber-500/20 bg-amber-500/5 rounded-lg">
                  <p className="text-xs font-semibold text-amber-400">No quizzes available until now.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Quizzes will appear here once your teacher publishes them.</p>
                </div>
              ) : (
                <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue placeholder="Choose a challenge quiz" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {availableQuizzes.map((quiz) => (
                      <SelectItem key={quiz.id} value={quiz.id} className="text-slate-200 focus:bg-slate-800 focus:text-white">
                        {quiz.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button 
              onClick={handleSendChallenge} 
              disabled={isSendingChallenge || !selectedQuizId}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
            >
              {isSendingChallenge ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Swords className="h-4 w-4 mr-2" />}
              Dispatch 1v1 Battle Invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
