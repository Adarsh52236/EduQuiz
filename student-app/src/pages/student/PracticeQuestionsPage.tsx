import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Code, 
  Search, 
  Star, 
  CheckCircle2, 
  Circle, 
  Zap, 
  Flame, 
  Loader2, 
  ArrowLeft,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';

export default function PracticeQuestionsPage() {
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // User Stats
  const [streakCount, setStreakCount] = useState<number>(0);
  const [globalXp, setGlobalXp] = useState<number>(0);

  // Solver Modal State
  const [activeQuestion, setActiveQuestion] = useState<any | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [submissionResult, setSubmissionResult] = useState<{
    isCorrect: boolean;
    xpGained: number;
    alreadySolved?: boolean;
    correctAnswer?: string;
    message?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        category: selectedCategory,
        difficulty: selectedDifficulty
      });
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const [questionsRes, categoriesRes, dailyRes] = await Promise.all([
        fetch(`/api/practice/questions?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/practice/categories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/practice/daily-challenge`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (questionsRes.ok) {
        const data = await questionsRes.json();
        setQuestions(Array.isArray(data) ? data : []);
      }
      if (categoriesRes.ok) {
        const catData = await categoriesRes.json();
        setCategories(catData.counts || []);
      }
      if (dailyRes.ok) {
        const dailyData = await dailyRes.json();
        setStreakCount(dailyData.streakCount || 0);
        setGlobalXp(dailyData.globalXp || 0);
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
      toast.error('Failed to load practice questions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [selectedCategory, selectedDifficulty]);

  const handleToggleImp = async (questionId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/practice/questions/${questionId}/rate-imp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(prev => prev.map(q => {
          if (q.id === questionId) {
            return {
              ...q,
              hasVotedImp: data.hasVotedImp,
              impVotesCount: data.impVotesCount
            };
          }
          return q;
        }));
        if (activeQuestion && activeQuestion.id === questionId) {
          setActiveQuestion((prev: any) => ({
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

  const handleSubmitAnswer = async () => {
    if (!activeQuestion || !selectedAnswer) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionId: activeQuestion.id,
          answer: selectedAnswer
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissionResult(data);
        if (data.isCorrect) {
          if (data.xpGained > 0) {
            toast.success(`Correct! +${data.xpGained} XP awarded!`);
            setGlobalXp(prev => prev + data.xpGained);
          } else {
            toast.success(`Correct! (XP already claimed previously)`);
          }
          setQuestions(prev => prev.map(q => {
            if (q.id === activeQuestion.id) {
              return { ...q, isSolved: true };
            }
            return q;
          }));
        } else {
          toast.error('Incorrect. Check the correct answer shown below.');
        }
      }
    } catch (err) {
      toast.error('Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter questions based on status
  const filteredQuestions = questions.filter(q => {
    if (selectedStatus === 'Solved') return q.isSolved;
    if (selectedStatus === 'Unsolved') return !q.isSolved;
    return true;
  });

  const solvedCount = questions.filter(q => q.isSolved).length;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <button 
            type="button" 
            onClick={() => navigate('/student/dashboard')}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Code className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Problemset / Practice Hub</h1>
              <p className="text-xs text-muted-foreground">
                Community-verified high-yield questions (≥10 student votes) categorized by AI with XP rewards.
              </p>
            </div>
          </div>
        </div>

        {/* Live Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 shadow-sm">
            <Flame className="h-4 w-4 text-orange-400 animate-pulse fill-orange-400" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 leading-none">Daily Streak</div>
              <div className="text-sm font-black text-orange-400">{streakCount} Days</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 shadow-sm">
            <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 leading-none">Global XP</div>
              <div className="text-sm font-black text-yellow-400">{globalXp} XP</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 leading-none">Solved</div>
              <div className="text-sm font-black text-emerald-400">{solvedCount} / {questions.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills (LeetCode Explore Bar) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategory('All')}
          className={`text-xs px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all border ${
            selectedCategory === 'All'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
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
              className={`text-xs px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all border flex items-center gap-2 ${
                selectedCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <span>{cat}</span>
              {count > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadQuestions();
            }}
            placeholder="Search problems by keywords or concepts..."
            className="h-10 pl-9 text-xs bg-slate-900/80 border-slate-800 placeholder:text-slate-500 focus-visible:ring-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Difficulty Filter */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="h-10 px-3 text-xs bg-slate-900/80 border border-slate-800 rounded-md text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="All">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 px-3 text-xs bg-slate-900/80 border border-slate-800 rounded-md text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Solved">Solved</option>
            <option value="Unsolved">Unsolved</option>
          </select>

          <Button 
            size="sm" 
            variant="outline"
            className="h-10 text-xs border-slate-800 bg-slate-900/60 hover:bg-slate-800"
            onClick={loadQuestions}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Problems Table */}
      <Card className="bg-[#0b0c10]/90 border-slate-800 overflow-hidden shadow-xl">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 p-4 border-b border-slate-800 text-xs font-semibold text-slate-400 bg-black/40">
          <div className="col-span-1">Status</div>
          <div className="col-span-5">Title & Problem Statement</div>
          <div className="col-span-3">Category & Topics</div>
          <div className="col-span-1 text-center">XP Reward</div>
          <div className="col-span-1 text-center">IMP Votes</div>
          <div className="col-span-1 text-right">Difficulty</div>
        </div>

        <div className="divide-y divide-slate-800/80">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <p className="text-xs">Loading community-qualified questions...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 px-4">
              <BookOpen className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-300">No questions found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No questions match your current filters. Try resetting the filters or check back as more questions qualify through student consensus!
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-4 text-xs border-slate-800"
                onClick={() => {
                  setSelectedCategory('All');
                  setSelectedDifficulty('All');
                  setSelectedStatus('All');
                  setSearchQuery('');
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            filteredQuestions.map((q) => (
              <div 
                key={q.id} 
                className="grid grid-cols-12 gap-3 p-4 items-center hover:bg-white/[0.03] transition-colors cursor-pointer group"
                onClick={() => {
                  setActiveQuestion(q);
                  setSelectedAnswer('');
                  setSubmissionResult(null);
                }}
              >
                {/* Solved Status */}
                <div className="col-span-1 flex items-center" title={q.isSolved ? 'Solved' : 'Unsolved'}>
                  {q.isSolved ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  )}
                </div>

                {/* Question Title */}
                <div className="col-span-5 pr-2">
                  <div className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors line-clamp-1">
                    {q.questionText}
                  </div>
                  {q.sourceQuizTitle && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      From: {q.sourceQuizTitle}
                    </div>
                  )}
                </div>

                {/* Category & Tags */}
                <div className="col-span-3 flex flex-wrap gap-1.5 items-center">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-cyan-950/40 text-cyan-400 border-cyan-800/40">
                    {q.category}
                  </Badge>
                  {q.tags && q.tags.slice(0, 2).map((tag: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-slate-800/80 text-slate-400 border-0">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* XP Reward Badge */}
                <div className="col-span-1 text-center">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-md">
                    <Zap className="h-3 w-3 fill-yellow-400" />
                    +{q.xpReward || 25} XP
                  </span>
                </div>

                {/* IMP Votes (Consensus >= 10) */}
                <div className="col-span-1 text-center">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {q.impVotesCount}
                  </span>
                </div>

                {/* Difficulty */}
                <div className="col-span-1 text-right">
                  <span className={`text-xs font-medium capitalize ${
                    q.difficulty?.toLowerCase() === 'easy' ? 'text-emerald-400' :
                    q.difficulty?.toLowerCase() === 'medium' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {q.difficulty}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Practice Question Solver Modal */}
      <Dialog open={!!activeQuestion} onOpenChange={(open) => !open && setActiveQuestion(null)}>
        <DialogContent className="bg-[#12131a] border-slate-800 text-white sm:max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-cyan-950/40 text-cyan-400 border-cyan-800/40">
                  {activeQuestion?.category}
                </Badge>
                <span className={`text-xs font-semibold uppercase ${
                  activeQuestion?.difficulty?.toLowerCase() === 'easy' ? 'text-emerald-400' :
                  activeQuestion?.difficulty?.toLowerCase() === 'medium' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {activeQuestion?.difficulty}
                </span>
                <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Zap className="h-3 w-3 fill-yellow-400" /> +{activeQuestion?.xpReward || 25} XP
                </span>
              </div>

              {/* Toggle IMP Star */}
              <button
                type="button"
                onClick={() => handleToggleImp(activeQuestion?.id)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors border ${
                  activeQuestion?.hasVotedImp
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${activeQuestion?.hasVotedImp ? 'text-amber-400 fill-amber-400' : ''}`} />
                <span>{activeQuestion?.impVotesCount} IMP</span>
              </button>
            </div>

            <DialogTitle className="text-base text-white pt-2 leading-relaxed">
              {activeQuestion?.questionText}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Select the correct answer to verify your understanding and claim your XP reward.
            </DialogDescription>
          </DialogHeader>

          {/* Multiple Choice Options */}
          <div className="space-y-2.5 my-3">
            {activeQuestion?.options && activeQuestion.options.length > 0 ? (
              activeQuestion.options.map((opt: string, idx: number) => {
                const isSelected = selectedAnswer === opt;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!submissionResult) setSelectedAnswer(opt);
                    }}
                    disabled={!!submissionResult}
                    className={`w-full text-left p-3 rounded-lg text-xs font-medium transition-all border flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <span>{opt}</span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <Input
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                placeholder="Type your answer here..."
                disabled={!!submissionResult}
                className="bg-slate-900 border-slate-800 text-xs"
              />
            )}
          </div>

          {/* Submission Result Feedback */}
          {submissionResult && (
            <div className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
              submissionResult.isCorrect 
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                : 'bg-rose-950/40 border-rose-800/50 text-rose-200'
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                {submissionResult.isCorrect ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>{submissionResult.alreadySolved ? 'Solved! (XP Claimed Previously)' : `Correct! +${submissionResult.xpGained} XP Earned`}</span>
                  </>
                ) : (
                  <>
                    <Circle className="h-4 w-4 text-rose-400" />
                    <span>Incorrect Answer</span>
                  </>
                )}
              </div>
              {!submissionResult.isCorrect && submissionResult.correctAnswer && (
                <p className="text-slate-300 text-xs">
                  Correct Answer: <span className="font-mono font-semibold text-emerald-400">{submissionResult.correctAnswer}</span>
                </p>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveQuestion(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </Button>

            {!submissionResult ? (
              <Button
                size="sm"
                onClick={handleSubmitAnswer}
                disabled={!selectedAnswer || isSubmitting}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                Submit Answer
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedAnswer('');
                  setSubmissionResult(null);
                }}
                className="text-xs border-slate-700"
              >
                Try Again
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
