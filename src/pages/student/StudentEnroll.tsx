import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';

export default function StudentEnroll() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classCode, setClassCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleEnroll = async () => {
    if (!user) {
      toast.error('You must be logged in to enroll in a class.');
      return;
    }
    if (!classCode.trim()) {
      toast.error('Please enter a class code.');
      return;
    }

    setIsLoading(true);
    try {
      await fetchWithAuth('/api/enrollments/enroll-by-code', {
        method: 'POST',
        body: JSON.stringify({ classCode }),
      });
      toast.success('Successfully enrolled in the class!');
      navigate('/student/dashboard'); // Redirect to dashboard after enrollment
    } catch (error: any) {
      toast.error(error.message || 'Failed to enroll in class.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Users className="h-16 w-16 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl">Join a Classroom</CardTitle>
          <CardDescription>Enter the class code provided by your teacher to join.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="class-code">Class Code</Label>
            <Input
              id="class-code"
              placeholder="e.g., ABC123"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button onClick={handleEnroll} className="w-full" disabled={isLoading}>
            {isLoading ? 'Joining...' : 'Join Class'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
