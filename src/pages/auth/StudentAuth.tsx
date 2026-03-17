import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentAuth() {
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin'); // New state for active tab

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
    
    // Enhanced validation
    const trimmedName = signUpData.displayName.trim();
    const trimmedEmail = signUpData.email.trim();
    
    if (!trimmedName) {
      toast.error('Please enter your full name');
      return;
    }
    if (trimmedName.length < 2) {
      toast.error('Full name must be at least 2 characters long');
      return;
    }
    if (trimmedName.length > 50) {
      toast.error('Full name is too long (max 50 characters)');
      return;
    }
    
    if (!trimmedEmail) {
      toast.error('Please enter your email');
      return;
    }
    
    // Email format validation
    const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    if (signUpData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (signUpData.password.length > 128) {
      toast.error('Password is too long (max 128 characters)');
      return;
    }
    if (signUpData.password !== signUpData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      console.log('=== Student Signup ===');
      console.log('Email:', trimmedEmail);
      console.log('Display Name:', trimmedName);
      console.log('Role: student');
      
      await signUp(trimmedEmail, signUpData.password, 'student', trimmedName);
      
      toast.success('Account created successfully! Please sign in.');
      setActiveTab('signin'); // Switch to sign-in tab
      setSignUpData({
        email: '',
        password: '',
        displayName: '',
        confirmPassword: ''
      }); // Clear signup form
    } catch (error: any) {
      console.error('Signup error:', error);
      // Provide more user-friendly error messages
      if (error.message.includes('already exists')) {
        toast.error('An account with this email already exists. Please sign in instead.');
      } else if (error.message.includes('too long')) {
        toast.error('Some fields contain too many characters. Please shorten them.');
      } else {
        toast.error(error.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced validation
    const trimmedEmail = signInData.email.trim();
    
    if (!trimmedEmail) {
      toast.error('Please enter your email');
      return;
    }
    
    // Email format validation
    const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    if (!signInData.password) {
      toast.error('Please enter your password');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('Starting student signin process...');
      await signIn(trimmedEmail, signInData.password, 'student');
      toast.success('Welcome back! Redirecting...');
      setTimeout(() => navigate('/student/dashboard'), 1000);
    } catch (error: any) {
      console.error('Signin error:', error);
      // Enhanced error handling for role-based login restrictions
      if (error.message && error.message.includes('registered as a')) {
        // Extract role information from backend error message
        const roleMatch = error.message.match(/registered as a '([^']+)'/);
        const attemptedRole = error.message.match(/attempted to log in as a '([^']+)'/);
        
        if (roleMatch && roleMatch[1] === 'teacher') {
          toast.error(
            <div>
              <div className="font-semibold mb-1">Wrong Portal!</div>
              <div>This account is registered as a Teacher.</div>
              <div className="text-sm mt-1">Please use the Teacher Portal instead.</div>
            </div>,
            { duration: 5000 }
          );
        } else {
          toast.error(error.message, { duration: 5000 });
        }
      } else if (error.message && error.message.includes('already exists')) {
        toast.error('An account with this email already exists. Please sign in instead.');
      } else if (error.message && error.message.includes('Invalid email or password')) {
        toast.error('Invalid email or password. Please check your credentials.');
      } else {
        toast.error(error.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-center gap-2 text-green-800">
              <BookOpen className="h-5 w-5" />
              <span className="font-medium">Student Portal</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              For students and learners only
            </p>
          </div>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Student Portal</CardTitle>
          <CardDescription>Sign in or create your student account</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="student@example.com"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Jane Smith"
                    value={signUpData.displayName}
                    onChange={(e) => setSignUpData({ ...signUpData, displayName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="student@example.com"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirm Password</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
                      Creating account...
                    </>
                  ) : (
                    'Create Student Account'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
