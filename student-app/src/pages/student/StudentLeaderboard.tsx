import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchWithAuth } from '../../lib/api';
import { User, Trophy, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface LeaderboardEntry {
  studentId: string;
  studentName: string;
  totalScore: number;
  student_rank: number;
  updatedAt?: string;
}

interface ClassStats {
  averageScore: number;
  maxScore: number;
  minScore: number;
}

interface QuizScore {
  quizTitle: string;
  score: number;
}

interface MyPerformanceData {
  myPerformance: {
    totalScore: number;
    student_rank: number;
  };
  quizScores: QuizScore[];
}

interface Class {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function StudentLeaderboard() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [classStats, setClassStats] = useState<ClassStats>({ averageScore: 0, maxScore: 0, minScore: 0 });
  const [myPerformance, setMyPerformance] = useState<MyPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    fetchUserData();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchLeaderboard();
      fetchMyPerformance();
    }
  }, [selectedClassId, searchTerm, minScore, maxScore, startDate, endDate, currentPage]);

  const fetchUserData = async () => {
    try {
      const response = await fetchWithAuth('/api/auth/me');
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await fetchWithAuth('/api/classes/student-classes');
      const data = await response.json();
      setClasses(data.classes || []);
      if (data.classes && data.classes.length > 0) {
        setSelectedClassId(data.classes[0].id);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setClasses([]);
    }
  };

  const fetchLeaderboard = async () => {
    if (!selectedClassId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(minScore && { minScore }),
        ...(maxScore && { maxScore }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      });

      const response = await fetchWithAuth(`/api/analytics/leaderboard/${selectedClassId}?${params}`);
      const data = await response.json();
      
      setLeaderboard(data.leaderboard || []);
      setClassStats(data.classStats || { averageScore: 0, maxScore: 0, minScore: 0 });
      setTotalStudents(data.totalStudents || 0);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
      setClassStats({ averageScore: 0, maxScore: 0, minScore: 0 });
      setTotalStudents(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyPerformance = async () => {
    if (!selectedClassId) return;
    
    try {
      const response = await fetchWithAuth(`/api/analytics/my-performance/${selectedClassId}`);
      const data = await response.json();
      setMyPerformance(data);
    } catch (error) {
      console.error('Error fetching my performance:', error);
      setMyPerformance(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Classes Available</CardTitle>
            <CardDescription>You are not enrolled in any classes yet.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Class Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Class Selection</CardTitle>
          <CardDescription>Choose a class to view the leaderboard</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Class Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Class Statistics
          </CardTitle>
          <CardDescription>Overall performance metrics for {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalStudents}</div>
              <div className="text-sm text-muted-foreground">Total Students</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{classStats.averageScore}</div>
              <div className="text-sm text-muted-foreground">Average Score</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{classStats.maxScore}</div>
              <div className="text-sm text-muted-foreground">Highest Score</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{classStats.minScore}</div>
              <div className="text-sm text-muted-foreground">Lowest Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Leaderboard
              </CardTitle>
              <CardDescription>Top students in {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label htmlFor="minScore">Min Score</Label>
                <Input
                  id="minScore"
                  type="number"
                  placeholder="0"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="maxScore">Max Score</Label>
                <Input
                  id="maxScore"
                  type="number"
                  placeholder="1000"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No students match your search criteria.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Rank</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="text-right">Total Score</TableHead>
                  <TableHead className="text-right">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry) => (
                  <TableRow key={entry.studentName} className={entry.studentId === user?.id ? 'bg-yellow-50/50' : ''}>
                    <TableCell className="font-medium">
                      <Badge variant={entry.student_rank <= 3 ? 'default' : 'secondary'}>
                        #{entry.student_rank}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.studentName}</TableCell>
                    <TableCell className="text-right font-medium">{entry.totalScore}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalStudents)} of {totalStudents} students
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm font-medium">
                Page {currentPage} of {Math.ceil(totalStudents / itemsPerPage)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage >= Math.ceil(totalStudents / itemsPerPage)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            My Performance
          </CardTitle>
          <CardDescription>Your individual stats in {classes.find(c => c.id === selectedClassId)?.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {myPerformance ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                  <span className="text-3xl font-bold">{myPerformance.myPerformance.totalScore}</span>
                  <span className="text-muted-foreground text-sm">Total Score</span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                  <span className="text-3xl font-bold">{myPerformance.myPerformance.student_rank}</span>
                  <span className="text-muted-foreground text-sm">Your Rank</span>
                </div>
              </div>

              <h4 className="font-semibold mt-4 mb-2">My Quiz Scores:</h4>
              {myPerformance.quizScores.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quiz</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myPerformance.quizScores.map((score, index) => (
                      <TableRow key={index}>
                        <TableCell>{score.quizTitle}</TableCell>
                        <TableCell className="text-right font-medium">{score.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No quiz scores available yet.</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">Performance data not available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}