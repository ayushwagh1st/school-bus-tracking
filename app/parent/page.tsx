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
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4">
            <Bus className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Parent Portal</h1>
          <p className="text-slate-500">Track your child&apos;s school bus in real-time.</p>
        </div>

        {!student ? (
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Enter your registered phone number</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input 
                    type="tel" 
                    placeholder="e.g., 9876543210" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10 h-12 text-lg"
                    required
                  />
                </div>
              </div>
              {error && (
                <div className="flex items-center text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                {loading ? 'Searching...' : 'Find My Child'}
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
                <p className="text-slate-500">{student.address}</p>
              </div>
              <Button variant="outline" onClick={() => setStudent(null)}>
                Change Number
              </Button>
            </div>

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-bold text-lg text-slate-900 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-indigo-500" />
                  Live Bus Location
                </h3>
                {busLocation ? (
                  <span className="flex items-center text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                    <span className="relative flex h-2 w-2 mr-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Active
                  </span>
                ) : (
                  <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    Offline
                  </span>
                )}
              </div>
              
              {busLocation ? (
                <div className="h-[400px] w-full rounded-2xl overflow-hidden">
                  <LiveMap 
                    locations={[{
                      id: busLocation.driverId,
                      lat: busLocation.lat,
                      lng: busLocation.lng,
                      label: busLocation.driverName || 'Bus'
                    }]} 
                    zoom={15}
                  />
                </div>
              ) : (
                <div className="h-[400px] w-full bg-slate-50 rounded-2xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400">
                  <Bus className="w-12 h-12 mb-3 text-slate-300" />
                  <p className="font-medium">Bus location is currently unavailable.</p>
                  <p className="text-sm mt-1">The driver hasn&apos;t started tracking yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
