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
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 -mx-4 -mt-4 p-6 sm:mx-0 sm:mt-0 sm:rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Dashboard</h1>
          <p className="text-indigo-200 text-sm">Overview of your transport system.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white/60 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/50 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Students</h3>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {loading ? '-' : stats.totalStudents}
            </span>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/50 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Drivers</h3>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Bus className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {loading ? '-' : stats.totalDrivers}
            </span>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-100/50 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Today&apos;s Logs</h3>
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {loading ? '-' : stats.todayLogs}
            </span>
            <span className="text-sm font-medium text-sky-600 flex items-center bg-sky-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
