import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Building2, CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherAuth() {
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');

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
    
    if (!trimmedName || trimmedName.length < 2) return toast.error('Valid full name required');
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) return toast.error('Invalid email address');
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(signUpData.password)) {
      return toast.error('Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number.');
    }
    if (signUpData.password !== signUpData.confirmPassword) return toast.error('Passwords do not match');

    setIsLoading(true);
    try {
      await signUp(trimmedEmail, signUpData.password, 'teacher', trimmedName);
      toast.success('Admin account provisioned successfully.');
      setActiveTab('signin');
      setSignUpData({ email: '', password: '', displayName: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Provisioning failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = signInData.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) return toast.error('Invalid email address');
    if (!signInData.password) return toast.error('Password required');
    
    setIsLoading(true);
    try {
      await signIn(trimmedEmail, signInData.password, 'teacher');
      toast.success('Authentication successful. Initializing dashboard...');
      setTimeout(() => navigate('/teacher/dashboard'), 1000);
    } catch (error: any) {
      toast.error('Authentication failed. Verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      
      {/* LEFT SIDE: Enterprise Branding */}
      <div className="hidden md:flex md:w-1/2 bg-slate-950 p-12 flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
            <polygon fill="currentColor" points="100,0 100,100 0,100" className="text-primary" />
          </svg>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white mb-16">
            <div className="bg-primary p-2 rounded-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">EduQuiz <span className="font-light text-slate-400">Enterprise</span></span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-semibold text-white leading-tight mb-6">
            Secure administrative control over your institution.
          </h1>
          <p className="text-slate-400 text-lg mb-12 max-w-md">
            Manage curriculum, analyze cohort performance, and provision student access through our unified enterprise dashboard.
          </p>
          
          <div className="space-y-4">
            {['SOC2 Type II Compliant', 'End-to-End Encryption', 'Role-Based Access Control'].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="relative z-10 text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} EduQuiz Enterprise Solutions. All rights reserved.
        </div>
      </div>

      {/* RIGHT SIDE: Auth Forms */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-12 lg:p-24 bg-white relative">
        <Button variant="ghost" className="absolute top-8 left-8 text-muted-foreground hidden md:flex" onClick={() => window.location.href = 'http://localhost:5173'}>
          <ChevronLeft className="h-4 w-4 mr-2" /> Return to Platform
        </Button>
        
        <div className="w-full max-w-md space-y-8">
          <div className="text-center md:text-left">
            <a href="http://localhost:5173" className="md:hidden flex items-center justify-center gap-2 text-slate-900 mb-8 hover:opacity-80 transition-opacity">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="text-2xl font-bold tracking-tight">EduQuiz <span className="font-light text-slate-500">Enterprise</span></span>
            </a>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 mb-2">Admin Portal</h2>
            <p className="text-slate-500">Authenticate to access institutional controls.</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-12 bg-slate-100/50">
              <TabsTrigger value="signin" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Request Access</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-6 animate-fade-in">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-slate-700">Corporate Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="admin@institution.edu"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    className="h-12 bg-slate-50/50 border-slate-200 focus-visible:ring-primary"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password" className="text-slate-700">Password</Label>
                    <a href="#" className="text-sm text-primary hover:underline font-medium">Forgot password?</a>
                  </div>
                  <Input
                    id="signin-password"
                    type="password"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    className="h-12 bg-slate-50/50 border-slate-200 focus-visible:ring-primary"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base font-medium shadow-sm hover:shadow transition-all" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Authenticate Securely'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-6 animate-fade-in">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-slate-700">Administrator Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Dr. Jane Doe"
                    value={signUpData.displayName}
                    onChange={(e) => setSignUpData({ ...signUpData, displayName: e.target.value })}
                    className="h-12 bg-slate-50/50 border-slate-200 focus-visible:ring-primary"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-slate-700">Corporate Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="admin@institution.edu"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    className="h-12 bg-slate-50/50 border-slate-200 focus-visible:ring-primary"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-slate-700">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      className="h-12 bg-slate-50/50 border-slate-200 focus-visible:ring-primary"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm" className="text-slate-700">Confirm</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                      className="h-12 bg-slate-50/50 border-slate-200 focus-visible:ring-primary"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 text-base font-medium shadow-sm hover:shadow transition-all" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Provision Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          <div className="pt-8 border-t border-slate-100 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Shield className="h-4 w-4" /> Secure Admin Portal
          </div>
        </div>
      </div>
    </div>
  );
}
