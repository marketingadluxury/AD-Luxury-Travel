import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { Role } from '../types';

interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  company_name: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signOut: async () => {},
  updateProfile: async () => {},
  updatePassword: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      let profileData = data as UserProfile | null;

      // Fallback if profile doesn't exist (e.g., registered before trigger)
      if (error && error.code === 'PGRST116') {
        const isDefaultAdmin = email === 'marketing@adluxury.net' || email === 'marketing.adluxury@gmail.com';
        const newProfile = {
          id: userId,
          full_name: email || 'Người dùng',
          phone: '',
          company_name: '',
          role: (isDefaultAdmin ? 'admin' : 'CTV') as Role
        };
        await supabase.from('profiles').insert([newProfile]);
        profileData = newProfile as UserProfile;
      }

      if (profileData) {
        // Auto-assign admin role to marketing@adluxury.net and fallback email
        const isDefaultAdmin = email === 'marketing@adluxury.net' || email === 'marketing.adluxury@gmail.com';
        if (isDefaultAdmin) {
          if (profileData.role !== 'admin') {
             await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);
          }
          profileData.role = 'admin';
        }
        setProfile(profileData);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!error) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id, session.user.email);
        }
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (newProfile: Partial<UserProfile>) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update(newProfile)
      .eq('id', user.id);
    
    if (error) throw error;
    setProfile(prev => prev ? { ...prev, ...newProfile } : null);
  };

  const updatePassword = async (password: string) => {
    const isPlaceholder = (import.meta as any).env.VITE_SUPABASE_URL?.includes('placeholder') || !(import.meta as any).env.VITE_SUPABASE_URL;
    if (isPlaceholder) {
      console.log('Mật khẩu mới (Offline Mock):', password);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, updateProfile, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
