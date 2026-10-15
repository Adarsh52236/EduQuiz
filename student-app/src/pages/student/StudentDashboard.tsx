import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Swords, Code, Trophy, Target, Clock, Zap, BookOpen, Users, Plus, Trash2, GraduationCap, Loader2, Lock, CheckCircle2, XCircle, Eye, Calendar, Play, Star, Search, Sparkles, Check, Flame, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [globalXp, setGlobalXp] = useState(0);
  const [elo, setElo] = useState(1200);
  const [enrolledClasses, setEnrolledClasses] = useState<any[]>([]);
  const [isCohortsModalOpen, setIsCohortsModalOpen] = useState(false);
  const [isLoadingCohorts, setIsLoadingCohorts] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState<string | null>(null);

  // Classroom Active/Upcoming Quizzes State
  const [classroomQuizzes, setClassroomQuizzes] = useState<any[]>([]);
  const [completedQuizIds, setCompletedQuizIds] = useState<Set<string>>(new Set());
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(true);

  // Practice Hub (IMP Questions & Groq AI Categories) State
  const [practiceQuestions, setPracticeQuestions] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingPractice, setIsLoadingPractice] = useState<boolean>(true);

  // Daily Challenge State (Strictly 1 attempt per day)
  const [dailyChallenge, setDailyChallenge] = useState<any | null>(null);
  const [hasAttemptedDailyToday, setHasAttemptedDailyToday] = useState<boolean>(false);
  const [todayDailySubmission, setTodayDailySubmission] = useState<any | null>(null);
  const [dailyStreak, setDailyStreak] = useState<number>(0);
  const [isDailyChallengeModalOpen, setIsDailyChallengeModalOpen] = useState<boolean>(false);
  const [selectedDailyAnswer, setSelectedDailyAnswer] = useState<string>('');
  const [dailySubmitResult, setDailySubmitResult] = useState<any | null>(null);
  const [isSubmittingDaily, setIsSubmittingDaily] = useState<boolean>(false);
  const [isLoadingDaily, setIsLoadingDaily] = useState<boolean>(true);

  // Real Global Standings & Profiles State
  const [globalStandings, setGlobalStandings] = useState<any[]>([]);
  const [myStandingsStats, setMyStandingsStats] = useState<any | null>(null);

  // Active Practice Question Solver Modal State
  const [activePracticeModalQuestion, setActivePracticeModalQuestion] = useState<any | null>(null);
  const [selectedPracticeAnswer, setSelectedPracticeAnswer] = useState<string>('');
  const [practiceSubmissionResult, setPracticeSubmissionResult] = useState<{ isCorrect: boolean; xpGained: number; correctAnswer?: string } | null>(null);
  const [isSubmittingPractice, setIsSubmittingPractice] = useState<boolean>(false);

  const formatDue = (dateStr: string) => {
    if (!dateStr) return 'No deadline';
    const d = new Date(dateStr);
    const now = new Date();
    const diffHours = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours > 0 && diffHours < 24) {
      return `Due in ${Math.round(diffHours)}h`;
    }
    return `Due ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatStarts = (dateStr: string) => {
    if (!dateStr) return 'Starts soon';
    const d = new Date(dateStr);
    return `Starts ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const loadEnrollments = async () => {
    setIsLoadingCohorts(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/enrollments', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setEnrolledClasses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch enrollments:', err);
    } finally {
      setIsLoadingCohorts(false);
    }
  };

  const loadQuizzes = async () => {
    setIsLoadingQuizzes(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const [quizzesRes, attemptsRes] = await Promise.all([
        fetch('/api/quizzes', { headers }),
        fetch('/api/attempts?isCompleted=true', { headers })
      ]);

      if (attemptsRes.ok) {
        const attemptsData = await attemptsRes.json();
        if (Array.isArray(attemptsData)) {
          setCompletedQuizIds(new Set(attemptsData.map(a => a.quizId)));
        }
      }

      if (quizzesRes.ok) {
        const quizzesData = await quizzesRes.json();
        setClassroomQuizzes(Array.isArray(quizzesData) ? quizzesData : []);
      }
    } catch (err) {
      console.error('Failed to fetch classroom quizzes:', err);
    } finally {
      setIsLoadingQuizzes(false);
    }
  };

  const loadPracticeQuestions = async () => {
    setIsLoadingPractice(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        category: selectedCategory,
        difficulty: selectedDifficulty,
        limit: '5'
      });
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const [questionsRes, categoriesRes] = await Promise.all([
        fetch(`/api/practice/questions?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/practice/categories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (questionsRes.ok) {
        const data = await questionsRes.json();
        setPracticeQuestions(Array.isArray(data) ? data : []);
      }
      if (categoriesRes.ok) {
        const catData = await categoriesRes.json();
        setCategories(catData.counts || []);
      }
    } catch (err) {
      console.error('Failed to load practice questions:', err);
    } finally {
      setIsLoadingPractice(false);
    }
  };

  const loadDailyChallenge = async () => {
    setIsLoadingDaily(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/practice/daily-challenge', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDailyChallenge(data.question);
        setHasAttemptedDailyToday(Boolean(data.hasAttemptedToday));
        setTodayDailySubmission(data.todaySubmission);
        setDailyStreak(data.streakCount || 0);
      }
    } catch (err) {
      console.error('Failed to load daily challenge:', err);
    } finally {
      setIsLoadingDaily(false);
    }
  };

  const loadStandings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/practice/global-standings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalStandings(data.standings || []);
        setMyStandingsStats(data.myStats || null);
        if (data.myStats) {
          setGlobalXp(data.myStats.globalXp || 0);
          setElo(data.myStats.eloRating || 1200);
          setDailyStreak(data.myStats.streakCount || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load global standings:', err);
    }
  };

  const handleDailySubmit = async () => {
    if (!dailyChallenge || !selectedDailyAnswer || hasAttemptedDailyToday) return;
    setIsSubmittingDaily(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/practice/daily-challenge/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionId: dailyChallenge.id,
          answer: selectedDailyAnswer
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDailySubmitResult(data);
        setHasAttemptedDailyToday(true);
        setDailyStreak(data.streakCount);
        if (data.isCorrect) {
          toast.success(data.message);
          setGlobalXp(prev => prev + data.xpGained);
        } else {
          toast.info(data.message);
        }
        loadStandings();
        loadPracticeQuestions();
      } else {
        toast.error(data.message || 'Error submitting daily challenge');
      }
    } catch (err) {
      toast.error('Failed to submit daily challenge');
    } finally {
      setIsSubmittingDaily(false);
    }
  };

  const handleToggleImp = async (questionId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/practice/questions/${questionId}/rate-imp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPracticeQuestions(prev => prev.map(q => {
          if (q.id === questionId) {
            return {
              ...q,
              hasVotedImp: data.hasVotedImp,
              impVotesCount: data.impVotesCount
            };
          }
          return q;
        }));
        if (activePracticeModalQuestion && activePracticeModalQuestion.id === questionId) {
          setActivePracticeModalQuestion((prev: any) => ({
            ...prev,
            hasVotedImp: data.hasVotedImp,
            impVotesCount: data.impVotesCount
          }));
        }
        toast.success(data.message);
      }
    } catch (err) {
      toast.error('Failed to update IMP rating');
    }
  };

  const handlePracticeSubmit = async () => {
    if (!activePracticeModalQuestion || !selectedPracticeAnswer) return;
    setIsSubmittingPractice(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionId: activePracticeModalQuestion.id,
          answer: selectedPracticeAnswer
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPracticeSubmissionResult(data);
        if (data.isCorrect) {
          toast.success(`Correct! +${data.xpGained} XP awarded!`);
          setGlobalXp(prev => prev + data.xpGained);
          setPracticeQuestions(prev => prev.map(q => {
            if (q.id === activePracticeModalQuestion.id) {
              return { ...q, isSolved: true };
            }
            return q;
          }));
        } else {
          toast.error('Incorrect. Check the correct answer shown below.');
        }
      }
    } catch (err) {
      toast.error('Failed to submit practice answer');
    } finally {
      setIsSubmittingPractice(false);
    }
  };

  const handleUnenroll = async (enrollmentId: string, className: string) => {
    if (!confirm(`Are you sure you want to unenroll from "${className}"?`)) return;
    setIsUnenrolling(enrollmentId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        toast.success(`Unenrolled from ${className}`);
        setEnrolledClasses(prev => prev.filter(e => e.id !== enrollmentId));
        loadQuizzes();
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Failed to unenroll');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error unenrolling from class');
    } finally {
      setIsUnenrolling(null);
    }
  };

  useEffect(() => {
    loadEnrollments();
    loadQuizzes();
    loadPracticeQuestions();
    loadDailyChallenge();
    loadStandings();
  }, []);

  useEffect(() => {
    loadPracticeQuestions();
  }, [selectedCategory, selectedDifficulty]);

  const now = new Date();
  const visibleQuizzes = classroomQuizzes.filter(q => {
    // 1. Strict Deadline Filter: Once any quiz goes past its deadline it should NOT be shown
    if (q.endTime && new Date(q.endTime) <= now) return false;
    if (q.status === 'Closed') return false;

    // 2. Exclude quizzes already completed by the student
    if (completedQuizIds.has(q.id)) return false;

    // 3. Quiz must be Active or Upcoming
    const isUpcoming = q.status === 'Upcoming' || (q.startTime && new Date(q.startTime) > now);
    const isActive = q.status === 'Active' || (!isUpcoming && (!q.endTime || new Date(q.endTime) > now));

    return isActive || isUpcoming;
  }).sort((a, b) => {
    const aUpcoming = a.status === 'Upcoming' || (a.startTime && new Date(a.startTime) > now);
    const bUpcoming = b.status === 'Upcoming' || (b.startTime && new Date(b.startTime) > now);
    if (!aUpcoming && bUpcoming) return -1;
    if (aUpcoming && !bUpcoming) return 1;
    if (!aUpcoming && !bUpcoming) {
      return (new Date(a.endTime || 0).getTime()) - (new Date(b.endTime || 0).getTime());
    }
    return (new Date(a.startTime || 0).getTime()) - (new Date(b.startTime || 0).getTime());
  });

  return (
    <div className="min-h-full flex flex-col lg:flex-row gap-6">
      
      {/* COLUMN 1: CLASSROOM (Mandatory Work) */}
      <div className="w-[300px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 pb-20 custom-scrollbar">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-bold tracking-tight">Classroom</h2>
        </div>
        
        {/* PARALLEL ACTION BUTTONS: Join Class + Check Enrolled Cohorts */}
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            className="border-dashed border-white/20 bg-transparent hover:bg-white/5 text-xs h-9 px-2 flex items-center justify-center gap-1.5" 
            onClick={() => navigate('/student/enroll')}
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            + Join Class
          </Button>

          <Button 
            variant="outline" 
            className="border-white/10 bg-white/5 hover:bg-white/10 text-xs h-9 px-2 flex items-center justify-center gap-1.5 font-medium text-slate-200 hover:text-white" 
            onClick={() => {
              loadEnrollments();
              setIsCohortsModalOpen(true);
            }}
          >
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            My Cohorts {enrolledClasses.length > 0 && `(${enrolledClasses.length})`}
          </Button>
        </div>

        {/* ACTIVE OR UPCOMING QUIZZES (Past Deadline strictly excluded) */}
        <div className="flex flex-col gap-3">
          {isLoadingQuizzes ? (
            <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-xs">Loading classroom quizzes...</p>
            </div>
          ) : visibleQuizzes.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-white/10 text-center py-6 bg-card/20">
              <CheckCircle2 className="h-7 w-7 text-emerald-400/60 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">All Caught Up</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                No active or upcoming classroom quizzes right now.
              </p>
            </div>
          ) : (
            visibleQuizzes.map(q => {
              const isUpcoming = q.status === 'Upcoming' || (q.startTime && new Date(q.startTime) > now);
              const isActive = !isUpcoming;

              return (
                <Card 
                  key={q.id} 
                  className={`bg-card/50 border-white/5 hover:border-white/10 transition-all ${
                    isActive ? 'ring-1 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-1.5">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] font-semibold flex items-center gap-1.5 ${
                          isActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </>
                        ) : (
                          <>
                            <Clock className="h-2.5 w-2.5" />
                            Upcoming
                          </>
                        )}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono font-medium">
                        {q.totalPoints || 0} pts
                      </span>
                    </div>

                    <div className="mb-2">
                      <h3 className="font-semibold text-sm text-white leading-tight mb-0.5">{q.title}</h3>
                      {q.className && (
                        <p className="text-[11px] text-cyan-400/90 font-medium truncate">{q.className}</p>
                      )}
                    </div>

                    {q.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                        {q.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1">
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        {isActive ? (
                          <span className="text-emerald-400/90 font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatDue(q.endTime)}
                          </span>
                        ) : (
                          <span className="text-amber-400/90 font-medium flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatStarts(q.startTime)}
                          </span>
                        )}
                      </div>

                      {isActive ? (
                        <Button 
                          size="sm" 
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 flex items-center gap-1 shadow-sm transition-colors"
                          onClick={() => navigate(`/student/quiz/${q.id}`)}
                        >
                          <Play className="h-3 w-3 fill-current" /> Start
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled 
                          className="h-7 text-xs border-white/10 bg-white/5 text-muted-foreground/80 cursor-not-allowed flex items-center gap-1"
                          title="Quiz time has not begun yet"
                        >
                          <Lock className="h-3 w-3" /> Locked
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

        {/* COLUMN 2: PRACTICE HUB (Center Stage - LeetCode Style) */}
      <div className="flex-1 flex flex-col min-w-[500px] overflow-y-auto pr-2 pb-20 custom-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Practice Hub</h2>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            className="text-xs border-cyan-500/30 text-cyan-300 bg-cyan-950/30 hover:bg-cyan-500/20 flex items-center gap-1.5"
            onClick={() => navigate('/student/questions')}
          >
            <span>Full Problemset</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Hero: Daily Challenge (Strictly 1 Attempt Per Day + Streak Tracking) */}
        <Card className="bg-gradient-to-br from-primary/20 to-card border-primary/30 mb-5 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-0 text-xs">Daily Challenge</Badge>
                  <Badge className="bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs flex items-center gap-1">
                    <Flame className="h-3 w-3 fill-orange-400 text-orange-400" />
                    {dailyStreak} Day Streak
                  </Badge>
                </div>
                <h3 className="text-xl font-bold mb-1 text-white">
                  {isLoadingDaily ? (
                    <span className="text-slate-400 font-normal text-base flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading today's challenge...
                    </span>
                  ) : dailyChallenge?.questionText ? (
                    dailyChallenge.questionText
                  ) : (
                    "Today's Challenge Problem"
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mb-3 max-w-[85%]">
                  High-yield community question. Attempt once per day to build your streak and earn +50 XP.
                </p>
              </div>
              <div className="flex flex-col items-center bg-black/40 rounded-xl p-2.5 border border-white/10 shrink-0">
                <Zap className="h-5 w-5 text-yellow-400 mb-0.5" />
                <span className="font-bold text-sm text-yellow-400">+50 XP</span>
              </div>
            </div>

            {hasAttemptedDailyToday ? (
              <div className="space-y-3 mt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={`text-xs py-1.5 px-3 flex items-center gap-1.5 ${
                    (todayDailySubmission?.isCorrect ?? dailySubmitResult?.isCorrect)
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    {(todayDailySubmission?.isCorrect ?? dailySubmitResult?.isCorrect) ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Correct (+50 XP Awarded)
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-rose-400" />
                        Incorrect (Streak Maintained)
                      </>
                    )}
                  </Badge>
                  <span className="text-xs text-slate-400 font-medium">Next challenge unlocks at midnight! 🔥</span>
                </div>

                {/* Submitted Answer Feedback Box */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-400 font-medium">Your Answer:</span>
                      <span className={`font-semibold ${
                        (todayDailySubmission?.isCorrect ?? dailySubmitResult?.isCorrect) ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {todayDailySubmission?.selectedAnswer || todayDailySubmission?.selectedanswer || dailySubmitResult?.selectedAnswer || 'Submitted'}
                      </span>
                      {(todayDailySubmission?.isCorrect ?? dailySubmitResult?.isCorrect) ? (
                        <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                          Right ✓
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">
                          Wrong ✗
                        </span>
                      )}
                    </div>

                    {!(todayDailySubmission?.isCorrect ?? dailySubmitResult?.isCorrect) && (todayDailySubmission?.correctAnswer || dailyChallenge?.correctAnswer || dailySubmitResult?.correctAnswer) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-white/5">
                        <span className="text-slate-400 font-medium">Correct Answer:</span>
                        <span className="font-semibold text-emerald-400">
                          {todayDailySubmission?.correctAnswer || dailyChallenge?.correctAnswer || dailySubmitResult?.correctAnswer}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedDailyAnswer(todayDailySubmission?.selectedAnswer || todayDailySubmission?.selectedanswer || dailySubmitResult?.selectedAnswer || '');
                      setIsDailyChallengeModalOpen(true);
                    }}
                    className="h-8 text-xs border-white/10 hover:bg-white/10 text-slate-300 shrink-0 flex items-center gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" /> Review Challenge
                  </Button>
                </div>
              </div>
            ) : dailyChallenge ? (
              <Button 
                size="sm" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
                onClick={() => {
                  setIsDailyChallengeModalOpen(true);
                  setSelectedDailyAnswer('');
                  setDailySubmitResult(null);
                }}
              >
                Solve Daily Challenge (+50 XP)
              </Button>
            ) : isLoadingDaily ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Loading daily challenge...
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No challenge active for today.</p>
            )}
          </CardContent>
        </Card>

        {/* LEETCODE EXPLORE: CATEGORY SEGMENT TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all border ${
              selectedCategory === 'All'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            All Topics
          </button>
          {['Algorithms', 'Data Structures', 'Dynamic Programming', 'Databases & SQL', 'Operating Systems', 'Computer Networks'].map(cat => {
            const count = categories.find(c => c.category === cat)?.count || 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                  selectedCategory === cat
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <span>{cat}</span>
                {count > 0 && (
                  <span className="text-[10px] font-mono px-1 rounded-full bg-white/10 text-slate-300">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* FILTER & SEARCH TOOLBAR */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // Debounced reload
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadPracticeQuestions();
              }}
              placeholder="Search high-yield IMP questions..."
              className="h-8 pl-8 text-xs bg-slate-900/80 border-slate-800 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-cyan-500/50"
            />
          </div>

          <div className="flex items-center gap-1">
            {['All', 'Easy', 'Medium', 'Hard'].map(diff => (
              <button
                key={diff}
                type="button"
                onClick={() => setSelectedDifficulty(diff)}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors border ${
                  selectedDifficulty === diff
                    ? diff === 'Easy' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                      diff === 'Medium' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                      diff === 'Hard' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                      'bg-white/10 text-white border-white/20'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* PROBLEM LIST (LeetCode Style with IMP Voting & Groq Categories) */}
        <div className="bg-card/30 border border-white/5 rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 gap-3 p-3.5 border-b border-white/5 text-xs font-semibold text-slate-400 bg-black/30">
            <div className="col-span-1">Status</div>
            <div className="col-span-5">Question (High-Yield IMP)</div>
            <div className="col-span-3">Category & Tags</div>
            <div className="col-span-1 text-center">XP</div>
            <div className="col-span-1 text-center">IMP</div>
            <div className="col-span-1 text-right">Difficulty</div>
          </div>

          <div className="divide-y divide-white/5">
            {isLoadingPractice ? (
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs">Loading AI-curated practice questions...</p>
              </div>
            ) : practiceQuestions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 px-4">
                <Star className="h-8 w-8 text-amber-400/50 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No community-voted questions found</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Questions appear in the Practice Hub once verified by the community threshold. Mark high-yield questions during your quizzes to feature them here!
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-3 text-xs border-white/10"
                  onClick={() => {
                    setSelectedCategory('All');
                    setSelectedDifficulty('All');
                    setSearchQuery('');
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              practiceQuestions.slice(0, 5).map((q) => (
                <div 
                  key={q.id} 
                  className="grid grid-cols-12 gap-3 p-3.5 items-center hover:bg-white/5 transition-colors cursor-pointer group"
                  onClick={() => {
                    setActivePracticeModalQuestion(q);
                    setSelectedPracticeAnswer('');
                    setPracticeSubmissionResult(null);
                  }}
                >
                  <div className="col-span-1 flex items-center" title={q.isSolved ? 'Solved' : 'Unsolved'}>
                    {q.isSolved ? (
                      <Target className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-slate-600 group-hover:border-slate-400 transition-colors" />
                    )}
                  </div>
                  
                  <div className="col-span-5 min-w-0 pr-2">
                    <p className="text-xs font-medium text-slate-200 group-hover:text-cyan-400 transition-colors truncate">
                      {q.title || q.questionText}
                    </p>
                    {q.sourceQuizTitle && (
                      <span className="text-[10px] text-slate-500 block truncate">
                        From: {q.sourceQuizTitle}
                      </span>
                    )}
                  </div>

                  <div className="col-span-3 flex items-center gap-1.5 flex-wrap overflow-hidden">
                    {q.category && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-medium shrink-0">
                        {q.category}
                      </Badge>
                    )}
                    {Array.isArray(q.tags) && q.tags.slice(0, 2).map((t: string) => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 truncate max-w-[90px]">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* XP Reward Badge */}
                  <div className="col-span-1 flex justify-center items-center">
                    <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Zap className="h-2.5 w-2.5 fill-yellow-400" />
                      +{q.xpReward || 25}
                    </span>
                  </div>

                  {/* Community IMP Votes */}
                  <div className="col-span-1 flex justify-center items-center">
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] font-mono flex items-center gap-1 px-1.5 py-0.5 ${
                        q.hasVotedImp 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                          : 'bg-white/5 text-amber-400/80 border-white/10'
                      }`}
                      title={`${q.impVotesCount} students voted this question as Important`}
                    >
                      <Star className={`h-2.5 w-2.5 ${q.hasVotedImp ? 'fill-amber-400' : 'fill-amber-400/40'}`} />
                      {q.impVotesCount || 0}
                    </Badge>
                  </div>

                  <div className="col-span-1 text-right">
                    <span className={`text-xs font-semibold ${
                      q.difficulty?.toLowerCase() === 'easy' ? 'text-emerald-400' : 
                      q.difficulty?.toLowerCase() === 'hard' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {q.difficulty || 'Medium'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Home Page Footer to Full Problemset Page */}
          <div className="p-3 border-t border-white/5 bg-slate-900/40 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing top 5 questions • Each question awards XP
            </span>
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-1 font-semibold h-7"
              onClick={() => navigate('/student/questions')}
            >
              <span>View All Questions</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
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

        {/* Global XP & Real Database Leaderboard */}
        <Card className="bg-card/50 border-white/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-400" /> Global Standings
            </CardTitle>
            {myStandingsStats?.rank && (
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-300 bg-amber-500/10">
                You: #{myStandingsStats.rank}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between mb-5">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-orange-500">{globalXp}</span>
                <span className="text-sm text-muted-foreground font-bold pb-1">XP</span>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Daily Streak</div>
                <div className="text-sm font-bold text-orange-400 flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 fill-orange-400 text-orange-400" />
                  {dailyStreak} Days
                </div>
              </div>
            </div>
            
            <div className="space-y-2.5">
              {globalStandings.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 text-center">Loading standings...</div>
              ) : (
                globalStandings.slice(0, 5).map((player) => (
                  <div 
                    key={player.id} 
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                      player.id === myStandingsStats?.id ? 'bg-cyan-500/10 border border-cyan-500/30' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`font-mono text-xs w-5 font-bold ${
                        player.rank === 1 ? 'text-yellow-400' : 
                        player.rank === 2 ? 'text-slate-300' : 
                        player.rank === 3 ? 'text-amber-500' : 'text-muted-foreground'
                      }`}>
                        #{player.rank}
                      </span>
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center text-[10px] font-bold text-cyan-300 shrink-0">
                        {player.displayName ? player.displayName.slice(0, 2).toUpperCase() : 'ST'}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-200 block truncate max-w-[120px]">
                          {player.displayName}
                          {player.id === myStandingsStats?.id && <span className="text-[10px] text-cyan-400 ml-1 font-normal">(You)</span>}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">{player.eloRating || 1200} ELO</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-yellow-400/90 shrink-0">{player.globalXp} XP</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog for Enrolled Classes/Cohorts */}
      <Dialog open={isCohortsModalOpen} onOpenChange={setIsCohortsModalOpen}>
        <DialogContent className="bg-[#12131a] border-slate-800 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <Users className="h-5 w-5 text-cyan-400" />
              My Enrolled Cohorts & Classes
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              View and manage all classroom cohorts you are currently registered in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar my-2">
            {isLoadingCohorts ? (
              <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs">Loading your enrolled classes...</p>
              </div>
            ) : enrolledClasses.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-3">
                <GraduationCap className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-sm font-medium">You are not enrolled in any cohorts yet.</p>
                <Button 
                  size="sm" 
                  className="bg-primary hover:bg-primary/90 text-white"
                  onClick={() => {
                    setIsCohortsModalOpen(false);
                    navigate('/student/enroll');
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Join a Class with Code
                </Button>
              </div>
            ) : (
              enrolledClasses.map((cls) => (
                <div 
                  key={cls.id}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm text-white truncate">{cls.className}</h4>
                      <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-mono">
                        {cls.classCode}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <span>Instructor:</span>
                      <span className="text-slate-300 font-medium">{cls.teacherName || cls.teachername || 'Prof. Ada Lovelace'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Enrolled: {new Date(cls.enrolledAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-white/10 hover:bg-white/10"
                      onClick={() => {
                        setIsCohortsModalOpen(false);
                        navigate('/student/quizzes');
                      }}
                    >
                      Quizzes
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      title="Unenroll from this cohort"
                      disabled={isUnenrolling === cls.id}
                      onClick={() => handleUnenroll(cls.id, cls.className)}
                    >
                      {isUnenrolling === cls.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-400">Total Enrolled: {enrolledClasses.length}</span>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-dashed border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => {
                setIsCohortsModalOpen(false);
                navigate('/student/enroll');
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Join Another Class
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interactive Solver Dialog for High-Yield IMP Question */}
      <Dialog 
        open={Boolean(activePracticeModalQuestion)} 
        onOpenChange={(open) => {
          if (!open) {
            setActivePracticeModalQuestion(null);
            setSelectedPracticeAnswer('');
            setPracticeSubmissionResult(null);
          }
        }}
      >
        <DialogContent className="bg-[#12131a] border-slate-800 text-white sm:max-w-xl">
          {activePracticeModalQuestion && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-4 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                      {activePracticeModalQuestion.category || 'Algorithms'}
                    </Badge>
                    <Badge 
                      variant="outline"
                      className={`text-xs ${
                        activePracticeModalQuestion.difficulty?.toLowerCase() === 'easy' ? 'text-emerald-400 border-emerald-500/30' :
                        activePracticeModalQuestion.difficulty?.toLowerCase() === 'hard' ? 'text-rose-400 border-rose-500/30' :
                        'text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {activePracticeModalQuestion.difficulty || 'Medium'}
                    </Badge>
                  </div>

                  <Button
                    size="sm"
                    variant={activePracticeModalQuestion.hasVotedImp ? "default" : "outline"}
                    className={`h-7 text-xs flex items-center gap-1.5 transition-all ${
                      activePracticeModalQuestion.hasVotedImp
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                        : 'border-white/10 text-slate-400 hover:text-amber-300 hover:border-amber-500/30'
                    }`}
                    onClick={() => handleToggleImp(activePracticeModalQuestion.id)}
                  >
                    <Star className={`h-3.5 w-3.5 ${activePracticeModalQuestion.hasVotedImp ? 'fill-amber-400 text-amber-400' : ''}`} />
                    {activePracticeModalQuestion.hasVotedImp ? 'Marked IMP ⭐' : 'Mark as IMP'}
                    <span className="font-mono">({activePracticeModalQuestion.impVotesCount || 0})</span>
                  </Button>
                </div>
                <DialogTitle className="text-base text-white font-semibold leading-relaxed pt-2">
                  {activePracticeModalQuestion.questionText}
                </DialogTitle>
                {activePracticeModalQuestion.sourceQuizTitle && (
                  <DialogDescription className="text-slate-400 text-xs">
                    Source Quiz: {activePracticeModalQuestion.sourceQuizTitle}
                  </DialogDescription>
                )}
              </DialogHeader>

              {/* Question Options */}
              <div className="space-y-2.5 my-3">
                {Array.isArray(activePracticeModalQuestion.options) && activePracticeModalQuestion.options.length > 0 ? (
                  activePracticeModalQuestion.options.map((opt: string, idx: number) => {
                    const isSelected = selectedPracticeAnswer === opt;
                    const isCorrect = practiceSubmissionResult?.correctAnswer ? opt === practiceSubmissionResult.correctAnswer : false;

                    let optionBorder = 'border-slate-800 bg-slate-900/60 hover:border-slate-700';
                    if (isSelected) optionBorder = 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300';
                    if (practiceSubmissionResult) {
                      if (practiceSubmissionResult.isCorrect && isSelected) {
                        optionBorder = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300';
                      } else if (!practiceSubmissionResult.isCorrect && isSelected) {
                        optionBorder = 'border-rose-500/60 bg-rose-500/15 text-rose-300';
                      } else if (!practiceSubmissionResult.isCorrect && isCorrect) {
                        optionBorder = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400';
                      }
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (!practiceSubmissionResult) setSelectedPracticeAnswer(opt);
                        }}
                        className={`p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${optionBorder}`}
                      >
                        <span>{opt}</span>
                        {isSelected && !practiceSubmissionResult && (
                          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        )}
                        {practiceSubmissionResult && isSelected && practiceSubmissionResult.isCorrect && (
                          <Check className="h-4 w-4 text-emerald-400" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Type your answer here..."
                      value={selectedPracticeAnswer}
                      onChange={(e) => setSelectedPracticeAnswer(e.target.value)}
                      disabled={Boolean(practiceSubmissionResult)}
                      className="bg-slate-900 border-slate-800 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Submission Result Feedback */}
              {practiceSubmissionResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  practiceSubmissionResult.isCorrect 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <Zap className={`h-4 w-4 shrink-0 mt-0.5 ${practiceSubmissionResult.isCorrect ? 'text-yellow-400' : 'text-rose-400'}`} />
                  <div>
                    <p className="font-bold">
                      {practiceSubmissionResult.isCorrect ? `Correct! +${practiceSubmissionResult.xpGained} XP awarded!` : 'Incorrect!'}
                    </p>
                    {!practiceSubmissionResult.isCorrect && practiceSubmissionResult.correctAnswer && (
                      <p className="text-slate-300 text-[11px] mt-0.5">
                        Correct Answer: <span className="font-semibold text-emerald-400">{practiceSubmissionResult.correctAnswer}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-mono">
                  Points: {activePracticeModalQuestion.points || 50} pts
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-white/10"
                    onClick={() => {
                      setActivePracticeModalQuestion(null);
                      setSelectedPracticeAnswer('');
                      setPracticeSubmissionResult(null);
                    }}
                  >
                    Close
                  </Button>

                  {!practiceSubmissionResult ? (
                    <Button
                      size="sm"
                      disabled={!selectedPracticeAnswer || isSubmittingPractice}
                      className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                      onClick={handlePracticeSubmit}
                    >
                      {isSubmittingPractice ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Submitting...
                        </>
                      ) : (
                        'Check Answer'
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="text-xs bg-primary hover:bg-primary/90 text-white font-medium"
                      onClick={() => {
                        setSelectedPracticeAnswer('');
                        setPracticeSubmissionResult(null);
                      }}
                    >
                      Practice Again
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Daily Challenge Solver Modal (Strictly 1 Attempt Per Day) */}
      <Dialog open={isDailyChallengeModalOpen} onOpenChange={setIsDailyChallengeModalOpen}>
        <DialogContent className="bg-[#12131a] border-slate-800 text-white sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 mb-1">
              <Badge className="bg-primary/20 text-primary border-0 text-xs">Daily Challenge</Badge>
              <div className="flex items-center gap-1.5 text-xs text-orange-400 font-bold bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded-md">
                <Flame className="h-3.5 w-3.5 fill-orange-400" />
                Streak: {dailyStreak} Days
              </div>
            </div>
            <DialogTitle className="text-base text-white pt-1">
              {dailyChallenge?.questionText || "Today's Challenge"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Daily challenges can only be attempted once every 24 hours. Submit your best answer to maintain your daily streak!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 my-3">
            {dailyChallenge?.options && dailyChallenge.options.length > 0 ? (
              dailyChallenge.options.map((opt: string, idx: number) => {
                const userAns = todayDailySubmission?.selectedAnswer || todayDailySubmission?.selectedanswer || dailySubmitResult?.selectedAnswer || selectedDailyAnswer;
                const correctAns = todayDailySubmission?.correctAnswer || dailyChallenge?.correctAnswer || dailySubmitResult?.correctAnswer;
                const isSelected = selectedDailyAnswer === opt || userAns === opt;
                const isSubmitted = hasAttemptedDailyToday || Boolean(dailySubmitResult);
                const isUserAnswer = isSubmitted && userAns === opt;
                const isCorrectOption = isSubmitted && correctAns === opt;
                const isUserCorrect = (todayDailySubmission?.isCorrect ?? dailySubmitResult?.isCorrect);

                let cardStyle = 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700';
                if (isSubmitted) {
                  if (isCorrectOption) {
                    cardStyle = 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200';
                  } else if (isUserAnswer && !isUserCorrect) {
                    cardStyle = 'bg-rose-500/15 border-rose-500/60 text-rose-200';
                  } else {
                    cardStyle = 'bg-slate-900/40 border-slate-800/50 text-slate-500 opacity-60';
                  }
                } else if (isSelected) {
                  cardStyle = 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!isSubmitted) setSelectedDailyAnswer(opt);
                    }}
                    disabled={isSubmitted}
                    className={`w-full text-left p-3 rounded-lg text-xs font-medium transition-all border flex items-center justify-between ${cardStyle}`}
                  >
                    <span className="pr-2">{opt}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSubmitted && isCorrectOption && (
                        <Badge className="bg-emerald-500/30 text-emerald-300 border-0 text-[10px] py-0 px-1.5 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Correct
                        </Badge>
                      )}
                      {isSubmitted && isUserAnswer && !isUserCorrect && (
                        <Badge className="bg-rose-500/30 text-rose-300 border-0 text-[10px] py-0 px-1.5 flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Your Answer
                        </Badge>
                      )}
                      {isSubmitted && isUserAnswer && isUserCorrect && (
                        <Badge className="bg-emerald-500/30 text-emerald-300 border-0 text-[10px] py-0 px-1.5 flex items-center gap-1">
                          Your Answer ✓
                        </Badge>
                      )}
                      {!isSubmitted && (
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <Input
                placeholder="Type your answer..."
                value={selectedDailyAnswer}
                onChange={(e) => setSelectedDailyAnswer(e.target.value)}
                disabled={Boolean(dailySubmitResult) || hasAttemptedDailyToday}
                className="bg-slate-900 border-slate-800 text-xs"
              />
            )}
          </div>

          {/* Daily Submit Feedback / Review State */}
          {(dailySubmitResult || hasAttemptedDailyToday) && (
            <div className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
              (todayDailySubmission?.isCorrect ?? dailySubmitResult?.isCorrect)
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                : 'bg-rose-950/40 border-rose-800/50 text-rose-200'
            }`}>
              <div className="flex items-center gap-1.5 font-bold text-sm">
                {(todayDailySubmission?.isCorrect ?? dailySubmitResult?.isCorrect) ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Solved Correctly! +50 XP Awarded</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-rose-400" />
                    <span>Incorrect Answer Recorded (Streak Maintained)</span>
                  </>
                )}
              </div>
              <div className="text-xs space-y-1 pt-1 border-t border-white/5">
                <p className="text-slate-300">
                  Your Answer:{' '}
                  <span className={`font-semibold ${
                    (todayDailySubmission?.isCorrect ?? dailySubmitResult?.isCorrect) ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {todayDailySubmission?.selectedAnswer || todayDailySubmission?.selectedanswer || dailySubmitResult?.selectedAnswer || selectedDailyAnswer}
                  </span>
                </p>
                {!(todayDailySubmission?.isCorrect ?? dailySubmitResult?.isCorrect) && (todayDailySubmission?.correctAnswer || dailyChallenge?.correctAnswer || dailySubmitResult?.correctAnswer) && (
                  <p className="text-slate-300">
                    Correct Answer:{' '}
                    <span className="font-semibold text-emerald-400">
                      {todayDailySubmission?.correctAnswer || dailyChallenge?.correctAnswer || dailySubmitResult?.correctAnswer}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
            <span className="text-[11px] text-slate-500">
              Reward: +50 XP + Daily Streak
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-white/10"
                onClick={() => setIsDailyChallengeModalOpen(false)}
              >
                Close
              </Button>

              {!dailySubmitResult && !hasAttemptedDailyToday && (
                <Button
                  size="sm"
                  disabled={!selectedDailyAnswer || isSubmittingDaily}
                  className="bg-primary hover:bg-primary/90 text-white font-bold text-xs"
                  onClick={handleDailySubmit}
                >
                  {isSubmittingDaily ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                  Submit Challenge
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
