import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Swords, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setIsSubmitted(true);
      toast.success('Reset instructions sent to your email');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md z-10 px-[max(1cm,1.5rem)]">
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-primary/20 p-3 rounded-xl group-hover:bg-primary/30 transition-colors">
              <Swords className="h-8 w-8 text-primary" />
            </div>
            <span className="text-3xl font-bold tracking-tight">EduQuiz</span>
          </Link>
        </div>

        <Card className="w-full bg-card/50 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your school email to receive reset instructions
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {isSubmitted ? (
              <div className="text-center space-y-6">
                <div className="p-4 bg-primary/20 rounded-lg text-primary font-medium">
                  Check your email (or terminal logs in local dev) for the reset link!
                </div>
                <Link to="/auth/student/sign-in">
                  <Button variant="outline" className="w-full border-white/10">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="player1@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-black/20 border-white/10 focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                  <Link to="/auth/student/sign-in">
                    <Button type="button" variant="ghost" className="w-full text-muted-foreground">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
