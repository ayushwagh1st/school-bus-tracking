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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/50 backdrop-blur-2xl border border-slate-800/50 rounded-3xl p-8 shadow-2xl">
          <div className="text-center space-y-6 mb-8">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/30 rounded-2xl blur-xl"></div>
                <div className="relative p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg border border-indigo-400/30">
                  <Bus className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Student Transit</h1>
              <p className="text-slate-400 text-sm">Secure access for administrators and drivers.</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input 
                    type="email" 
                    placeholder="Email address" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-11"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input 
                    type="password" 
                    placeholder="Password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-11"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-base font-semibold rounded-xl transition-all duration-200" 
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-700"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-400">Or continue with</span>
              </div>
            </div>

            <Button 
              type="button"
              className="w-full bg-white hover:bg-slate-100 text-slate-900 shadow-lg shadow-white/10 h-11 text-base font-semibold rounded-xl group transition-all duration-200" 
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <ShieldCheck className="w-5 h-5 mr-2 text-indigo-600" />
              Sign in with Google
            </Button>
            
            <div className="pt-4 border-t border-slate-800/50 text-center space-y-4">
              <Link href="/parent" className="inline-flex items-center text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Are you a parent? Track your child&apos;s bus <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
              <p className="text-xs text-slate-500">
                Protected by enterprise-grade security.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
