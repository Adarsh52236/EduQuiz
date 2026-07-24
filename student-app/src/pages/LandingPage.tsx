import { Button } from '@/components/ui/button';
import { Swords, Code, Trophy, Activity, ArrowRight, Zap, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function LandingPage() {
  const [tickerText, setTickerText] = useState("1,204 students in Arena right now");
  
  useEffect(() => {
    // Fake live ticker for the landing page
    const tickers = [
      "1,204 students in Arena right now",
      "Global Elo leaderboard updated 2m ago",
      "New Daily Challenge: Advanced Calculus",
      "User 'MathWizard99' just hit a 30-day streak!"
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % tickers.length;
      setTickerText(tickers[i]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">
      
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-background/50 backdrop-blur-md fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 p-2 rounded-lg">
              <Swords className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">OmniPrep</span>
          </div>
          <div className="flex items-center gap-4">
            {/* The Teacher App runs on a different port/subdomain */}
            <a href="http://localhost:5174/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Teacher Console
            </a>
            <Link to="/auth/student/sign-in">
              <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          
          {/* Live Ticker */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium mb-8 animate-fade-in shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            {tickerText}
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-tight">
            Master the Curriculum.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">
              Dominate the Arena.
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            The ultimate platform where classroom assignments meet high-stakes competitive learning. Practice like it's LeetCode. Compete like it's E-Sports.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/auth/student/sign-up">
              <Button size="lg" className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_30px_rgba(139,92,246,0.4)] group">
                Enter the Arena 
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 border-t border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors group">
              <div className="h-12 w-12 bg-primary/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Targeted Practice</h3>
              <p className="text-muted-foreground leading-relaxed">
                Filter questions by topic and difficulty. Track your streak, earn Global XP, and receive instant AI feedback on your short answers.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors group">
              <div className="h-12 w-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Swords className="h-6 w-6 text-cyan-400" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Live 1v1 Battles</h3>
              <p className="text-muted-foreground leading-relaxed">
                Queue up against students worldwide. Climb the Elo ranking system in real-time, high-pressure knowledge showdowns.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors group">
              <div className="h-12 w-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Activity className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Classroom DNA</h3>
              <p className="text-muted-foreground leading-relaxed">
                Seamlessly complete your teacher's mandatory assignments inside the same engaging, distraction-free environment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6 text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} OmniPrep. Built for the next generation of learners.</p>
      </footer>
    </div>
  );
}
