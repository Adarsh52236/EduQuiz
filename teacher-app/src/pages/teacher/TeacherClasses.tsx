import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Pencil, Plus, Users, Copy, Trash2, Mail, Eye, Award, TrendingUp, BookOpen, Share2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Class {
  id: string;
  name: string;
  description: string;
  classCode: string;
  teacherId: string;
  createdAt: string;
  studentCount?: number;
}

interface Student {
  id: string;
  displayName: string;
  email: string;
}

interface StudentProfileData {
  id: string;
  displayName: string;
  email: string;
  globalXp: number;
  elo: number;
  attempts: any[];
}

export default function TeacherClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
  const [enrolledStudents, setEnrolledStudents] = useState<Record<string, Student[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [showStudents, setShowStudents] = useState(false);
  
  // Unified Student Profile State
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [selectedStudentProfile, setSelectedStudentProfile] = useState<StudentProfileData | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [newClass, setNewClass] = useState({ name: '', description: '' });
  const [editClass, setEditClass] = useState({ id: '', name: '', description: '' });

  useEffect(() => {
    if (!user) return;
    loadClasses();
    const interval = setInterval(() => loadClasses(), 15000);
    return () => clearInterval(interval);
  }, [user]);

  const loadClasses = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/classes', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load classes');
      setClasses(data);

      const counts: Record<string, number> = {};
      const students: Record<string, Student[]> = {};
      for (const cls of data) {
        const enrollmentsResponse = await fetch(`/api/classes/${cls.id}/enrollments`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const enrollmentsData = await enrollmentsResponse.json();
        if (enrollmentsResponse.ok) {
          counts[cls.id] = enrollmentsData.totalStudents ?? enrollmentsData.totalstudents ?? (enrollmentsData.enrollments ? enrollmentsData.enrollments.length : 0);
          students[cls.id] = enrollmentsData.enrollments.map((e: any) => ({
            id: e.studentId,
            displayName: e.studentName,
            email: e.studentEmail,
          }));
        }
      }
      setEnrollmentCounts(counts);
      setEnrolledStudents(students);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load classes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!user || !newClass.name.trim()) return toast.error('Please enter a class name');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newClass.name, description: newClass.description || null, teacherId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success('Class created successfully!');
      setNewClass({ name: '', description: '' });
      setIsCreating(false);
      loadClasses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create class');
    }
  };

  const handleEditClass = async () => {
    if (!user || !editClass.name.trim()) return toast.error('Please enter a class name');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/classes/${editClass.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: editClass.name, description: editClass.description || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success('Class updated successfully!');
      setIsEditing(false);
      loadClasses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update class');
    }
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/classes/${classId}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success('Class deleted successfully!');
      loadClasses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete class');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Class code copied!');
  };

  const handleCopyInviteLink = (code: string) => {
    const inviteUrl = `http://localhost:5173/join/${code}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Student Auto-Enroll invite link copied to clipboard!');
  };

  const viewStudents = (cls: Class) => {
    setSelectedClass(cls);
    setShowStudents(true);
  };

  const openEditDialog = (cls: Class) => {
    setSelectedClass(cls);
    setEditClass({ id: cls.id, name: cls.name, description: cls.description || '' });
    setIsEditing(true);
  };

  const openStudentProfile = async (student: Student) => {
    setShowStudentProfile(true);
    setIsProfileLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Fetch user profile (for XP/Elo)
      const userRes = await fetch(`/api/users/${student.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const userData = await userRes.json();
      
      // Fetch user attempts
      const attemptsRes = await fetch(`/api/attempts`, { headers: { 'Authorization': `Bearer ${token}` } });
      const allAttempts = await attemptsRes.json();
      
      const studentAttempts = Array.isArray(allAttempts) ? allAttempts.filter(a => a.studentId === student.id) : [];

      setSelectedStudentProfile({
        id: student.id,
        displayName: userData.displayName || student.displayName,
        email: userData.email || student.email,
        globalXp: userData.globalXp || 0,
        elo: userData.elo || 1200,
        attempts: studentAttempts
      });
    } catch (err) {
      toast.error('Failed to load student profile');
    } finally {
      setIsProfileLoading(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">My Classes</h2>
          <p className="text-muted-foreground">Create and manage your classroom sections</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Class</DialogTitle>
              <DialogDescription>Create a new class section for your students</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Class Name</Label>
                <Input placeholder="e.g., Mathematics 101" value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea placeholder="Brief description" value={newClass.description} onChange={(e) => setNewClass({ ...newClass, description: e.target.value })} />
              </div>
              <Button onClick={handleCreateClass} className="w-full">Create Class</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No classes yet</h3>
            <p className="text-muted-foreground text-center mb-4">Create your first class to organize students</p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />Create Class
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardHeader>
                <CardTitle>{cls.name}</CardTitle>
                <CardDescription className="line-clamp-2">{cls.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <Badge variant="outline">{enrollmentCounts[cls.id] || 0} students</Badge>
                  </div>
                </div>
                <div className="space-y-3 mt-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Class Code:</span>
                    <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{cls.classCode}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <Link2 className="h-3.5 w-3.5 text-primary" /> Auto-Enroll Link:
                      </span>
                      <button 
                        onClick={() => handleCopyInviteLink(cls.classCode)}
                        className="text-primary hover:underline font-medium text-[11px] flex items-center gap-0.5"
                      >
                        <Share2 className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate select-all bg-white p-1 rounded border">
                      http://localhost:5173/join/{cls.classCode}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => viewStudents(cls)} className="flex-1">
                    <Eye className="h-4 w-4 mr-1" /> View Students
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleCopyInviteLink(cls.classCode)} title="Copy Student Invite Link">
                    <Share2 className="h-4 w-4 text-primary" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleCopyCode(cls.classCode)} title="Copy Code">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(cls)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteClass(cls.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Class Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class Name</Label>
              <Input value={editClass.name} onChange={(e) => setEditClass({ ...editClass, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editClass.description} onChange={(e) => setEditClass({ ...editClass, description: e.target.value })} />
            </div>
            <Button onClick={handleEditClass} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Roster Dialog */}
      <Dialog open={showStudents} onOpenChange={setShowStudents}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Students in {selectedClass?.name}</DialogTitle>
            <DialogDescription>Click a student to view their unified profile</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Share Class Code</Label>
              <div className="flex gap-2">
                <Input value={selectedClass?.classCode || ''} readOnly className="font-mono text-lg font-bold text-center tracking-widest bg-slate-50" />
                <Button onClick={() => handleCopyCode(selectedClass!.classCode)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            
            <ScrollArea className="h-64 rounded-md border p-4 bg-slate-50/50">
              {selectedClass && enrolledStudents[selectedClass.id]?.length > 0 ? (
                <div className="space-y-2">
                  {enrolledStudents[selectedClass.id].map((student) => (
                    <div 
                      key={student.id} 
                      onClick={() => openStudentProfile(student)}
                      className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-100 hover:border-primary/30 cursor-pointer shadow-sm transition-all"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{student.displayName}</p>
                        <p className="text-xs text-slate-500">{student.email}</p>
                      </div>
                      <Eye className="h-4 w-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No students enrolled yet</p>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unified Student Profile Dialog */}
      <Dialog open={showStudentProfile} onOpenChange={setShowStudentProfile}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              Unified Student Profile
            </DialogTitle>
          </DialogHeader>
          
          {isProfileLoading || !selectedStudentProfile ? (
            <div className="flex justify-center p-8"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <div className="space-y-6">
              {/* Top Meta */}
              <div className="flex items-start justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedStudentProfile.displayName}</h3>
                  <p className="text-sm text-slate-500">{selectedStudentProfile.email}</p>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20">Active Student</Badge>
              </div>

              {/* Stats Grid (XP + Elo) */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none shadow-md">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider">Global XP</p>
                      <p className="text-2xl font-bold font-mono">{selectedStudentProfile.globalXp}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-none shadow-md">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-cyan-100 text-sm font-medium uppercase tracking-wider">Arena Elo</p>
                      <p className="text-2xl font-bold font-mono">{selectedStudentProfile.elo}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Grades Section */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-slate-400" /> Recent Grades & Submissions
                </h4>
                <ScrollArea className="h-48 border border-slate-100 rounded-lg">
                  {selectedStudentProfile.attempts.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {selectedStudentProfile.attempts.map((attempt, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Quiz Assessment #{attempt.quizId.slice(0,6)}</p>
                            <p className="text-xs text-slate-500">Submitted: {new Date(attempt.completedAt || attempt.createdAt || Date.now()).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-mono font-bold text-slate-900">{attempt.score ?? 0}/{attempt.totalPoints || 100}</p>
                            <p className="text-xs text-slate-400">Score</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No grades or submissions recorded for this student yet.
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
