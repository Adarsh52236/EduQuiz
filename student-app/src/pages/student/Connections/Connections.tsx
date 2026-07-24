import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserPlus, MessageSquare, Check, X, Send, Zap, Users, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatar?: string;
  role: 'student' | 'teacher';
}

interface StudentConnection {
  id: string;
  studentId: string;
  connectedStudentId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  connectedStudentName?: string; // Added for display
  connectedStudentEmail?: string; // Added for display
}

interface Quiz {
  id: string;
  title: string;
  isPublished?: boolean;
}

const Connections = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Early return if no user (shouldn't happen due to ProtectedRoute, but safety check)
  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to view connections.</p>
        </div>
      </div>
    );
  }
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [connections, setConnections] = useState<StudentConnection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [selectedFriendForChallenge, setSelectedFriendForChallenge] = useState<UserProfile | null>(null);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizForChallenge, setSelectedQuizForChallenge] = useState<string>('');

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    console.log('[Connections] Fetching:', url, options?.method || 'GET');
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
        console.error('[Connections] Error response:', response.status, errorData);
      } catch (jsonError) {
        // If response is not JSON, use status text
        errorMessage = response.statusText || `HTTP ${response.status}`;
        console.error('[Connections] Error response (non-JSON):', response.status, errorMessage);
      }
      throw new Error(errorMessage);
    }
    try {
      return await response.json();
    } catch (jsonError) {
      // If response is not JSON, return empty object
      console.warn('[Connections] Response is not JSON:', url);
      return {};
    }
  };

  const loadConnectionsAndStudents = async () => {
    if (!user) return;
    console.log('[Connections] Loading connections for user:', user.id);
    setIsLoading(true);
    try {
      // Fetch current user's connections
      console.log('[Connections] Fetching connections...');
      const connectionsData: StudentConnection[] = await fetchWithAuth('/api/connections');
      console.log('[Connections] Connections data:', connectionsData);
      setConnections(Array.isArray(connectionsData) ? connectionsData : []);

      // Fetch students from same classes only
      console.log('[Connections] Fetching enrollments...');
      const myEnrollments = await fetchWithAuth('/api/enrollments');
      const myClassIds = myEnrollments
        .filter((e: any) => e.studentId === user.id)
        .map((e: any) => e.classId);
      
      console.log('[Connections] My classes:', myClassIds);

      // Get all students from my classes
      const classmates = new Map<string, UserProfile>();
      for (const classId of myClassIds) {
        const classEnrollments = await fetchWithAuth(`/api/enrollments?classId=${classId}`);
        for (const enrollment of classEnrollments) {
          if (enrollment.studentId !== user.id && enrollment.studentName) {
            classmates.set(enrollment.studentId, {
              id: enrollment.studentId,
              displayName: enrollment.studentName,
              email: enrollment.studentEmail || '',
              role: 'student'
            });
          }
        }
      }

      const allClassmates = Array.from(classmates.values());
      console.log('[Connections] Classmates found:', allClassmates.length);

      // Filter out students who are already connected or have pending requests
      const connectedOrPendingIds = new Set(
        (Array.isArray(connectionsData) ? connectionsData : []).flatMap((c) => [c.studentId, c.connectedStudentId])
      );
      const discoverableStudents = allClassmates.filter(
        (s) => !connectedOrPendingIds.has(s.id)
      );
      console.log('[Connections] Discoverable students:', discoverableStudents.length);
      setAllStudents(discoverableStudents);

    } catch (error: any) {
      console.error('[Connections] Error loading connections:', error);
      const errorMessage = error?.message || 'Failed to load connections or students';
      toast.error(errorMessage);
      setConnections([]);
      setAllStudents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableQuizzes = async () => {
    try {
      console.log('[Connections] Fetching quizzes...');
      const quizzesData: Quiz[] = await fetchWithAuth('/api/quizzes');
      console.log('[Connections] Quizzes data:', quizzesData);
      setAvailableQuizzes((Array.isArray(quizzesData) ? quizzesData : []).filter(q => q.isPublished)); // Only published quizzes
    } catch (error: any) {
      console.error('[Connections] Error loading quizzes:', error);
      const errorMessage = error?.message || 'Failed to load available quizzes';
      toast.error(errorMessage);
      setAvailableQuizzes([]);
    }
  };

  const handleSendConnectionRequest = async (connectedStudentId: string) => {
    try {
      await fetchWithAuth('/api/connections', {
        method: 'POST',
        body: JSON.stringify({ connectedStudentId }),
      });
      toast.success('Connection request sent!');
      loadConnectionsAndStudents(); // Refresh lists
    } catch (error: any) {
      toast.error(error.message || 'Failed to send connection request');
    }
  };

  const handleUpdateConnectionRequest = async (connectionId: string, status: 'accepted' | 'rejected') => {
    try {
      await fetchWithAuth(`/api/connections/${connectionId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      toast.success(`Connection request ${status}!`);
      loadConnectionsAndStudents(); // Refresh lists
    } catch (error: any) {
      toast.error(error.message || `Failed to ${status} connection request`);
    }
  };

  const handleSendChallenge = async () => {
    if (!selectedFriendForChallenge || !selectedQuizForChallenge) {
      toast.error('Please select a friend and a quiz.');
      return;
    }
    try {
      await fetchWithAuth('/api/connections/challenge', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: selectedFriendForChallenge.id,
          quizId: selectedQuizForChallenge,
        }),
      });
      toast.success('Challenge sent!');
      setShowChallengeDialog(false);
      setSelectedFriendForChallenge(null);
      setSelectedQuizForChallenge('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send challenge');
    }
  };

  useEffect(() => {
    if (user) {
      loadConnectionsAndStudents();
      loadAvailableQuizzes();
    }
  }, [user]);

  const filteredStudents = allStudents.filter(student =>
    student.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get pending requests where current user is the recipient
  const pendingRequests = connections.filter(c => c.status === 'pending' && c.connectedStudentId === user?.id);
  // Get all accepted connections (bidirectional - both sent and received)
  const acceptedConnections = connections.filter(c => c.status === 'accepted');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading connections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Connections</h2>
        <p className="text-muted-foreground">Find and connect with your peers, challenge friends, and grow together.</p>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-orange-500" />
              Pending Connection Requests
            </CardTitle>
            <CardDescription>Review and respond to connection requests from other students</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map(request => (
              <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {(request.connectedStudentName || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{request.connectedStudentName || 'Unknown Student'}</p>
                    <p className="text-sm text-muted-foreground">{request.connectedStudentEmail || 'No email'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleUpdateConnectionRequest(request.id, 'accepted')} className="bg-green-600 hover:bg-green-700">
                    <Check className="h-4 w-4 mr-1" /> Accept
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleUpdateConnectionRequest(request.id, 'rejected')}>
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* My Connections */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-500" />
            My Friends
          </CardTitle>
          <CardDescription>Students you are connected with - challenge them to quizzes!</CardDescription>
        </CardHeader>
        <CardContent>
          {acceptedConnections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserPlus className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No connections yet</p>
              <p className="text-sm mt-1">Start connecting with other students to see them here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {acceptedConnections.map(conn => (
                <Card key={conn.id} className="text-center hover:shadow-md transition-shadow border-2 hover:border-primary/50">
                  <CardContent className="p-6">
                    <Avatar className="w-20 h-20 mx-auto mb-4 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xl">
                        {(conn.connectedStudentName || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-lg font-semibold mb-1">{conn.connectedStudentName || 'Unknown Student'}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-1">{conn.connectedStudentEmail || 'No email'}</p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => navigate(`/student/profile/${conn.connectedStudentId}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedFriendForChallenge({ id: conn.connectedStudentId, displayName: conn.connectedStudentName || 'Unknown Student', email: conn.connectedStudentEmail || '', role: 'student' });
                          setShowChallengeDialog(true);
                        }}
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Challenge
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discover Students */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Discover Students
          </CardTitle>
          <CardDescription>Find and connect with other students in your classes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full max-w-lg mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name or email..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No students found</p>
              <p className="text-sm mt-1">Try adjusting your search or check back later</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredStudents.map(student => (
                <Card key={student.id} className="text-center hover:shadow-md transition-shadow border-2 hover:border-primary/50">
                  <CardContent className="p-6">
                    <Avatar className="w-20 h-20 mx-auto mb-4 border-2 border-primary/20">
                      <AvatarImage src={student.avatar} alt={student.displayName} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xl">
                        {student.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-lg font-semibold mb-1">{student.displayName}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-1">{student.email}</p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        size="sm" 
                        className="flex-1"
                        onClick={() => navigate(`/student/profile/${student.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" /> 
                        View
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleSendConnectionRequest(student.id)}
                      >
                        <UserPlus className="h-4 w-4 mr-1" /> 
                        Connect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Challenge Dialog */}
      <Dialog open={showChallengeDialog} onOpenChange={setShowChallengeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Challenge {selectedFriendForChallenge?.displayName}
            </DialogTitle>
            <DialogDescription>Select a quiz to challenge your friend to a head-to-head competition</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quiz-select">Select Quiz</Label>
              <Select value={selectedQuizForChallenge} onValueChange={setSelectedQuizForChallenge}>
                <SelectTrigger id="quiz-select">
                  <SelectValue placeholder="Choose a quiz to challenge with" />
                </SelectTrigger>
                <SelectContent>
                  {availableQuizzes.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No available quizzes</div>
                  ) : (
                    availableQuizzes.map(quiz => (
                      <SelectItem key={quiz.id} value={quiz.id}>{quiz.title}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleSendChallenge} 
              className="w-full" 
              disabled={!selectedQuizForChallenge || availableQuizzes.length === 0}
            >
              <Zap className="h-4 w-4 mr-2" /> 
              Send Challenge
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Connections;