'use client';

import { useAuth } from '@/components/auth-provider';
import { logOut } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Bus, LogOut } from 'lucide-react';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-indigo-950 border-b border-indigo-900/50 h-14 flex items-center justify-between px-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center">
          <Bus className="w-5 h-5 text-indigo-400 mr-2" />
          <span className="font-bold text-white tracking-tight">Driver Portal</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium text-indigo-100">{user?.displayName?.split(' ')[0]}</span>
          <Button variant="ghost" size="icon" onClick={logOut} className="text-indigo-200 hover:text-white hover:bg-indigo-900 h-8 w-8">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-md mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
