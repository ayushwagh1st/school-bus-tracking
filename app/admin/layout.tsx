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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden h-14 flex items-center justify-between px-4 bg-indigo-950 border-b border-indigo-900/50 sticky top-0 z-20">
        <div className="flex items-center">
          <Bus className="w-5 h-5 text-indigo-400 mr-2" />
          <span className="font-bold text-white tracking-tight">Admin Portal</span>
        </div>
        <Button variant="ghost" size="icon" onClick={logOut} className="text-indigo-200 hover:text-white hover:bg-indigo-900 h-8 w-8">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      {/* Sidebar (Desktop) */}
      <div className="hidden md:flex w-64 bg-indigo-950 text-slate-300 flex-shrink-0 flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b border-indigo-900/50 bg-indigo-950">
          <Bus className="w-6 h-6 text-indigo-400 mr-2" />
          <span className="font-bold text-lg text-white tracking-tight">Admin Portal</span>
        </div>
        <div className="p-4 space-y-1 flex-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <span className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200",
                  isActive ? "bg-indigo-900 text-white shadow-sm" : "text-indigo-200 hover:bg-indigo-900/50 hover:text-white"
                )}>
                  <item.icon className={cn("w-5 h-5 mr-3", isActive ? "text-indigo-400" : "text-indigo-400/70")} />
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="p-4 mt-auto border-t border-indigo-900/50 bg-indigo-950/50">
          <div className="flex items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-indigo-800 flex items-center justify-center text-indigo-100 font-bold mr-3 shadow-inner">
              {user?.displayName?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.displayName}</p>
              <p className="text-xs text-indigo-300 truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-indigo-200 hover:text-white hover:bg-indigo-900" onClick={logOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </div>

      {/* Bottom Navigation (Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-2 z-20 pb-safe">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.name} href={item.href} className="flex-1 flex flex-col items-center justify-center h-full">
              <item.icon className={cn("w-5 h-5 mb-1", isActive ? "text-indigo-600" : "text-slate-400")} />
              <span className={cn("text-[10px] font-medium", isActive ? "text-indigo-600" : "text-slate-500")}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
