import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Mail, 
  Calendar, 
  Award, 
  BookOpen, 
  TrendingUp, 
  Clock,
  Edit3,
  Save,
  X,
  Camera,
  Shield,
  Key,
  Bell,
  Palette
} from 'lucide-react';
import { toast } from 'sonner';

interface StudentStats {
  totalQuizzes: number;
  averageScore: number;
  totalTimeSpent: number;
  bestScore: number;
  classesCount: number;
  rank: number;
}

interface StudentProfile {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatar: string;
  bio: string;
  grade: string;
  dateOfBirth: string;
  phone: string;
  address: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      push: boolean;
      quizReminders: boolean;
    };
    privacy: {
      showProfile: boolean;
      showScores: boolean;
    };
  };
  createdAt: string;
}

export default function StudentProfile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [stats, setStats] = useState<StudentStats>({
    totalQuizzes: 0,
    averageScore: 0,
    totalTimeSpent: 0,
    bestScore: 0,
    classesCount: 0,
    rank: 0
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<StudentProfile | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadStats();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${user?.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Map backend user data to profile format
        const profileData: StudentProfile = {
          id: data.id || user?.id || '',
          email: data.email || user?.email || '',
          displayName: data.displayName || user?.displayName || '',
          firstName: data.displayName?.split(' ')[0] || '',
          lastName: data.displayName?.split(' ').slice(1).join(' ') || '',
          avatar: data.avatar || '',
          bio: data.bio || '',
          grade: data.grade || '',
          dateOfBirth: data.dateOfBirth ? (data.dateOfBirth.split('T')[0] || data.dateOfBirth) : '',
          phone: data.phone || '',
          address: data.address || '',
          preferences: {
            theme: 'system',
            notifications: {
              email: true,
              push: true,
              quizReminders: true
            },
            privacy: {
              showProfile: true,
              showScores: false
            }
          },
          createdAt: data.createdAt || ''
        };
        setProfile(profileData);
        setEditedProfile(profileData);
      } else {
        // Use current user data as fallback
        const fallbackProfile: StudentProfile = {
          id: user?.id || '1',
          email: user?.email || 'student@example.com',
          displayName: user?.displayName || 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          avatar: '',
          bio: 'Passionate learner with a love for science and mathematics. Always eager to take on new challenges and improve my skills.',
          grade: '11th Grade',
          dateOfBirth: '2007-03-15',
          phone: '+1 (555) 123-4567',
          address: '123 Education St, Learning City, LC 12345',
          preferences: {
            theme: 'system',
            notifications: {
              email: true,
              push: true,
              quizReminders: true
            },
            privacy: {
              showProfile: true,
              showScores: false
            }
          },
          createdAt: '2023-09-01'
        };
        setProfile(fallbackProfile);
        setEditedProfile(fallbackProfile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch attempts to calculate stats
      const attemptsResponse = await fetch(`/api/attempts?isCompleted=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Fetch enrollments for classes count
      const enrollmentsResponse = await fetch(`/api/enrollments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (attemptsResponse.ok && enrollmentsResponse.ok) {
        const attempts = await attemptsResponse.json();
        const enrollments = await enrollmentsResponse.json();
        
        const totalQuizzes = attempts.length;
        const totalScore = attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0);
        const totalPossiblePoints = attempts.reduce((sum: number, a: any) => sum + (a.totalPoints || 0), 0);
        const averageScore = totalPossiblePoints > 0 ? Math.round((totalScore / totalPossiblePoints) * 100) : 0;
        const totalTimeSpent = attempts.reduce((sum: number, a: any) => sum + (a.timeTaken || 0), 0);
        const bestScore = attempts.length > 0 
          ? Math.max(...attempts.map((a: any) => totalPossiblePoints > 0 ? (a.score / a.totalPoints) * 100 : 0))
          : 0;
        
        setStats({
          totalQuizzes,
          averageScore,
          totalTimeSpent: Math.round(totalTimeSpent / 60), // Convert to minutes
          bestScore: Math.round(bestScore),
          classesCount: enrollments.length,
          rank: 0 // Can be calculated from leaderboard if needed
        });
      } else {
        // Use fallback stats
        setStats({
          totalQuizzes: 0,
          averageScore: 0,
          totalTimeSpent: 0,
          bestScore: 0,
          classesCount: 0,
          rank: 0
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats({
        totalQuizzes: 0,
        averageScore: 0,
        totalTimeSpent: 0,
        bestScore: 0,
        classesCount: 0,
        rank: 0
      });
    }
  };

  const handleSave = async () => {
    if (!editedProfile) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: editedProfile.displayName,
          bio: editedProfile.bio,
          avatar: editedProfile.avatar,
          grade: editedProfile.grade,
          phone: editedProfile.phone,
          address: editedProfile.address,
          dateOfBirth: editedProfile.dateOfBirth
        })
      });
      
      if (response.ok) {
        const updatedData = await response.json();
        const updatedProfile: StudentProfile = {
          ...editedProfile,
          ...updatedData
        };
        setProfile(updatedProfile);
        setEditedProfile(updatedProfile);
        if (updateUser) {
          updateUser(updatedData);
        }
        toast.success('Profile updated successfully!');
        setIsEditing(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const handleInputChange = (field: keyof StudentProfile | string, value: any) => {
    if (!editedProfile) return;
    
    if (field.includes('.')) {
      const parts = field.split('.');
      if (parts.length === 2) {
        const [parent, child] = parts;
        setEditedProfile({
          ...editedProfile,
          [parent]: {
            ...(editedProfile[parent as keyof StudentProfile] as any),
            [child]: value
          }
        });
      } else if (parts.length === 3) {
        const [parent, child, subChild] = parts;
        setEditedProfile({
          ...editedProfile,
          [parent]: {
            ...(editedProfile[parent as keyof StudentProfile] as any),
            [child]: {
              ...(editedProfile[parent as keyof StudentProfile] as any)[child],
              [subChild]: value
            }
          }
        });
      }
    } else {
      setEditedProfile({
        ...editedProfile,
        [field]: value
      });
    }
  };

  const formatTimeSpent = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center">Profile not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">My Profile</h2>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Profile Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={isEditing ? editedProfile?.avatar : profile.avatar} />
                <AvatarFallback className="text-xl">
                  {getInitials(isEditing ? editedProfile?.displayName || '' : profile.displayName)}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
                  onClick={() => toast.info('Avatar upload coming soon!')}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="flex-1 space-y-2">
              {isEditing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={editedProfile?.firstName || ''}
                      onChange={(e) => {
                        const firstName = e.target.value;
                        const lastName = editedProfile?.lastName || '';
                        handleInputChange('displayName', `${firstName} ${lastName}`.trim());
                        handleInputChange('firstName', firstName);
                      }}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={editedProfile?.lastName || ''}
                      onChange={(e) => {
                        const lastName = e.target.value;
                        const firstName = editedProfile?.firstName || '';
                        handleInputChange('displayName', `${firstName} ${lastName}`.trim());
                        handleInputChange('lastName', lastName);
                      }}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-2xl font-bold">{profile.displayName}</h3>
                  <p className="text-muted-foreground">{profile.grade}</p>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {profile.email}
              </div>
              
              {isEditing ? (
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    value={editedProfile?.bio || ''}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell us about yourself..."
                    className="w-full p-3 border rounded-md resize-none"
                    rows={3}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {profile.bio || 'No bio added yet.'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Quizzes Completed</CardTitle>
                <BookOpen className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.totalQuizzes}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.averageScore}%</div>
                <Progress value={stats.averageScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Study Time</CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatTimeSpent(stats.totalTimeSpent)}</div>
                <p className="text-xs text-muted-foreground mt-1">Total time spent</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Your recent accomplishments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Award className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="font-medium">Quiz Master</p>
                    <p className="text-sm text-muted-foreground">Completed {stats.totalQuizzes} quizzes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-medium">High Achiever</p>
                    <p className="text-sm text-muted-foreground">Best score: {stats.bestScore}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="grade">Grade</Label>
                  {isEditing ? (
                    <Input
                      id="grade"
                      value={editedProfile?.grade || ''}
                      onChange={(e) => handleInputChange('grade', e.target.value)}
                      placeholder="Enter your grade"
                    />
                  ) : (
                    <Input id="grade" value={profile.grade} disabled className="bg-muted" />
                  )}
                </div>
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  {isEditing ? (
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={editedProfile?.dateOfBirth || ''}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    />
                  ) : (
                    <Input 
                      id="dateOfBirth" 
                      value={new Date(profile.dateOfBirth).toLocaleDateString()} 
                      disabled 
                      className="bg-muted" 
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      value={editedProfile?.phone || ''}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="Enter phone number"
                    />
                  ) : (
                    <Input id="phone" value={profile.phone} disabled className="bg-muted" />
                  )}
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  {isEditing ? (
                    <Input
                      id="address"
                      value={editedProfile?.address || ''}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Enter address"
                    />
                  ) : (
                    <Input id="address" value={profile.address} disabled className="bg-muted" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Customize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Theme</Label>
                <div className="flex gap-2 mt-2">
                  {['light', 'dark', 'system'].map((theme) => (
                    <Button
                      key={theme}
                      variant={isEditing ? 
                        (editedProfile?.preferences.theme === theme ? "default" : "outline") :
                        (profile.preferences.theme === theme ? "default" : "outline")
                      }
                      onClick={() => isEditing && handleInputChange('preferences.theme', theme)}
                      disabled={!isEditing}
                      className="capitalize"
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      {theme}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Notifications</Label>
                <div className="space-y-3 mt-2">
                  {[
                    { key: 'email', label: 'Email notifications', icon: Mail },
                    { key: 'push', label: 'Push notifications', icon: Bell },
                    { key: 'quizReminders', label: 'Quiz reminders', icon: BookOpen }
                  ].map(({ key, label, icon: Icon }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </div>
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={editedProfile?.preferences.notifications[key as keyof typeof editedProfile.preferences.notifications] || false}
                          onChange={(e) => handleInputChange(`preferences.notifications.${key}`, e.target.checked)}
                          className="rounded"
                        />
                      ) : (
                        <Badge variant={profile.preferences.notifications[key as keyof typeof profile.preferences.notifications] ? "default" : "secondary"}>
                          {profile.preferences.notifications[key as keyof typeof profile.preferences.notifications] ? 'Enabled' : 'Disabled'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Privacy</Label>
                <div className="space-y-3 mt-2">
                  {[
                    { key: 'showProfile', label: 'Show profile to others' },
                    { key: 'showScores', label: 'Show scores publicly' }
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span>{label}</span>
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={editedProfile?.preferences.privacy[key as keyof typeof editedProfile.preferences.privacy] || false}
                          onChange={(e) => handleInputChange(`preferences.privacy.${key}`, e.target.checked)}
                          className="rounded"
                        />
                      ) : (
                        <Badge variant={profile.preferences.privacy[key as keyof typeof profile.preferences.privacy] ? "default" : "secondary"}>
                          {profile.preferences.privacy[key as keyof typeof profile.preferences.privacy] ? 'Public' : 'Private'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Change Password</p>
                    <p className="text-sm text-muted-foreground">Update your account password</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Change</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}