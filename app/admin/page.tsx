'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { Users, Bus, Activity, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth-provider';

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalDrivers: 0,
    todayLogs: 0,
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user || role !== 'admin') return;
      try {
        const studentsSnap = await getDocs(collection(db, 'students'));
        const driversSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'driver')));
        
        const today = format(new Date(), 'yyyy-MM-dd');
        const logsSnap = await getDocs(query(collection(db, 'tracking_logs'), where('date', '==', today)));

        const studentMap: Record<string, string> = {};
        studentsSnap.forEach(d => { studentMap[d.id] = d.data().name; });
        
        const driverMap: Record<string, string> = {};
        driversSnap.forEach(d => { driverMap[d.id] = d.data().name; });

        const logsList = logsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          studentName: studentMap[doc.data().studentId] || 'Unknown Student',
          driverName: driverMap[doc.data().driverId] || 'Unknown Driver',
        }));
        
        // Sort newest first
        logsList.sort((a: any, b: any) => {
          const tA = a.timestamp?.toMillis?.() || 0;
          const tB = b.timestamp?.toMillis?.() || 0;
          return tB - tA;
        });

        setRecentLogs(logsList.slice(0, 15)); // top 15

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

      {/* Recent Activity Feed */}
      <div className="mt-8 bg-white/70 backdrop-blur-2xl border border-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100/60 bg-white/50 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
              <Clock className="w-6 h-6 mr-3 text-indigo-500" strokeWidth={2.5} />
              Recent Tracking Activity
            </h2>
            <p className="text-slate-500 font-medium text-sm mt-1">Live feed of all today's bus updates.</p>
          </div>
        </div>
        
        <div className="p-4 sm:p-8">
          {loading ? (
            <div className="flex justify-center items-center h-40">
               <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-3xl border border-slate-100 border-dashed">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-lg font-bold text-slate-600">No activity yet today</p>
              <p className="text-slate-400 font-medium text-sm mt-1">Logs will appear here once tracking begins.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentLogs.map((log) => (
                <div key={log.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 shrink-0 border border-indigo-100/50">
                      <CheckCircle2 className="w-6 h-6" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h4 className="font-black tracking-tight text-slate-900 text-lg flex flex-wrap items-center gap-2">
                        {log.studentName}
                        <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/50">
                          {log.status?.replace(/_/g, ' ')}
                        </span>
                      </h4>
                      <p className="text-sm text-slate-500 font-semibold mt-1 flex flex-wrap items-center gap-2">
                        <span className="flex items-center">
                          <Bus className="w-4 h-4 mr-1.5 text-slate-400" /> {log.driverName}
                        </span>
                        {log.message && (
                          <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 flex items-center">
                            Note: {log.message}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right sm:min-w-[120px]">
                    <div className="text-slate-700 font-bold bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 inline-flex items-center shadow-inner">
                      <Clock className="w-4 h-4 mr-2 text-indigo-400" strokeWidth={2.5} />
                      {new Date(log.timestamp?.toMillis?.() || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
