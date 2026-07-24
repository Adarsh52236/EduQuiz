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
import { LogOut, User, Swords, Shield } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

interface StudentLayoutProps {
  children: ReactNode;
}

export function StudentLayout({ children }: StudentLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'P1';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2);
  };

  // Currently we mock the Elo / Global XP in the navbar until Context is updated
  const mockElo = 1200; 

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-background/80 backdrop-blur-md flex items-center justify-between px-6 z-50 shrink-0">
        <Link to="/student/dashboard" className="flex items-center gap-2 group">
          <div className="bg-primary/20 p-2 rounded-lg group-hover:bg-primary/30 transition-colors">
            <Swords className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight">OmniPrep</span>
        </Link>
        
        <div className="flex items-center gap-6">
          
          {/* Elo Badge */}
          <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1">
            <Shield className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-bold text-cyan-400">{mockElo} ELO</span>
          </div>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 border border-white/10 hover:border-primary/50 transition-colors">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/20 text-primary font-bold">
                    {getInitials(user?.displayName || null)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-white/10">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.displayName || 'Player 1'}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => navigate('/student/profile')} className="hover:bg-white/5 cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Player Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content Space */}
      <main className="flex-1 overflow-hidden relative">
        {/* Ambient glow in background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        
        {children}
      </main>
    </div>
  );
}
