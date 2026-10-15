import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, GraduationCap, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AutoEnroll() {
  const { classCode } = useParams<{ classCode: string }>();
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'enrolling' | 'success' | 'redirecting'>('checking');
  const [className, setClassName] = useState<string>('');

  useEffect(() => {
    if (isLoading) return;

    if (!classCode) {
      toast.error('Invalid class invitation link');
      navigate('/');
      return;
    }

    const cleanCode = classCode.trim().toUpperCase();

    if (!isAuthenticated) {
      // Store pending code and direct to registration / sign-in
      sessionStorage.setItem('pendingClassEnroll', cleanCode);
      toast.info(`Please sign in or create an account to join class: ${cleanCode}`);
      navigate(`/auth/student/sign-up?code=${cleanCode}`);
      return;
    }

    if (user?.role !== 'student') {
      toast.error('Only students can enroll in classes');
      navigate('/');
      return;
    }

    // Student is authenticated: Auto-enroll via API
    const performAutoEnroll = async () => {
      setStatus('enrolling');
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/enrollments/enroll-by-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ classCode: cleanCode })
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setClassName(data.className || `Class ${cleanCode}`);
          toast.success(`🎉 Successfully enrolled in class!`);
          sessionStorage.removeItem('pendingClassEnroll');
          setTimeout(() => navigate('/student/dashboard'), 1500);
        } else if (response.status === 409) {
          // Already enrolled
          toast.info('You are already enrolled in this class');
          sessionStorage.removeItem('pendingClassEnroll');
          navigate('/student/dashboard');
        } else {
          toast.error(data.message || 'Failed to auto-enroll');
          sessionStorage.removeItem('pendingClassEnroll');
          navigate('/student/dashboard');
        }
      } catch (error: any) {
        console.error('Auto-enroll error:', error);
        toast.error('Network error during auto-enrollment');
        navigate('/student/dashboard');
      }
    };

    performAutoEnroll();
  }, [classCode, isAuthenticated, isLoading, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-[max(1cm,1.5rem)]">
      <div className="max-w-md w-full p-8 rounded-2xl bg-card border border-border/40 shadow-2xl text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
          <GraduationCap className="h-8 w-8" />
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight">Class Invitation</h2>
          <p className="text-muted-foreground mt-1">Code: <span className="font-mono font-semibold text-primary">{classCode?.toUpperCase()}</span></p>
        </div>

        {status === 'enrolling' || status === 'checking' ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground animate-pulse">Auto-enrolling into class...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 space-y-3 text-green-400">
            <CheckCircle2 className="h-10 w-10 animate-bounce" />
            <p className="font-semibold text-lg">Enrolled Successfully!</p>
            <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
            <Button onClick={() => navigate('/student/dashboard')} className="mt-4">
              Enter Classroom <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
