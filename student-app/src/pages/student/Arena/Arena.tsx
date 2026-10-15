import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Swords, Skull, Trophy, AlertCircle, ChevronRight, Zap } from 'lucide-react';
import { toast } from 'sonner';

type GameState = 'IDLE' | 'QUEUED' | 'MATCH_FOUND' | 'BATTLE' | 'FINISHED';

interface Question {
  id: string;
  questionText: string;
  questionType: 'multiple-choice' | 'true-false' | 'short-answer';
  points: number;
  options: string[] | null;
}

const Arena = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [roomId, setRoomId] = useState<string | null>(null);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string>('Opponent');
  const [opponentElo, setOpponentElo] = useState<number>(1200);
  const [myElo, setMyElo] = useState<number>(1250);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>('Live Battle');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [myProgress, setMyProgress] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [playersInQueue, setPlayersInQueue] = useState(0);
  const [queueElapsed, setQueueElapsed] = useState(0);

  // Keep opponentId in a ref to avoid stale closures in socket callbacks
  const opponentIdRef = useRef<string | null>(null);

  // Queue elapsed timer
  useEffect(() => {
    let timer: any;
    if (gameState === 'QUEUED') {
      setQueueElapsed(0);
      timer = setInterval(() => {
        setQueueElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameState]);

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Initialize socket connection once
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication required for Arena');
      navigate('/auth/student/sign-in');
      return;
    }

    // Connect to backend socket
    const backendUrl = import.meta.env.VITE_API_URL || '';
    const newSocket = io(backendUrl, {
      auth: { token },
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('[Arena] Connected to Arena socket server');
    });

    newSocket.on('queue_status', (data) => {
      console.log('[Arena] Queue status update:', data);
      setPlayersInQueue(data.playersInQueue || 1);
    });

    newSocket.on('match_found', async (data) => {
      console.log('[Arena] Match found payload:', data);
      setRoomId(data.roomId);
      setOpponentId(data.opponentId);
      opponentIdRef.current = data.opponentId;
      setOpponentName(data.opponentName || 'Opponent');
      setOpponentElo(data.opponentElo || 1200);
      setMyElo(data.myElo || user?.eloRating || 1250);
      setQuizId(data.quizId);
      if (data.quizTitle) {
        setQuizTitle(data.quizTitle);
      }
      setGameState('MATCH_FOUND');
      
      // Auto-join the battle room for real-time signaling
      newSocket.emit('join_arena_room', data.roomId);
      
      // Load battle quiz data
      await loadBattleData(data.quizId, token);
    });

    newSocket.on('opponent_progress', (data) => {
      console.log('[Arena] Opponent progress received:', data);
      if (!opponentIdRef.current || data.opponentId === opponentIdRef.current) {
        setOpponentProgress(data.currentQuestionIndex);
      }
    });

    newSocket.on('arena_error', (data) => {
      toast.error(data.message || 'Arena matchmaking error');
      setGameState('IDLE');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [navigate]);

  const joinQueue = () => {
    if (socket) {
      setGameState('QUEUED');
      socket.emit('join_arena_queue', { 
        eloRating: user?.eloRating || 1250,
        clickTime: Date.now()
      });
      toast.info('Entered matchmaking queue...');
    }
  };

  const leaveQueue = () => {
    if (socket) {
      socket.emit('leave_arena_queue');
      setGameState('IDLE');
      toast.info('Left the queue.');
    }
  };

  const loadBattleData = async (qId: string, token: string) => {
    try {
      // 1. Fetch questions
      const qRes = await fetch(`/api/quizzes/${qId}/questions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!qRes.ok) throw new Error('Failed to load battle constraints');
      const qData = await qRes.json();
      setQuestions(qData);

      // 2. Start attempt
      const attemptRes = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: qId })
      });
      if (!attemptRes.ok) throw new Error('Failed to initialize battle sequence');
      const attemptData = await attemptRes.json();
      setAttemptId(attemptData.id);

      // Give players 3 seconds countdown to view matchup
      setTimeout(() => {
        setGameState('BATTLE');
        toast.success('BATTLE START!', { icon: '⚔️' });
      }, 3000);

    } catch (err: any) {
      toast.error(err.message);
      setGameState('IDLE');
    }
  };

  const handleAnswer = (answer: string) => {
    const qId = questions[currentIndex].id;
    setAnswers(prev => ({ ...prev, [qId]: answer }));
  };

  const advanceQuestion = () => {
    const newIndex = currentIndex + 1;
    setMyProgress(newIndex);
    
    // Broadcast progress to opponent in real-time
    if (socket && roomId) {
      socket.emit('arena_progress', { roomId, currentQuestionIndex: newIndex, score: 0 });
    }

    if (newIndex >= questions.length) {
      submitBattle();
    } else {
      setCurrentIndex(newIndex);
    }
  };

  const submitBattle = async () => {
    if (!attemptId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const formattedAnswers = questions.map(q => ({
        questionId: q.id,
        answer: answers[q.id] || ''
      }));

      toast.loading('Calculating battle results...', { id: 'battle-submit' });

      const response = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: formattedAnswers })
      });

      if (!response.ok) throw new Error('Failed to submit results');
      const result = await response.json();
      
      setMatchResult(result);
      setGameState('FINISHED');
      toast.success('Battle Finished!', { id: 'battle-submit' });

    } catch (err: any) {
      toast.error(err.message || 'Error submitting battle', { id: 'battle-submit' });
      setIsSubmitting(false);
    }
  };

  // Renders
  if (gameState === 'IDLE') {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-background rounded-xl border border-white/10 overflow-hidden">
        <div className="max-w-md w-full p-8 rounded-2xl bg-black/60 border border-primary/30 backdrop-blur-md text-center shadow-[0_0_50px_rgba(139,92,246,0.15)] animate-fade-in">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
            <Swords className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400 mb-2">Live Arena</h1>
          <p className="text-muted-foreground mb-8">Test your skills in real-time 1v1 algorithmic combat against fellow students.</p>
          
          <Button onClick={joinQueue} className="w-full h-14 text-lg font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all hover:scale-[1.02]">
            Enter Matchmaking
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'QUEUED') {
    return (
      <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center bg-background rounded-xl border border-white/10 overflow-hidden">
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full"></div>
          <Loader2 className="h-24 w-24 text-primary animate-spin relative z-10" />
        </div>
        <h2 className="text-2xl font-bold font-mono tracking-widest mb-3">SEARCHING FOR OPPONENT...</h2>
        <p className="text-muted-foreground text-sm mb-2">Finding a worthy opponent near your rating</p>
        <p className="text-xs font-mono text-primary/80 mb-8">
          Time elapsed: {formatElapsed(queueElapsed)} &bull; Estimated wait: ~0:15
        </p>
        <Button variant="outline" onClick={leaveQueue} className="border-destructive/60 text-destructive hover:bg-destructive/10 px-6">
          Cancel Search
        </Button>
      </div>
    );
  }

  if (gameState === 'MATCH_FOUND') {
    return (
      <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center bg-background rounded-xl border border-white/10 overflow-hidden animate-fade-in">
        <h1 className="text-5xl font-black uppercase tracking-widest text-destructive mb-6 animate-pulse shadow-destructive/50 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]">
          MATCH FOUND
        </h1>
        <p className="text-muted-foreground font-mono text-sm mb-12">Arena Subject: <span className="text-cyan-400 font-bold">{quizTitle}</span></p>

        <div className="flex items-center gap-12 mb-16">
          <div className="text-center">
            <div className="w-36 h-36 bg-primary/20 rounded-xl border-2 border-primary flex flex-col items-center justify-center mb-4 px-2">
              <span className="text-lg font-bold text-primary truncate max-w-[130px]">{user?.displayName || 'YOU'}</span>
              <span className="text-xs uppercase tracking-wider text-primary/70 mt-1">Challenger</span>
            </div>
            <p className="font-mono text-muted-foreground text-sm">Elo {myElo}</p>
          </div>
          <div className="text-4xl font-black text-muted-foreground">VS</div>
          <div className="text-center">
            <div className="w-36 h-36 bg-destructive/20 rounded-xl border-2 border-destructive flex flex-col items-center justify-center mb-4 px-2">
              <span className="text-lg font-bold text-destructive truncate max-w-[130px]">{opponentName}</span>
              <span className="text-xs uppercase tracking-wider text-destructive/70 mt-1">Opponent</span>
            </div>
            <p className="font-mono text-muted-foreground text-sm">Elo {opponentElo}</p>
          </div>
        </div>
        <div className="text-2xl font-mono animate-bounce text-cyan-400">PREPARING ARENA...</div>
      </div>
    );
  }

  if (gameState === 'BATTLE' && questions.length > 0) {
    const currentQ = questions[currentIndex];
    
    return (
      <div className="min-h-[calc(100vh-120px)] flex flex-col bg-background rounded-xl border border-white/10 relative overflow-hidden">
        {/* Arena Top Bar */}
        <div className="h-20 border-b border-white/10 bg-black/40 backdrop-blur-md px-8 flex items-center justify-between z-10">
          
          {/* Player 1 Progress */}
          <div className="flex-1 max-w-sm">
            <div className="flex justify-between text-sm font-mono mb-2">
              <span className="text-primary font-bold truncate max-w-[180px]">{user?.displayName || 'YOU'}</span>
              <span className="text-primary">{myProgress} / {questions.length}</span>
            </div>
            <Progress value={(myProgress / questions.length) * 100} className="h-3 bg-primary/20 [&>div]:bg-primary" />
          </div>

          {/* VS Center */}
          <div className="mx-8 flex flex-col items-center">
            <Swords className="h-6 w-6 text-white mb-1" />
            <span className="text-xs font-mono tracking-widest text-muted-foreground">ARENA</span>
          </div>

          {/* Player 2 Progress */}
          <div className="flex-1 max-w-sm">
            <div className="flex justify-between text-sm font-mono mb-2">
              <span className="text-destructive font-bold truncate max-w-[180px]">{opponentName}</span>
              <span className="text-destructive">{opponentProgress} / {questions.length}</span>
            </div>
            <Progress value={(opponentProgress / questions.length) * 100} className="h-3 bg-destructive/20 [&>div]:bg-destructive" />
          </div>
        </div>

        {/* Split Pane Battleground */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: Problem */}
          <div className="w-1/2 border-r border-white/10 flex flex-col bg-black/20 p-8 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-3 mb-8">
              <span className="px-3 py-1 rounded bg-white/10 font-mono text-sm uppercase tracking-wider">
                Stage {currentIndex + 1} of {questions.length}
              </span>
              <span className="px-3 py-1 rounded bg-primary/10 text-primary border border-primary/20 font-mono text-sm">
                {currentQ.points} XP
              </span>
            </div>
            
            <h2 className="text-3xl font-bold leading-tight mb-8">
              {currentQ.questionText}
            </h2>
          </div>

          {/* RIGHT: Input */}
          <div className="w-1/2 flex flex-col p-8 overflow-y-auto custom-scrollbar bg-background justify-center items-center">
            <div className="w-full max-w-xl">
              <div className="mb-8 flex items-center justify-between">
                <span className="font-mono text-muted-foreground uppercase tracking-wider text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-400" /> Execute Solution
                </span>
              </div>
              
              {currentQ.questionType === 'multiple-choice' && currentQ.options && (
                <RadioGroup value={answers[currentQ.id] || ''} onValueChange={handleAnswer} className="space-y-4">
                  {currentQ.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`relative flex items-center space-x-3 p-6 rounded-xl border-2 transition-all cursor-pointer ${
                        answers[currentQ.id] === opt
                          ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                          : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/40'
                      }`}
                      onClick={() => handleAnswer(opt)}
                    >
                      <RadioGroupItem value={opt} id={`opt-${i}`} className="mt-0.5" />
                      <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer text-lg leading-relaxed font-medium">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {/* True False */}
              {currentQ.questionType === 'true-false' && (
                <RadioGroup value={answers[currentQ.id] || ''} onValueChange={handleAnswer} className="grid grid-cols-2 gap-6">
                  {['True', 'False'].map((opt) => (
                    <div
                      key={opt}
                      className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 transition-all cursor-pointer ${
                        answers[currentQ.id] === opt
                          ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                          : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/40'
                      }`}
                      onClick={() => handleAnswer(opt)}
                    >
                      <RadioGroupItem value={opt} id={`tf-${opt}`} className="sr-only" />
                      <span className={`text-2xl font-bold tracking-wider uppercase ${answers[currentQ.id] === opt ? 'text-primary' : 'text-muted-foreground'}`}>{opt}</span>
                    </div>
                  ))}
                </RadioGroup>
              )}

              <div className="mt-12 flex justify-end">
                <Button 
                  size="lg" 
                  onClick={advanceQuestion}
                  disabled={!answers[currentQ.id] || isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 h-14 text-lg shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'LOCK IN & ADVANCE'} <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'FINISHED') {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-8 rounded-2xl bg-black/60 border border-primary/30 text-center shadow-[0_0_50px_rgba(139,92,246,0.1)] animate-fade-in">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-500/20 border-2 border-green-500">
            <Trophy className="h-12 w-12 text-green-400" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-widest text-green-400 mb-2">VICTORY</h1>
          <p className="text-muted-foreground mb-8">You successfully completed the arena challenge.</p>
          
          <div className="p-4 bg-white/5 rounded-lg mb-8 font-mono">
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">Score</span>
              <span className="text-white font-bold">{matchResult?.score || 0} / {matchResult?.totalPossiblePoints || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rating Change</span>
              <span className="text-green-400 font-bold">+24 Elo</span>
            </div>
          </div>

          <Button onClick={() => navigate('/student/dashboard')} className="w-full">
            Return to Hub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-[calc(100vh-64px)]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default Arena;
