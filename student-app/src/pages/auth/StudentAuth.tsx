import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Swords, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code') || sessionStorage.getItem('pendingClassEnroll');
    if (code) {
      const clean = code.trim().toUpperCase();
      setInviteCode(clean);
      sessionStorage.setItem('pendingClassEnroll', clean);
      setActiveTab('signup');
    }
  }, [searchParams]);

  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    displayName: '',
    confirmPassword: ''
  });

  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = signUpData.displayName.trim();
    const trimmedEmail = signUpData.email.trim();
    
    if (!trimmedName || trimmedName.length < 2) {
      toast.error('Full name must be at least 2 characters long');
      return;
    }
    const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(signUpData.password)) {
      toast.error('Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number.');
      return;
    }
    if (signUpData.password !== signUpData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(trimmedEmail, signUpData.password, 'student', trimmedName);
      
      // Auto-authenticate immediately to complete onboarding
      await signIn(trimmedEmail, signUpData.password, 'student');

      const pendingCode = inviteCode || sessionStorage.getItem('pendingClassEnroll');
      if (pendingCode) {
        try {
          const token = localStorage.getItem('token');
          await fetch('/api/enrollments/enroll-by-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ classCode: pendingCode })
          });
          toast.success(`🎉 Account registered and auto-enrolled in class ${pendingCode}!`);
          sessionStorage.removeItem('pendingClassEnroll');
        } catch (enrollErr) {
          console.error(enrollErr);
          toast.success('Account created successfully! Welcome to EduQuiz.');
        }
      } else {
        toast.success('Account created successfully! Welcome to EduQuiz.');
      }
      navigate('/student/dashboard');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        toast.error('An account with this email already exists. Please sign in instead.');
        setActiveTab('signin');
      } else {
        toast.error(error.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = signInData.email.trim();
    if (!trimmedEmail || !signInData.password) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    try {
      await signIn(trimmedEmail, signInData.password, 'student');

      const pendingCode = inviteCode || sessionStorage.getItem('pendingClassEnroll');
      if (pendingCode) {
        try {
          const token = localStorage.getItem('token');
          await fetch('/api/enrollments/enroll-by-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ classCode: pendingCode })
          });
          toast.success(`🎉 Welcome! You have been auto-enrolled in class ${pendingCode}!`);
          sessionStorage.removeItem('pendingClassEnroll');
        } catch (enrollErr) {
          console.error(enrollErr);
        }
      } else {
        toast.success('Welcome back to EduQuiz!');
      }

      setTimeout(() => navigate('/student/dashboard'), 800);
    } catch (error: any) {
      toast.error('Sign in failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md z-10 px-[max(1cm,1.5rem)]">
        <div className="flex justify-center mb-6">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-primary/20 p-3 rounded-xl group-hover:bg-primary/30 transition-colors">
              <Swords className="h-8 w-8 text-primary" />
            </div>
            <span className="text-3xl font-bold tracking-tight">EduQuiz</span>
          </Link>
        </div>

        {inviteCode && (
          <div className="mb-4 p-3.5 bg-primary/20 border border-primary/40 rounded-xl flex items-center gap-3 text-sm text-foreground shadow-lg">
            <div className="bg-primary/30 p-2 rounded-lg text-primary flex-shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">Class Invitation Detected</p>
              <p className="text-xs text-muted-foreground">Class code: <span className="font-mono text-primary font-bold">{inviteCode}</span>. Complete sign-in to join automatically!</p>
            </div>
          </div>
        )}

        <Card className="w-full bg-card/50 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold">Student Portal</CardTitle>
            <CardDescription className="text-muted-foreground">Sign in to access your Practice Hub</CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8 bg-black/40">
                <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="player1@school.edu"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      required
                      className="bg-black/20 border-white/10 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="signin-password">Password</Label>
                      <Link to="/auth/student/forgot-password" className="text-xs text-primary hover:underline">
                        Forgot Password?
                      </Link>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                      className="bg-black/20 border-white/10 focus:border-primary"
                    />
                  </div>
                  <Button type="submit" className="w-full h-12 text-lg bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
                    {isLoading ? 'Authenticating...' : 'Enter Arena'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Display Name (Gamer Tag)</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="e.g. CodeMaster99"
                      value={signUpData.displayName}
                      onChange={(e) => setSignUpData({ ...signUpData, displayName: e.target.value })}
                      required
                      className="bg-black/20 border-white/10 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">School Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="player1@school.edu"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      required
                      className="bg-black/20 border-white/10 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password (Min 8 chars)</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                      className="bg-black/20 border-white/10 focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground">Must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                      required
                      className="bg-black/20 border-white/10 focus:border-primary"
                    />
                  </div>
                  <Button type="submit" className="w-full h-12 text-lg bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
                    {isLoading ? 'Creating Profile...' : 'Register Profile'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
