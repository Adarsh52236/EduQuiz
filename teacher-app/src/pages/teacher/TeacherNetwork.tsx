import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Share2, Copy, Search, UserPlus, Check, X, Trophy, BookOpen, ExternalLink, Loader2, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function TeacherNetwork() {
  const { user } = useAuth();
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [sharedQuizzes, setSharedQuizzes] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [myQuizzes, setMyQuizzes] = useState<any[]>([]);
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tournament creation modal state
  const [isTournamentOpen, setIsTournamentOpen] = useState(false);
  const [tournamentForm, setTournamentForm] = useState({
    title: '',
    description: '',
    quizId: '',
    selectedClassIds: [] as string[]
  });

  // Share quiz modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedQuizToShare, setSelectedQuizToShare] = useState('');
  const [selectedColleagueToShare, setSelectedColleagueToShare] = useState('');

  useEffect(() => {
    loadNetworkData();
    loadSharedQuizzes();
    loadTournaments();
    loadMyQuizzesAndClasses();
  }, []);

  const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  });

  const loadNetworkData = async () => {
    try {
      const res = await fetch('/api/teachers', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setColleagues(data.colleagues || []);
        setIncomingRequests(data.incomingRequests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSharedQuizzes = async () => {
    try {
      const res = await fetch('/api/teachers/quizzes/shared-with-me', { headers: getHeaders() });
      if (res.ok) setSharedQuizzes(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadTournaments = async () => {
    try {
      const res = await fetch('/api/tournaments', { headers: getHeaders() });
      if (res.ok) setTournaments(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadMyQuizzesAndClasses = async () => {
    try {
      const [qRes, cRes] = await Promise.all([
        fetch('/api/quizzes', { headers: getHeaders() }),
        fetch('/api/classes', { headers: getHeaders() })
      ]);
      if (qRes.ok) setMyQuizzes(await qRes.json());
      if (cRes.ok) setMyClasses(await cRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchTeachers = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`/api/teachers?search=${encodeURIComponent(searchQuery)}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.discoverTeachers || []);
      }
    } catch (e) {
      toast.error('Search failed');
    }
  };

  const handleConnect = async (colleagueId: string) => {
    try {
      const res = await fetch('/api/teachers/connect', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ colleagueId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Connection invite sent!');
      handleSearchTeachers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to send invite');
    }
  };

  const handleRespondRequest = async (connectionId: string, action: 'accepted' | 'rejected') => {
    try {
      const res = await fetch('/api/teachers/respond', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ connectionId, action })
      });
      if (!res.ok) throw new Error('Action failed');
      toast.success(`Request ${action}`);
      loadNetworkData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleShareQuiz = async () => {
    if (!selectedQuizToShare || !selectedColleagueToShare) {
      return toast.error('Select both a quiz and colleague');
    }
    try {
      const res = await fetch('/api/teachers/quizzes/share', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ quizId: selectedQuizToShare, colleagueId: selectedColleagueToShare })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Quiz shared with colleague!');
      setIsShareModalOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to share quiz');
    }
  };

  const handleCloneQuiz = async (sourceQuizId: string) => {
    try {
      const res = await fetch('/api/teachers/quizzes/clone', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ sourceQuizId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Quiz cloned into your library!');
      loadMyQuizzesAndClasses();
    } catch (e: any) {
      toast.error(e.message || 'Clone failed');
    }
  };

  const handleCreateTournament = async () => {
    if (!tournamentForm.title || !tournamentForm.quizId || tournamentForm.selectedClassIds.length === 0) {
      return toast.error('Please enter title, select a quiz, and pick at least one class');
    }

    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: tournamentForm.title,
          description: tournamentForm.description,
          quizId: tournamentForm.quizId,
          classIds: tournamentForm.selectedClassIds
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('🏆 Inter-Class Tournament launched!');
      setIsTournamentOpen(false);
      loadTournaments();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create tournament');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Colleague Network & Tournaments</h2>
          <p className="text-muted-foreground">Collaborate with fellow educators, share question banks, and host inter-class competitions.</p>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => setIsShareModalOpen(true)} variant="outline" className="shadow-sm">
            <Share2 className="mr-2 h-4 w-4 text-primary" /> Share Quiz
          </Button>
          <Button onClick={() => setIsTournamentOpen(true)} className="bg-primary hover:bg-primary/90 text-white shadow-sm">
            <Trophy className="mr-2 h-4 w-4" /> Create Tournament
          </Button>
        </div>
      </div>

      <Tabs defaultValue="colleagues" className="w-full">
        <TabsList className="bg-slate-100 p-1 mb-6 border">
          <TabsTrigger value="colleagues">Colleagues ({colleagues.length})</TabsTrigger>
          <TabsTrigger value="shared">Shared Quizzes ({sharedQuizzes.length})</TabsTrigger>
          <TabsTrigger value="tournaments">Tournaments ({tournaments.length})</TabsTrigger>
          <TabsTrigger value="discover">Discover Educators</TabsTrigger>
        </TabsList>

        {/* TAB 1: COLLEAGUES */}
        <TabsContent value="colleagues" className="space-y-6">
          {incomingRequests.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
              <h3 className="font-semibold text-blue-900 text-sm">Pending Connection Requests</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {incomingRequests.map((req) => (
                  <div key={req.connectionId} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-xs">
                    <div>
                      <p className="font-semibold text-sm">{req.senderName}</p>
                      <p className="text-xs text-muted-foreground">{req.senderEmail} • {req.department || 'Faculty'}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => handleRespondRequest(req.connectionId, 'accepted')} className="h-8 bg-green-600 hover:bg-green-700 text-white">
                        <Check className="h-4 w-4" /> Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleRespondRequest(req.connectionId, 'rejected')} className="h-8 text-red-600">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {colleagues.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-14 w-14 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold">No Teacher Connections Yet</h3>
                <p className="text-muted-foreground text-sm max-w-sm mb-4">Connect with colleagues in your department to co-teach, share quizzes, and run tournaments.</p>
                <Button variant="outline" onClick={() => (document.querySelector('[value="discover"]') as HTMLElement)?.click()}>
                  <Search className="mr-2 h-4 w-4" /> Find Colleagues
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {colleagues.map((col) => (
                <Card key={col.colleagueId} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{col.colleagueName}</CardTitle>
                        <CardDescription>{col.colleagueEmail}</CardDescription>
                      </div>
                      <Badge variant="secondary">{col.department || 'Educator'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground mb-3">Connected Colleague</p>
                    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => {
                      setSelectedColleagueToShare(col.colleagueId);
                      setIsShareModalOpen(true);
                    }}>
                      <Share2 className="h-3.5 w-3.5 mr-1 text-primary" /> Share Assessment
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: SHARED QUIZZES */}
        <TabsContent value="shared" className="space-y-4">
          {sharedQuizzes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="h-14 w-14 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold">No Shared Quizzes</h3>
                <p className="text-muted-foreground text-sm max-w-sm">When fellow educators share quizzes with you, they will appear here to clone into your own classes.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sharedQuizzes.map((quiz) => (
                <Card key={quiz.shareId} className="border shadow-xs">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{quiz.title}</CardTitle>
                        <CardDescription>Created by: <span className="font-semibold text-slate-800">{quiz.sharedByName}</span> ({quiz.sharedByEmail})</CardDescription>
                      </div>
                      <Badge variant="outline">{quiz.totalPoints} Points</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-600 line-clamp-2">{quiz.description || 'No description provided.'}</p>
                    <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-3">
                      <span>Time Limit: {quiz.timeLimit ? `${quiz.timeLimit} mins` : 'Untimed'}</span>
                      <Button size="sm" onClick={() => handleCloneQuiz(quiz.quizId)} className="bg-primary hover:bg-primary/90 text-white">
                        <Copy className="h-3.5 w-3.5 mr-1" /> Clone to My Quizzes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: TOURNAMENTS */}
        <TabsContent value="tournaments" className="space-y-4">
          {tournaments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Trophy className="h-14 w-14 text-amber-500/80 mb-3" />
                <h3 className="text-lg font-semibold">No Inter-Class Tournaments Active</h3>
                <p className="text-muted-foreground text-sm max-w-sm mb-4">Set up a tournament to pit multiple classes against each other in a unified assessment showdown.</p>
                <Button onClick={() => setIsTournamentOpen(true)}>
                  <Trophy className="mr-2 h-4 w-4" /> Create First Tournament
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {tournaments.map((t) => (
                <Card key={t.id} className="border shadow-xs hover:border-primary/40 transition-colors">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-amber-500" />
                          {t.title}
                        </CardTitle>
                        <CardDescription>Host: {t.creatorName} • Quiz: {t.quizTitle}</CardDescription>
                      </div>
                      <Badge className="bg-amber-100 text-amber-900 border-amber-200">{t.status.toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-600">{t.description || 'Inter-class competitive exam.'}</p>
                    <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-3">
                      <span>Participating Classes: {t.classCount || 2}</span>
                      <Button size="sm" variant="outline" onClick={() => toast.info('Tournament standings visible as students submit answers')}>
                        View Standings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 4: DISCOVER */}
        <TabsContent value="discover" className="space-y-4">
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="Search teachers by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchTeachers()}
            />
            <Button onClick={handleSearchTeachers}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {searchResults.map((t) => (
              <Card key={t.id} className="p-4 flex items-center justify-between border shadow-xs">
                <div>
                  <p className="font-semibold text-sm">{t.displayName}</p>
                  <p className="text-xs text-muted-foreground">{t.email}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">{t.department || 'Faculty'}</Badge>
                </div>
                <Button size="sm" onClick={() => handleConnect(t.id)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Connect
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* SHARE QUIZ DIALOG */}
      <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Quiz with Colleague</DialogTitle>
            <DialogDescription>Select an assessment from your library and choose which teacher colleague to share it with.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Assessment</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={selectedQuizToShare}
                onChange={(e) => setSelectedQuizToShare(e.target.value)}
              >
                <option value="">-- Choose Quiz --</option>
                {myQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>{q.title} ({q.totalPoints || 0} pts)</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Select Teacher Colleague</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={selectedColleagueToShare}
                onChange={(e) => setSelectedColleagueToShare(e.target.value)}
              >
                <option value="">-- Choose Colleague --</option>
                {colleagues.map((c) => (
                  <option key={c.colleagueId} value={c.colleagueId}>{c.colleagueName} ({c.colleagueEmail})</option>
                ))}
              </select>
            </div>

            <Button onClick={handleShareQuiz} className="w-full bg-primary hover:bg-primary/90 text-white mt-2">
              Confirm & Share
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CREATE TOURNAMENT DIALOG */}
      <Dialog open={isTournamentOpen} onOpenChange={setIsTournamentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Launch Inter-Class Tournament
            </DialogTitle>
            <DialogDescription>Create a competitive showdown between multiple class sections on a single assessment.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tournament Title</Label>
              <Input
                placeholder="e.g. Fall 2026 STEM Grand Championship"
                value={tournamentForm.title}
                onChange={(e) => setTournamentForm({ ...tournamentForm, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Select Quiz Assessment</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={tournamentForm.quizId}
                onChange={(e) => setTournamentForm({ ...tournamentForm, quizId: e.target.value })}
              >
                <option value="">-- Select Quiz --</option>
                {myQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Participating Class Cohorts</Label>
              <div className="max-h-36 overflow-y-auto space-y-2 p-2 border rounded-md bg-slate-50">
                {myClasses.map((cls) => (
                  <label key={cls.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tournamentForm.selectedClassIds.includes(cls.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTournamentForm({
                          ...tournamentForm,
                          selectedClassIds: checked
                            ? [...tournamentForm.selectedClassIds, cls.id]
                            : tournamentForm.selectedClassIds.filter((id) => id !== cls.id)
                        });
                      }}
                      className="rounded text-primary"
                    />
                    <span>{cls.name} <span className="text-xs text-muted-foreground font-mono">({cls.classCode})</span></span>
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={handleCreateTournament} className="w-full bg-primary hover:bg-primary/90 text-white mt-3">
              Deploy Tournament
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
