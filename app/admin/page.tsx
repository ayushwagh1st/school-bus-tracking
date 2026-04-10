'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { Users, Bus, Activity, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth-provider';

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalDrivers: 0,
    todayLogs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user || role !== 'admin') return;
      try {
        const studentsSnap = await getDocs(collection(db, 'students'));
        const driversSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'driver')));
        
        const today = format(new Date(), 'yyyy-MM-dd');
        const logsSnap = await getDocs(query(collection(db, 'tracking_logs'), where('date', '==', today)));

        setStats({
          totalStudents: studentsSnap.size,
          totalDrivers: driversSnap.size,
          todayLogs: logsSnap.size,
        });
      } catch (error) {
        console.error("Error fetching stats", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, role]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div className="bg-white/80 backdrop-blur-2xl border border-white p-8 sm:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-3">Dashboard</h1>
          <p className="text-slate-500 font-medium text-base">Overview of your transport system.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-400/10 rounded-full blur-2xl -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Students</h3>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100/50 shadow-sm">
              <Users className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>
          <div className="relative z-10 flex items-baseline gap-2">
            <span className="text-5xl font-black text-slate-900 tracking-tighter">
              {loading ? '-' : stats.totalStudents}
            </span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400/10 rounded-full blur-2xl -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Drivers</h3>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/50 shadow-sm">
              <Bus className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>
          <div className="relative z-10 flex items-baseline gap-2">
            <span className="text-5xl font-black text-slate-900 tracking-tighter">
              {loading ? '-' : stats.totalDrivers}
            </span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 w-40 h-40 bg-sky-400/10 rounded-full blur-2xl -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Today&apos;s Logs</h3>
            <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100/50 shadow-sm">
              <Activity className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-baseline gap-3">
            <span className="text-5xl font-black text-slate-900 tracking-tighter">
              {loading ? '-' : stats.todayLogs}
            </span>
            <span className="text-xs font-bold tracking-wide text-sky-600 flex items-center bg-sky-50 px-3 py-1.5 rounded-full ring-1 ring-sky-200 w-fit">
              <ArrowUpRight className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} /> Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
