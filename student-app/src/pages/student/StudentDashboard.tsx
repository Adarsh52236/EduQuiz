import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Swords, Code, Trophy, Target, Clock, Zap, BookOpen } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [globalXp, setGlobalXp] = useState(0);
  const [elo, setElo] = useState(1200);

  // Example placeholder state
  const assignments = [
    { id: '1', title: 'Calculus Midterm', class: 'Math 101', due: 'Tomorrow, 11:59 PM', points: 100 },
    { id: '2', title: 'Photosynthesis Essay', class: 'Biology 202', due: 'Friday, 5:00 PM', points: 50 },
  ];

  const practiceQuestions = [
    { id: 'q1', title: 'Two Sum', difficulty: 'Easy', tags: ['Arrays', 'Hash Table'] },
    { id: 'q2', title: 'Reverse Linked List', difficulty: 'Medium', tags: ['Linked List'] },
    { id: 'q3', title: 'Explain the Water Cycle', difficulty: 'Easy', tags: ['Science', 'Short Answer'] },
    { id: 'q4', title: 'Dynamic Programming Basics', difficulty: 'Hard', tags: ['DP', 'Algorithms'] },
  ];

  // (Optional) Fetch real data here in the future
  useEffect(() => {
    // Fetch user's global stats from an endpoint if available
    // For now we use placeholder 1200 Elo and 450 XP
    setGlobalXp(450);
    setElo(1200);
  }, []);

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      
      {/* COLUMN 1: CLASSROOM (Mandatory Work) */}
      <div className="w-[300px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 pb-20 custom-scrollbar">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-bold tracking-tight">Classroom</h2>
        </div>
        
        <Button variant="outline" className="w-full border-dashed border-white/20 bg-transparent hover:bg-white/5" onClick={() => navigate('/student/enroll')}>
          + Join New Class
        </Button>

        {assignments.map(a => (
          <Card key={a.id} className="bg-card/50 border-white/5 hover:border-white/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="secondary" className="bg-white/10">{a.class}</Badge>
                <span className="text-xs text-muted-foreground font-mono">{a.points}pts</span>
              </div>
              <h3 className="font-semibold mb-3 leading-tight">{a.title}</h3>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {a.due}
                </span>
                <Button size="sm" variant="secondary" className="h-7 text-xs bg-white/10 hover:bg-white/20">
                  Start
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* COLUMN 2: PRACTICE HUB (Center Stage) */}
      <div className="flex-1 flex flex-col min-w-[500px] overflow-y-auto pr-2 pb-20 custom-scrollbar">
        <div className="flex items-center gap-2 mb-4">
          <Code className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">Practice Hub</h2>
        </div>

        {/* Hero: Daily Challenge */}
        <Card className="bg-gradient-to-br from-primary/20 to-card border-primary/30 mb-6 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <Badge className="bg-primary/20 text-primary hover:bg-primary/30 mb-3 border-0">Daily Challenge</Badge>
                <h3 className="text-2xl font-bold mb-2">Implement a Web Server</h3>
                <p className="text-muted-foreground mb-4 max-w-[80%]">Write a basic HTTP server in Node.js that responds with "Hello World" on port 3000.</p>
              </div>
              <div className="flex flex-col items-center bg-black/40 rounded-xl p-3 border border-white/10">
                <Zap className="h-6 w-6 text-yellow-400 mb-1" />
                <span className="font-bold text-lg text-yellow-400">+50 XP</span>
              </div>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Solve Challenge</Button>
          </CardContent>
        </Card>

        {/* Problem List (LeetCode Style) */}
        <div className="bg-card/30 border border-white/5 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-sm font-medium text-muted-foreground bg-black/20">
            <div className="col-span-1">Status</div>
            <div className="col-span-5">Title</div>
            <div className="col-span-4">Tags</div>
            <div className="col-span-2 text-right">Difficulty</div>
          </div>
          <div className="divide-y divide-white/5">
            {practiceQuestions.map((q, i) => (
              <div key={q.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors cursor-pointer" onClick={() => navigate(`/student/practice/${q.id}`)}>
                <div className="col-span-1">
                  {i === 0 ? <Target className="h-4 w-4 text-green-400" /> : <div className="h-4 w-4 rounded-full border border-white/20" />}
                </div>
                <div className="col-span-5 font-medium hover:text-primary transition-colors">{q.title}</div>
                <div className="col-span-4 flex gap-2 flex-wrap">
                  {q.tags.map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="col-span-2 text-right">
                  <span className={`text-xs font-medium ${
                    q.difficulty === 'Easy' ? 'text-green-400' : 
                    q.difficulty === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {q.difficulty}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COLUMN 3: LIVE ARENA (Right Sidebar) */}
      <div className="w-[320px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto pb-20 custom-scrollbar">
        <div className="flex items-center gap-2 mb-2">
          <Swords className="h-5 w-5 text-cyan-400" />
          <h2 className="text-xl font-bold tracking-tight">Live Arena</h2>
        </div>

        {/* Matchmaking Card */}
        <Card className="bg-card/50 border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[50px]" />
          <CardContent className="p-6 flex flex-col items-center text-center relative z-10">
            <div className="w-24 h-24 rounded-full border-4 border-cyan-500/20 flex items-center justify-center mb-4 bg-black/40">
              <div className="text-center">
                <div className="text-sm text-cyan-400 font-bold uppercase tracking-wider mb-1">Rank</div>
                <div className="text-2xl font-black text-white">{elo}</div>
              </div>
            </div>
            <h3 className="font-bold text-lg mb-1">Ready for Battle?</h3>
            <p className="text-sm text-muted-foreground mb-6">Queue up for a 1v1 knowledge showdown.</p>
            <Button className="w-full h-14 text-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold shadow-[0_0_20px_rgba(34,211,238,0.4)] animate-pulse" onClick={() => navigate('/student/arena')}>
              <Swords className="mr-2 h-5 w-5" /> ENTER ARENA
            </Button>
          </CardContent>
        </Card>

        {/* Global XP & Leaderboard Snippet */}
        <Card className="bg-card/50 border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Global Standings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-orange-500">{globalXp}</span>
              <span className="text-sm text-muted-foreground font-bold pb-1">XP</span>
            </div>
            
            <div className="space-y-4">
              {[1, 2, 3].map((rank) => (
                <div key={rank} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-sm ${rank === 1 ? 'text-yellow-400 font-bold' : 'text-muted-foreground'}`}>#{rank}</span>
                    <div className="w-6 h-6 rounded-full bg-white/10" />
                    <span className="text-sm font-medium">Player_{rank}99</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">2400 XP</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
