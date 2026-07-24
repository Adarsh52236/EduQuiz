import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@/types';
import { API_BASE_URL } from '@/config/api';

interface AuthContextType {
  user: User | null;
  authUser: any;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, role: 'teacher' | 'student', displayName: string) => Promise<void>;
  signIn: (email: string, password: string, role: 'teacher' | 'student') => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (!response.ok) {
            let errorMessage = 'Failed to fetch user data';
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorMessage;
            } catch (jsonError) {
              errorMessage = response.statusText || errorMessage;
            }
            console.error(errorMessage);
            localStorage.removeItem('token');
            setUser(null);
            setAuthUser(null);
            setIsAuthenticated(false);
          } else {
            const data = await response.json();
            setUser(data.user);
            setAuthUser(data.user);
            setIsAuthenticated(true);
          }
        } else {
          setUser(null);
          setAuthUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        localStorage.removeItem('token');
        setUser(null);
        setAuthUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const signUp = async (email: string, password: string, role: 'teacher' | 'student', displayName: string) => {
    try {
      // Client-side validation
      if (!email || !password || !role || !displayName) {
        throw new Error('All fields are required');
      }
      
      const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }
      
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      if (displayName.trim().length < 2) {
        throw new Error('Display name must be at least 2 characters long');
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, displayName }),
      });
      
      if (!response.ok) {
        let errorMessage = 'Sign up failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          // If response is not JSON, use status text or a generic message
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      // Parse response to get userId if available
      let responseData;
      try {
        responseData = await response.json();
      } catch {
        // Response might not have a body
        responseData = null;
      }
      
      return responseData;

    } catch (error: any) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string, role: 'teacher' | 'student') => {
    try {
      // Client-side validation
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });
      
      if (!response.ok) {
        let errorMessage = 'Sign in failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Validate response data
      if (!data.token || !data.user) {
        throw new Error('Invalid response from server');
      }
      
      // Store token and update state
      localStorage.setItem('token', data.token);
      setUser(data.user);
      setAuthUser(data.user);
      setIsAuthenticated(true);
      

      
      return data;
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Only try to call signout API if we have a token
        const response = await fetch(`${API_BASE_URL}/api/auth/signout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        // Don't throw error if signout fails - we still want to clear local data
        if (!response.ok) {
          console.warn('Sign out API call failed, but clearing local data anyway');
        }
      }
    } catch (error) {
      console.error('Sign out API error:', error);
      // Continue with local cleanup even if API call fails
    } finally {
      // Always clear local data
      localStorage.removeItem('token');
      setUser(null);
      setAuthUser(null);
      setIsAuthenticated(false);
      
      // Redirect to login page and reload
      window.location.href = '/';
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) throw new Error('No user logged in');
    console.log('Mock updateProfile called with:', data);
    // In a real backend, you would make an API call here
    setUser({ ...user, ...data });
    return Promise.resolve();
  };

  return (
    <AuthContext.Provider value={{
      user,
      authUser,
      isLoading,
      isAuthenticated,
      signUp,
      signIn,
      signOut,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}