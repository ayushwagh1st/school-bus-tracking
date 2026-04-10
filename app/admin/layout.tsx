'use client';

import { useAuth } from '@/components/auth-provider';
import { logOut } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Bus, Users, FileText, LogOut, LayoutDashboard, Map } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Live Map', href: '/admin/map', icon: Map },
    { name: 'Drivers', href: '/admin/drivers', icon: Bus },
    { name: 'Students', href: '/admin/students', icon: Users },
    { name: 'Reports', href: '/admin/reports', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <div className="md:hidden h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center">
          <div className="p-2 bg-indigo-50 rounded-xl mr-3">
            <Bus className="w-5 h-5 text-indigo-600" strokeWidth={2.5} />
          </div>
          <span className="font-extrabold text-slate-900 tracking-tight text-lg">Admin Portal</span>
        </div>
        <Button variant="ghost" size="icon" onClick={logOut} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 h-10 w-10 rounded-full transition-colors">
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      {/* Sidebar (Desktop) */}
      <div className="hidden md:flex flex-col flex-shrink-0 w-72 h-[calc(100vh-2rem)] m-4 bg-slate-900 rounded-[2rem] shadow-2xl shadow-indigo-900/10 border border-slate-800 relative overflow-hidden z-20">
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none"></div>
        <div className="h-24 flex items-center px-8 relative z-10">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg border border-indigo-400/30 mr-4 transform hover:scale-105 transition-transform">
            <Bus className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-black text-xl text-white tracking-tight">Admin<span className="text-indigo-400">Portal</span></span>
        </div>
        
        <div className="px-5 py-4 space-y-2 flex-1 relative z-10 overflow-y-auto custom-scrollbar">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <span className={cn(
                  "flex items-center px-4 py-3.5 text-sm font-semibold rounded-xl transition-all duration-300 group",
                  isActive 
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
                )}>
                  <item.icon className={cn(
                    "w-5 h-5 mr-4 transition-transform duration-300", 
                    isActive ? "text-indigo-400" : "text-slate-500 group-hover:scale-110 group-hover:text-slate-300"
                  )} strokeWidth={isActive ? 2.5 : 2} />
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
        
        <div className="p-5 mt-auto relative z-10">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center px-1">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-lg mr-3 shadow-lg ring-2 ring-slate-900">
                {user?.displayName?.charAt(0) || 'A'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{user?.displayName || 'Administrator'}</p>
                <p className="text-xs text-slate-400 truncate font-medium">{user?.email}</p>
              </div>
            </div>
            <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 h-11 rounded-xl transition-colors font-semibold" onClick={logOut}>
              <LogOut className="w-4 h-4 mr-3" strokeWidth={2.5} />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto md:h-screen scroll-smooth">
        <div className="p-4 md:p-8 md:pt-12 max-w-7xl mx-auto pb-32 md:pb-12">
          {children}
        </div>
      </div>

      {/* Bottom Navigation (Mobile Floating Dock) */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 bg-white/90 backdrop-blur-2xl border border-slate-200/50 rounded-[2rem] flex justify-around items-center h-16 px-2 z-40 shadow-[0_8px_30px_rgb(0,0,0,0.12)] supports-[backdrop-filter]:bg-white/60">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.name} href={item.href} className="relative flex flex-col items-center justify-center w-14 h-14 group">
              {isActive && (
                <div className="absolute inset-0 bg-indigo-50 rounded-2xl -z-10 transition-all duration-300 transform scale-90"></div>
              )}
              <item.icon className={cn(
                "w-5 h-5 mb-1 transition-all duration-300", 
                isActive ? "text-indigo-600 scale-110" : "text-slate-400 group-hover:text-indigo-400"
              )} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn(
                "text-[9px] font-bold tracking-wide transition-all duration-300", 
                isActive ? "text-indigo-600" : "text-slate-400 opacity-0 transform translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
