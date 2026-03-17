import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Search, UserPlus, Check, X } from 'lucide-react';
import { User, StudentConnection } from '@/types';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export function StudentConnections() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<StudentConnection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadConnections();
  }, [user]);

  const loadConnections = async () => {
    if (!user) return;
    try {
      // Get accepted connections
      const acceptedConnectionsResponse = await fetch(`/api/connections?studentId=${user.id}&status=accepted`);
      const acceptedConnections: StudentConnection[] = await acceptedConnectionsResponse.json();

      // Get pending requests
      const pendingResponse = await fetch(`/api/connections?connectedStudentId=${user.id}&status=pending`);
      const pending: StudentConnection[] = await pendingResponse.json();

      // Fetch connected users details
      const connectedUserIds = acceptedConnections.map(c => c.connectedStudentId);
      let connectedUsers: User[] = [];
      if (connectedUserIds.length > 0) {
        const usersResponse = await fetch('/api/users'); // Assuming an /api/users endpoint to get all users
        const allUsers: User[] = await usersResponse.json();
        connectedUsers = allUsers.filter(u => connectedUserIds.includes(u.id));
      }

      setConnections(connectedUsers);
      setPendingRequests(pending);

    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!user || !searchQuery.trim()) return;

    try {
      const usersResponse = await fetch('/api/users');
      const allUsers: User[] = await usersResponse.json();

      // Filter by search query and exclude current user
      const results = allUsers.filter(u => 
        u.id !== user.id &&
        u.role === 'student' && // Only search for students
        (u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         u.email.toLowerCase().includes(searchQuery.toLowerCase()))
      );

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          connectedStudentId: targetUserId,
          status: 'pending',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send request');
      }
      toast.success('Connection request sent!');
      setSearchResults(searchResults.filter(u => u.id !== targetUserId));
    } catch (error: any) {
      console.error('Error sending request:', error);
      toast.error(error.message || 'Failed to send connection request');
    }
  };

  const handleAcceptRequest = async (connection: StudentConnection) => {
    try {
      const response = await fetch(`/api/connections/${connection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to accept request');
      }
      toast.success('Connection request accepted!');
      loadConnections();
    } catch (error: any) {
      console.error('Error accepting request:', error);
      toast.error(error.message || 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/connections/${connectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to reject request');
      }
      toast.success('Connection request rejected');
      loadConnections();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error(error.message || 'Failed to reject request');
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'S';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Connections</h2>
        <p className="text-muted-foreground">Connect with your classmates</p>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Requests ({pendingRequests.length})</CardTitle>
            <CardDescription>Review connection requests from other students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>S</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">Connection Request</p>
                      <p className="text-sm text-muted-foreground">Wants to connect</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAcceptRequest(request)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectRequest(request.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Students */}
      <Card>
        <CardHeader>
          <CardTitle>Find Classmates</CardTitle>
          <CardDescription>Search for students to connect with</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{getInitials(student.displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{student.displayName}</p>
                      <p className="text-sm text-muted-foreground">{student.email}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleSendRequest(student.id)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Connect
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Connections */}
      <Card>
        <CardHeader>
          <CardTitle>My Connections ({connections.length})</CardTitle>
          <CardDescription>Your connected classmates</CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No connections yet</p>
              <p className="text-sm text-muted-foreground mt-1">Search for classmates to get started</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {connections.map((connection) => (
                <div key={connection.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Avatar>
                    <AvatarFallback>{getInitials(connection.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{connection.displayName}</p>
                    <p className="text-sm text-muted-foreground">{connection.email}</p>
                  </div>
                  <Badge variant="secondary">Connected</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
