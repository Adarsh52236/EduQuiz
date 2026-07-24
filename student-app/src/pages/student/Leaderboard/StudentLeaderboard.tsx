import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Trophy, Users } from 'lucide-react';

interface LeaderboardEntry {
  studentId: string;
  studentName: string;
  totalScore: number;
  rank: number;
}

interface Class {
  id: string;
  name: string;
}

export default function StudentLeaderboard() {
  const { user } = useAuth();
  const socket = useSocket();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);
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
    loadClasses();
  }, [user]);

  // Listen for real-time leaderboard updates
  useEffect(() => {
    if (!socket || !selectedClassId) return;

    const handleLeaderboardUpdate = (data: { classId: string; leaderboard: LeaderboardEntry[] }) => {
      if (data.classId === selectedClassId) {
        setLeaderboard(data.leaderboard.slice(0, 10)); // Update top 10
        
        // Update my rank if it exists in the new leaderboard
        const studentEntry = data.leaderboard.find(entry => entry.studentId === user?.id);
        setMyRank(studentEntry || null);
      }
    };

    socket.on('leaderboardUpdate', handleLeaderboardUpdate);

    return () => {
      socket.off('leaderboardUpdate', handleLeaderboardUpdate);
    };
  }, [socket, selectedClassId, user]);

  useEffect(() => {
    if (selectedClassId) {
      loadLeaderboard(selectedClassId);
    } else {
      setLeaderboard([]);
      setMyRank(null);
    }
  }, [selectedClassId, user]);

  const loadClasses = async () => {
    setIsLoading(true);
    try {
      const enrollments: { classId: string; className: string }[] = await fetchWithAuth('/api/enrollments');
      setClasses(enrollments.map(e => ({ id: e.classId, name: e.className })));
      if (enrollments.length > 0) {
        setSelectedClassId(enrollments[0].classId);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load classes.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeaderboard = async (classId: string) => {
    setIsLoading(true);
    try {
      const data: LeaderboardEntry[] = await fetchWithAuth(`/api/leaderboards/${classId}`);
      setLeaderboard(data.slice(0, 10)); // Display top 10

      const studentEntry = data.find(entry => entry.studentId === user?.id);
      setMyRank(studentEntry || null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load leaderboard.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && classes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <Card className="py-12 text-center">
        <CardContent>
          <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">You haven't joined any classroom yet.</h3>
          <p className="text-muted-foreground mb-4">Join a class to see its leaderboard.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Class Leaderboard</h2>
        <p className="text-muted-foreground">See how you rank among your peers</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Class</CardTitle>
          <CardDescription>Choose a class to view its leaderboard</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedClassId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Top 10 Students
            </CardTitle>
            <CardDescription>Leaderboard for {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No students on the leaderboard yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Rank</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-right">Total Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((entry) => (
                    <TableRow key={entry.studentId} className={entry.studentId === user?.id ? 'bg-yellow-50/50' : ''}>
                      <TableCell className="font-medium">{entry.rank}</TableCell>
                      <TableCell>{entry.studentName}</TableCell>
                      <TableCell className="text-right">{entry.totalScore}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {selectedClassId && myRank && (
        <Card>
          <CardHeader>
            <CardTitle>My Performance</CardTitle>
            <CardDescription>Your current standing in {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow className="bg-blue-50/50">
                  <TableCell className="font-medium">Your Rank</TableCell>
                  <TableCell>{myRank.rank}</TableCell>
                </TableRow>
                <TableRow className="bg-blue-50/50">
                  <TableCell className="font-medium">Your Score</TableCell>
                  <TableCell>{myRank.totalScore}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
