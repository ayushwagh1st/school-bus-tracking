'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bus, MapPin, Search, AlertCircle, RefreshCw, Clock, Activity, CheckCircle2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-slate-100 animate-pulse rounded-2xl" />
});

export default function ParentPortal() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Sibling Support States
  const [students, setStudents] = useState<any[]>([]);
  const [busLocations, setBusLocations] = useState<Record<string, any>>({});
  const [studentStatuses, setStudentStatuses] = useState<Record<string, any>>({});
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStudentStatus = async (studentId: string) => {
    try {
      const q = query(collection(db, 'tracking_logs'), where('studentId', '==', studentId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const logs = snapshot.docs.map(d => d.data());
        logs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        setStudentStatuses(prev => ({ ...prev, [studentId]: logs[0] }));
      }
    } catch (e) {
      console.error(`Failed to fetch status for student ${studentId}:`, e);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    
    setLoading(true);
    setError('');
    setStudents([]);
    setStudentStatuses({});
    setBusLocations({});
    
    try {
      const q = query(collection(db, 'students'), where('parentPhone', '==', phone));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setError('No student found with this phone number.');
        setLoading(false);
        return;
      }
      
      const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsData);
      
      // Fetch statuses for all siblings
      studentsData.forEach(s => fetchStudentStatus(s.id));
    } catch (err) {
      console.error(err);
      setError('An error occurred while searching.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (students.length === 0) return;

    // Get unique driver IDs to avoid redundant listeners
    const driverIds = Array.from(new Set(students.map(s => s.driverId).filter(Boolean)));
    const unsubs: (() => void)[] = [];

    driverIds.forEach((driverId: any) => {
      const q = query(collection(db, 'bus_locations'), where('driverId', '==', driverId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          const now = new Date().getTime();
          const timestamp = data.timestamp?.toMillis?.() || 0;
          
          // Only show if updated in the last 30 minutes
          if (now - timestamp < 30 * 60 * 1000) {
            setBusLocations(prev => ({ ...prev, [driverId]: data }));
          } else {
            setBusLocations(prev => {
              const updated = { ...prev };
              delete updated[driverId];
              return updated;
            });
          }
        }
      });
      unsubs.push(unsubscribe);
    });

    return () => unsubs.forEach(unsub => unsub());
  }, [students]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all(students.map(s => fetchStudentStatus(s.id)));
    // Artificial delay for satisfying UI feedback
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-900 via-indigo-900/90 to-transparent pointer-events-none z-0"></div>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute top-40 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
      
      <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-8 relative z-10 pt-12 md:pt-20">
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md text-white mb-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 transform hover:scale-105 transition-transform duration-300">
            <Bus className="w-10 h-10" strokeWidth={2} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">Parent Portal</h1>
          <p className="text-indigo-100 font-medium text-lg max-w-sm mx-auto">Track your child&apos;s school bus in real-time.</p>
        </div>

        {students.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-2xl p-6 md:p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white relative overflow-hidden group hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-all duration-300">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none transition-transform duration-700 group-hover:scale-150"></div>
            <form onSubmit={handleSearch} className="space-y-6 relative z-10">
              <div>
                <label className="block text-sm font-bold tracking-wide text-slate-700 mb-3 ml-1 uppercase">Registered Phone Number</label>
                <div className="relative group/input">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-indigo-300 group-focus-within/input:text-indigo-600 transition-colors duration-300" strokeWidth={2} />
                  <Input 
                    type="tel" 
                    placeholder="e.g., 9876543210" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-14 h-16 text-xl rounded-2xl bg-slate-50 border-transparent focus-visible:ring-4 focus-visible:ring-indigo-100 focus-visible:border-indigo-400 focus:bg-white font-semibold transition-all duration-300 shadow-inner"
                    required
                  />
                </div>
              </div>
              {error && (
                <div className="flex items-center text-red-600 text-sm font-medium bg-red-50/80 backdrop-blur-md p-4 rounded-xl border border-red-100 !my-4">
                  <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" strokeWidth={2.5} />
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full h-16 text-lg font-bold bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl shadow-[0_4px_14px_0_rgba(15,23,42,0.15)] hover:shadow-[0_6px_25px_rgba(79,70,229,0.3)] transition-all duration-300 transform hover:-translate-y-1 active:scale-[0.98]" disabled={loading}>
                {loading ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div> : 'Find My Child'}
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-8 relative z-10">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white/40 backdrop-blur-xl p-4 rounded-3xl border border-white/50 mb-4">
              <p className="text-white font-bold px-4 py-2 bg-indigo-900/40 rounded-2xl border border-white/10 mb-3 sm:mb-0">
                Found {students.length} sibling(s)
              </p>
              <Button variant="outline" onClick={() => setStudents([])} className="rounded-xl font-bold h-10 px-6 text-white bg-white/10 border-white/20 hover:bg-white/20 backdrop-blur-md transition-colors w-full sm:w-auto">
                Change Number
              </Button>
            </div>

            {students.map((student) => {
              const status = studentStatuses[student.id];
              const location = busLocations[student.driverId];

              return (
                <div key={student.id} className="bg-white/60 backdrop-blur-2xl p-4 sm:p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/80 space-y-5 animate-in fade-in slide-in-from-bottom-5 duration-700">
                  
                  {/* Student Info Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 gap-4">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">{student.name}</h2>
                      <div className="flex items-center text-slate-500 mt-1 font-medium">
                        <MapPin className="w-4 h-4 mr-1.5 text-indigo-400" strokeWidth={2.5} />
                        <p>{student.address}</p>
                      </div>
                    </div>
                  </div>

                  {status && (
                    <div className="bg-indigo-600 p-5 sm:p-6 rounded-[2rem] shadow-[0_8px_20px_rgb(99,102,241,0.2)] text-white relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-indigo-500">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                      <div className="relative z-10 w-full">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest flex items-center">
                            <Activity className="w-4 h-4 mr-2" /> Current Status
                          </p>
                          <p className="text-indigo-200 text-sm font-bold bg-indigo-500/50 px-3 py-1 rounded-full border border-indigo-400">
                            {new Date(status.timestamp?.toMillis?.() || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                        <h3 className="text-2xl font-black capitalize tracking-tight flex items-center mt-2 text-white">
                          <CheckCircle2 className="w-7 h-7 mr-2 text-emerald-400" />
                          {status.status?.replace(/_/g, ' ')}
                        </h3>
                        {status.message && (
                          <p className="mt-3 text-indigo-50 text-sm font-medium bg-indigo-700/50 p-3 rounded-xl border border-indigo-500">
                            <strong className="text-indigo-200 block mb-0.5 uppercase tracking-wide text-xs">Driver Note:</strong>
                            {status.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-white/95 backdrop-blur-sm p-4 sm:p-6 rounded-[2rem] shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
                      <h3 className="font-extrabold text-xl text-slate-900 flex items-center tracking-tight">
                        <div className="p-2 bg-indigo-50 rounded-xl mr-3 shadow-inner">
                          <Bus className="w-5 h-5 text-indigo-600" strokeWidth={2.5} />
                        </div>
                        Live Bus Location
                      </h3>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        {location ? (
                          <span className="flex items-center text-sm font-bold tracking-wide text-emerald-700 bg-emerald-100/80 backdrop-blur-sm px-4 py-2 rounded-xl ring-1 ring-emerald-200 shadow-sm flex-1 sm:flex-none justify-center">
                            <span className="relative flex h-2.5 w-2.5 mr-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            TRACKING LIVE
                          </span>
                        ) : (
                          <span className="flex-1 sm:flex-none justify-center flex text-xs font-bold tracking-widest uppercase text-slate-500 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-inner">
                            Offline
                          </span>
                        )}
                        <Button 
                          onClick={handleRefresh} 
                          disabled={isRefreshing}
                          variant="outline" 
                          className="rounded-xl font-bold h-10 px-4 text-indigo-600 border-indigo-200 hover:bg-indigo-50 transition-all flex items-center shadow-sm"
                        >
                          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} strokeWidth={3} />
                        </Button>
                      </div>
                    </div>
                    
                    {location ? (
                      <div className="space-y-3">
                        <div className="h-[400px] w-full rounded-2xl overflow-hidden shadow-inner ring-1 ring-slate-200/60 relative group z-10">
                          <LiveMap 
                            locations={[{
                              id: location.driverId,
                              lat: location.lat,
                              lng: location.lng,
                              label: location.driverName || 'Bus'
                            }]} 
                            zoom={15}
                          />
                        </div>
                        {/* Status bar safely OUTSIDE the map so Leaflet controls don't overlap it */}
                        <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                          <TimeElapsed busLocation={location} />
                        </div>
                      </div>
                    ) : (
                      <div className="h-[350px] w-full bg-slate-50/50 backdrop-blur-sm rounded-2xl border-2 border-slate-200/50 border-dashed flex flex-col items-center justify-center text-slate-400 p-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white mb-4 shadow-sm border border-slate-100">
                          <Bus className="w-8 h-8 text-slate-300" strokeWidth={2} />
                        </div>
                        <p className="text-xl font-bold text-slate-600 tracking-tight">Location Unavailable</p>
                        <p className="text-sm mt-2 font-medium text-center">The driver hasn&apos;t started tracking yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeElapsed({ busLocation }: { busLocation: any }) {
  const [text, setText] = useState('Syncing...');

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const timestamp = busLocation.timestamp?.toMillis?.() || 0;
      const diff = Math.floor((now - timestamp) / 1000);
      
      if (diff < 10) setText('Just now');
      else if (diff < 60) setText(`${diff} seconds ago`);
      else setText(`${Math.floor(diff / 60)} min ago`);
    };

    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [busLocation]);

  return (
    <div className="flex items-center w-full">
      <div className="p-2.5 bg-emerald-50 rounded-xl mr-4 border border-emerald-100 text-emerald-600 shadow-sm">
        <Clock className="w-5 h-5" strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Last Transmission</p>
        <p className="text-sm font-black tracking-tight text-slate-900">{text}</p>
      </div>
    </div>
  );
}
