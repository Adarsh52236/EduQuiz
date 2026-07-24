import { ReactNode } from 'react';
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
import { LayoutDashboard, BookOpen, Users, BarChart3, LogOut, User, Building2, Search, Settings, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/teacher/dashboard', icon: LayoutDashboard },
    { name: 'Curriculum', href: '/teacher/quizzes', icon: BookOpen },
    { name: 'Cohorts', href: '/teacher/classes', icon: Users },
    { name: 'Analytics', href: '/teacher/analytics', icon: BarChart3 },
  ];

  const secondaryNav = [
    { name: 'Settings', href: '#', icon: Settings },
    { name: 'Support', href: '#', icon: HelpCircle },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Enterprise Sidebar */}
      <aside className="w-[260px] h-screen flex flex-col bg-slate-900 text-slate-300 border-r border-slate-800 shadow-xl z-20 shrink-0 transition-all duration-300">
        <div className="h-14 border-b border-slate-800/50 flex items-center px-4 bg-slate-950/50">
          <Link to="/teacher/dashboard" className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-md">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-[15px] font-semibold text-white tracking-wide">OmniPrep Admin</span>
          </Link>
        </div>

        <div className="px-4 py-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Core Operations</div>
          <nav className="space-y-0.5">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'hover:bg-slate-800/50 hover:text-white'
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="px-4 py-2 mt-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">System</div>
          <nav className="space-y-0.5">
            {secondaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-white transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="p-4 mt-2 border-t border-slate-800/50 bg-slate-950/30">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-2 px-2 hover:bg-slate-800 text-left"
              >
                <Avatar className="h-8 w-8 border border-slate-700">
                  <AvatarFallback className="bg-slate-800 text-slate-200 text-xs font-semibold">
                    {getInitials(user?.displayName || null)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start overflow-hidden flex-1">
                  <span className="text-sm font-medium text-slate-200 truncate w-full">{user?.displayName || 'Administrator'}</span>
                  <span className="text-[11px] text-slate-500 truncate w-full">{user?.email}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200 shadow-xl">
              <DropdownMenuLabel className="font-semibold text-slate-900">Admin Controls</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem onClick={() => navigate('/teacher/profile')} className="text-slate-700 focus:bg-slate-50 cursor-pointer">
                <User className="mr-2 h-4 w-4" /> Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" /> Terminate Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-lg font-semibold text-slate-800 tracking-tight">
              {navigation.find(item => location.pathname.startsWith(item.href))?.name || 'Dashboard'}
            </h1>
            <div className="hidden md:flex items-center text-slate-400 text-sm">
              <span className="mx-2">/</span>
              <span>Overview</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center relative">
              <Search className="h-4 w-4 absolute left-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search cohorts, students..." 
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <NotificationBell />
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
