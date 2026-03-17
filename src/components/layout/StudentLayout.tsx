import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LayoutDashboard, BookOpen, Users, Award, LogOut, User, GraduationCap, Bell, BarChart3, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';

interface StudentLayoutProps {
  children: ReactNode;
}

export function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasClasses, setHasClasses] = useState<boolean | null>(null);

  const navigation = [
    { name: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { name: 'Quizzes', href: '/student/quizzes', icon: BookOpen },
    { name: 'Analytics', href: '/student/analytics', icon: BarChart3 },
    { name: 'Connections', href: '/student/connections', icon: Users },
    { name: 'Grade Card', href: '/student/grade-card', icon: Award },
  ];

  // Check if student has enrolled in any classes
  useEffect(() => {
    const checkEnrollments = async () => {
      if (!user) {
        setHasClasses(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/enrollments', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const enrollments = await response.json();
          setHasClasses(enrollments.length > 0);
        } else {
          setHasClasses(false);
        }
      } catch (error) {
        console.error('Error checking enrollments:', error);
        setHasClasses(false);
      }
    };

    // Check enrollments immediately when component mounts or location changes
    checkEnrollments();
    
    // Only poll for enrollment updates on dashboard and quizzes pages, not during quiz taking
    const isQuizTakingPage = location.pathname.includes('/student/quiz/') && location.pathname.includes('/take');
    const shouldPoll = location.pathname === '/student/dashboard' || 
                      location.pathname === '/student/quizzes' || 
                      location.pathname === '/student/enroll';
    
    if (shouldPoll && !isQuizTakingPage) {
      // Set up polling interval only on allowed pages
      const interval = setInterval(checkEnrollments, 30000); // Reduced frequency to 30 seconds
      return () => clearInterval(interval);
    }
  }, [user, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'S';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 h-screen flex flex-col bg-sidebar-background text-sidebar-foreground">
        <div className="h-16 border-b border-sidebar-border flex items-center px-6">
          <Link to="/student/dashboard" className="flex items-center gap-2 text-lg font-bold">
            <GraduationCap className="h-6 w-6 text-sidebar-primary" />
            <span>EduQuiz</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground/70 hover:bg-accent/50 hover:text-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          
          {/* Join Classroom Button - Only shows when student has at least one class (for joining additional classes) */}
          {hasClasses === true && (
            <Link
              to="/student/enroll"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors',
                location.pathname === '/student/enroll'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground/70 hover:bg-accent/50 hover:text-accent-foreground'
              )}
            >
              <UserPlus className="h-5 w-5" />
              <span>Join Classroom</span>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-2 px-3 hover:bg-sidebar-accent"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                    {getInitials(user?.displayName || null)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-sm">
                  <span className="font-medium">{user?.displayName || 'Student'}</span>
                  <span className="text-xs text-sidebar-foreground/70">{user?.email}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/student/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 h-screen flex flex-col">
        <header className="h-16 border-b flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold">
            {navigation.find(item => item.href === location.pathname)?.name || 'EduQuiz'}
          </h1>
          <div className="ml-auto flex items-center space-x-4">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
