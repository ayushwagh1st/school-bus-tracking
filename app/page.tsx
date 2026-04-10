'use client';

import { useState } from 'react';
import { signInWithGoogle } from '@/firebase';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bus, ShieldCheck, ArrowRight, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Logged in successfully');
    } catch (error) {
      toast.error('Failed to login with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    
    setLoading(true);
    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Logged in successfully');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden font-sans">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-400/20 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10s]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-rose-400/20 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[12s]"></div>
      <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-sky-400/20 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-[420px] relative z-10">
        <div className="bg-white/70 backdrop-blur-3xl border border-white/80 rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] transition-all duration-300 hover:shadow-[0_16px_60px_-15px_rgba(0,0,0,0.1)]">
          
          <div className="text-center space-y-6 mb-10">
            <div className="flex justify-center">
              <div className="relative group">
                <div className="absolute inset-0 bg-indigo-500/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative p-4 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl shadow-xl border border-indigo-400/30 transform group-hover:scale-105 transition-all duration-500">
                  <Bus className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">Student Transit</h1>
              <p className="text-slate-500 text-sm font-medium">Secure portal for admins & drivers</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div className="space-y-4">
                <div className="relative group">
                  <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" strokeWidth={2} />
                  <Input 
                    type="email" 
                    placeholder="Email address" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 bg-white/50 border-slate-200/60 text-slate-900 placeholder:text-slate-400 h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium backdrop-blur-sm shadow-sm hover:bg-white"
                    required
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" strokeWidth={2} />
                  <Input 
                    type="password" 
                    placeholder="Password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 bg-white/50 border-slate-200/60 text-slate-900 placeholder:text-slate-400 h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium backdrop-blur-sm shadow-sm hover:bg-white"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 text-base font-bold rounded-xl shadow-[0_4px_14px_0_rgba(15,23,42,0.2)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.23)] hover:-translate-y-0.5 transition-all duration-200" 
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>
            </form>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase font-bold tracking-wider">
                <span className="bg-gradient-to-b from-white/90 to-white px-3 text-slate-400 rounded-full">Or continue with</span>
              </div>
            </div>

            <Button 
              type="button"
              className="w-full bg-white hover:bg-slate-50 text-slate-700 h-12 text-base font-bold rounded-xl shadow-sm border border-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" 
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <ShieldCheck className="w-5 h-5 mr-2 text-indigo-500" strokeWidth={2.5} />
              Sign in with Google
            </Button>
            
            <div className="pt-6 border-t border-slate-200/60 text-center space-y-4">
              <Link href="/parent" className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 font-bold transition-colors group">
                Parents: Track your child's bus 
                <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </div>
        
        <p className="text-center text-xs font-semibold text-slate-400 mt-8 tracking-wide">
          STUDENT TRANSIT PLATFORM
        </p>
      </div>
    </div>
  );
}
