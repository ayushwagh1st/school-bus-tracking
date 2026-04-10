'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bus, MapPin, Search, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-slate-100 animate-pulse rounded-2xl" />
});

export default function ParentPortal() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [busLocation, setBusLocation] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    
    setLoading(true);
    setError('');
    setStudent(null);
    
    try {
      const q = query(collection(db, 'students'), where('parentPhone', '==', phone));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setError('No student found with this phone number.');
        setLoading(false);
        return;
      }
      
      const studentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      setStudent(studentData);
    } catch (err) {
      console.error(err);
      setError('An error occurred while searching.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!student?.driverId) return;

    const q = query(collection(db, 'bus_locations'), where('driverId', '==', student.driverId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        const now = new Date().getTime();
        const timestamp = data.timestamp?.toMillis?.() || 0;
        
        // Only show if updated in the last 15 minutes
        if (now - timestamp < 15 * 60 * 1000) {
          setBusLocation(data);
        } else {
          setBusLocation(null);
        }
      } else {
        setBusLocation(null);
      }
    });

    return () => unsubscribe();
  }, [student]);

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

        {!student ? (
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
          <div className="space-y-6 relative z-10">
            <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{student.name}</h2>
                <div className="flex items-center text-slate-500 mt-1 font-medium">
                  <MapPin className="w-4 h-4 mr-1 text-indigo-400" strokeWidth={2.5} />
                  <p>{student.address}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setStudent(null)} className="rounded-xl font-bold h-10 px-5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 w-full sm:w-auto transition-colors">
                Change Number
              </Button>
            </div>

            <div className="bg-white/90 backdrop-blur-2xl p-5 md:p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white">
              <div className="flex items-center justify-between mb-5 px-2">
                <h3 className="font-extrabold text-xl text-slate-900 flex items-center tracking-tight">
                  <div className="p-2 bg-indigo-50 rounded-xl mr-3">
                    <MapPin className="w-5 h-5 text-indigo-600" strokeWidth={2.5} />
                  </div>
                  Live Bus Location
                </h3>
                {busLocation ? (
                  <span className="flex items-center text-sm font-bold tracking-wide text-emerald-700 bg-emerald-100/80 backdrop-blur-sm px-4 py-1.5 rounded-full ring-1 ring-emerald-200 border border-emerald-50 shadow-sm">
                    <span className="relative flex h-2.5 w-2.5 mr-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    TRACKING ACTIVE
                  </span>
                ) : (
                  <span className="text-xs font-bold tracking-widest uppercase text-slate-500 bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-inner">
                    Offline
                  </span>
                )}
              </div>
              
              {busLocation ? (
                <div className="h-[450px] w-full rounded-[1.5rem] overflow-hidden shadow-inner ring-1 ring-slate-100 relative">
                  <LiveMap 
                    locations={[{
                      id: busLocation.driverId,
                      lat: busLocation.lat,
                      lng: busLocation.lng,
                      label: busLocation.driverName || 'Bus'
                    }]} 
                    zoom={15}
                  />
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-between pointer-events-none">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Last Updated</p>
                      <p className="text-sm font-medium text-slate-900">{new Date(busLocation.timestamp?.toMillis?.() || Date.now()).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[400px] w-full bg-slate-50/50 backdrop-blur-sm rounded-[1.5rem] border-2 border-slate-200/50 border-dashed flex flex-col items-center justify-center text-slate-400">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white mb-6 shadow-sm border border-slate-100">
                    <Bus className="w-10 h-10 text-slate-300" strokeWidth={2} />
                  </div>
                  <p className="text-xl font-bold text-slate-600 tracking-tight">Location Unavailable</p>
                  <p className="text-sm mt-2 font-medium">The driver hasn&apos;t started tracking yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
