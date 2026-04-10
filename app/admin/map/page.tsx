'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/firebase';
import dynamic from 'next/dynamic';
import { MapPin, Bus } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

// Dynamically import the map component to avoid SSR issues with leaflet
const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] w-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center border border-slate-200">
      <div className="text-slate-400 flex flex-col items-center">
        <MapPin className="w-8 h-8 mb-2 animate-bounce" />
        <p className="font-medium">Loading Map...</p>
      </div>
    </div>
  )
});

interface BusLocation {
  driverId: string;
  driverName: string;
  lat: number;
  lng: number;
  timestamp: any;
}

export default function AdminMapPage() {
  const { user, role } = useAuth();
  const [locations, setLocations] = useState<BusLocation[]>([]);

  useEffect(() => {
    if (!user || role !== 'admin') return;
    const q = query(collection(db, 'bus_locations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const locs: BusLocation[] = [];
      const now = new Date().getTime();
      
      snapshot.forEach((doc) => {
        const data = doc.data() as BusLocation;
        // Only show locations updated in the last 15 minutes
        const timestamp = data.timestamp?.toMillis?.() || 0;
        if (now - timestamp < 15 * 60 * 1000) {
          locs.push(data);
        }
      });
      setLocations(locs);
    });

    return () => unsubscribe();
  }, [user, role]);

  const mapLocations = locations.map(loc => ({
    id: loc.driverId,
    lat: loc.lat,
    lng: loc.lng,
    label: loc.driverName || 'Bus'
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Live Fleet Map</h1>
          <p className="text-slate-500 mt-1">Track active school buses in real-time.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <span className="text-sm font-medium text-slate-700">{locations.length} Active Buses</span>
        </div>
      </div>

      <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-sm">
        <div className="h-[400px] sm:h-[600px] w-full rounded-2xl overflow-hidden">
          <LiveMap locations={mapLocations} center={[40.7128, -74.0060]} zoom={11} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map(loc => (
          <div key={loc.driverId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{loc.driverName}</h3>
              <p className="text-xs text-slate-500">Last updated: {new Date(loc.timestamp?.toMillis?.() || new Date().getTime()).toLocaleTimeString()}</p>
            </div>
          </div>
        ))}
        {locations.length === 0 && (
          <div className="col-span-full text-center py-8 text-slate-500">
            No active buses currently tracking their location.
          </div>
        )}
      </div>
    </div>
  );
}
