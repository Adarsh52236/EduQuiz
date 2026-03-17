import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Pencil, Plus, Users, Copy, Trash2, Mail, Eye } from 'lucide-react';
import { Class, User } from '@/types';
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
  classCode: string; // Changed from 'code' to 'classCode' to match backend
  teacherId: string;
  createdAt: string;
  studentCount?: number;
}

interface Student {
  id: string;
  displayName: string; // Changed from 'name' to 'displayName' to match backend
  email: string;
  // joinedAt: string; // Not directly used in this component
}

export default function TeacherClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
  const [enrolledStudents, setEnrolledStudents] = useState<Record<string, Student[]>>({}); // Changed type to Student[]
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // New state for editing dialog
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [showStudents, setShowStudents] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [newClass, setNewClass] = useState({
    name: '',
    description: ''
  });
  const [editClass, setEditClass] = useState({ // New state for editing class
    id: '',
    name: '',
    description: ''
  });

  useEffect(() => {
    if (!user) return;
    loadClasses();

    const interval = setInterval(() => {
      loadClasses();
    }, 15000); // Refresh every 15 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, [user]);

  const loadClasses = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/classes', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load classes');
      setClasses(data);

      // Load enrollment counts and students for each class
      const counts: Record<string, number> = {};
      const students: Record<string, Student[]> = {}; // Changed type to Student[]
      for (const cls of data) {
        const enrollmentsResponse = await fetch(`/api/classes/${cls.id}/enrollments`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const enrollmentsData = await enrollmentsResponse.json(); // Expecting { enrollments, totalStudents }
        if (enrollmentsResponse.ok) {
          counts[cls.id] = enrollmentsData.totalStudents;
          students[cls.id] = enrollmentsData.enrollments.map((e: any) => ({
            id: e.studentId,
            displayName: e.studentName,
            email: e.studentEmail,
            // Add other student properties if available in the enrollment object
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

  const generateClassCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateClass = async () => {
    if (!user || !newClass.name.trim()) {
      toast.error('Please enter a class name');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newClass.name,
          description: newClass.description || null,
          // classCode: generateClassCode(), // Backend generates classCode
          teacherId: user.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create class');
      toast.success('Class created successfully!');
      setNewClass({ name: '', description: '' });
      setIsCreating(false);
      loadClasses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create class');
    }
  };

  const handleEditClass = async () => { // New function for editing class
    if (!user || !editClass.name.trim()) {
      toast.error('Please enter a class name');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/classes/${editClass.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editClass.name,
          description: editClass.description || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update class');
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
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete class');
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

  const handleInviteStudent = async (classId: string) => {
    if (!selectedClass) return; // Ensure a class is selected

    // Instead of sending an email, copy the class code and instruct the teacher to share it.
    navigator.clipboard.writeText(selectedClass.classCode);
    toast.success(`Class code "${selectedClass.classCode}" copied to clipboard! Share it with your students.`);
    setInviteEmail(''); // Clear the input field
  };

  const viewStudents = (cls: Class) => {
    setSelectedClass(cls);
    setShowStudents(true);
  };

  const openEditDialog = (cls: Class) => { // New function to open edit dialog
    setSelectedClass(cls);
    setEditClass({ id: cls.id, name: cls.name, description: cls.description || '' });
    setIsEditing(true);
  };

  if (isLoading) return <div className="flex items-center justify-center h-full">Loading...</div>;

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
              <Plus className="mr-2 h-4 w-4" />
              Create Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Class</DialogTitle>
              <DialogDescription>Create a new class section for your students</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">Class Name</Label>
                <Input
                  id="class-name"
                  placeholder="e.g., Mathematics 101"
                  value={newClass.name}
                  onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-description">Description (Optional)</Label>
                <Textarea
                  id="class-description"
                  placeholder="Brief description of the class"
                  value={newClass.description}
                  onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                />
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
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Class Code:</span>
                    <span className="font-mono font-medium">{cls.classCode}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">{new Date(cls.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                      size="sm"
                      onClick={() => viewStudents(cls)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Students
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyCode(cls.classCode)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(cls)} // Edit button
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClass(cls.id)}
                      className="text-red-600 hover:text-red-700"
                    >
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
            <DialogDescription>Modify the name and description of your class</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-class-name">Class Name</Label>
              <Input
                id="edit-class-name"
                placeholder="e.g., Mathematics 101"
                value={editClass.name}
                onChange={(e) => setEditClass({ ...editClass, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-class-description">Description (Optional)</Label>
              <Textarea
                id="edit-class-description"
                placeholder="Brief description of the class"
                value={editClass.description}
                onChange={(e) => setEditClass({ ...editClass, description: e.target.value })}
              />
            </div>
            <Button onClick={handleEditClass} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showStudents} onOpenChange={setShowStudents}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Students in {selectedClass?.name}</DialogTitle>
            <DialogDescription>Manage students and send invitations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Invite Student by Email</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="student@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Button onClick={() => handleInviteStudent(selectedClass!.id)}>
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <ScrollArea className="h-64 rounded-md border p-4">
              {selectedClass && enrolledStudents[selectedClass.id]?.length > 0 ? (
                <div className="space-y-2">
                  {enrolledStudents[selectedClass.id].map((student) => (
                    <div key={student.id} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                      <div>
                        <p className="font-medium">{student.displayName}</p>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </div>
                      <Badge variant="secondary">Enrolled</Badge>
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
    </div>
  );
}
