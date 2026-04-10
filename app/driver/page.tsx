'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search, Phone, MapPin, User, CheckCircle2, Loader2, AlertTriangle, RefreshCw, Radio } from 'lucide-react';
import { useDebounce } from 'use-debounce';

interface Student {
  id: string;
  name: string;
  parentPhone: string;
  address: string;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  
  // Emergency Alert State
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [sendingEmergency, setSendingEmergency] = useState(false);

  // GPS Tracking State
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [isSyncingGps, setIsSyncingGps] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'students'), where('driverId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const studentsData: Student[] = [];
        querySnapshot.forEach((doc) => {
          studentsData.push({ id: doc.id, ...doc.data() } as Student);
        });
        setStudents(studentsData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'students');
      }
    };
    fetchStudents();
  }, [user]);

  const toggleTracking = () => {
    if (isTracking) {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      setIsTracking(false);
      toast.info('GPS tracking stopped.');
    } else {
      if (!navigator.geolocation) {
        toast.error('Geolocation is not supported by your browser.');
        return;
      }

      toast.info('Starting GPS tracking...');
      setIsTracking(true);

      const id = navigator.geolocation.watchPosition(
        async (position) => {
          if (!user) return;
          try {
            const locationRef = doc(db, 'bus_locations', user.uid);
            await setDoc(locationRef, {
              driverId: user.uid,
              driverName: user.displayName || 'Driver',
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: new Date()
            });
          } catch (error) {
            console.error('Error updating location:', error);
            handleFirestoreError(error, OperationType.WRITE, 'bus_locations');
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Failed to get location. Please check permissions.');
          setIsTracking(false);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
      setWatchId(id);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const forceGpsSync = () => {
    if (!navigator.geolocation || !user) {
      toast.error('Geolocation is not available.');
      return;
    }
    setIsSyncingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const locationRef = doc(db, 'bus_locations', user.uid);
          await setDoc(locationRef, {
            driverId: user.uid,
            driverName: user.displayName || 'Driver',
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date()
          });
          toast.success('GPS location manually synced!');
        } catch (error) {
          console.error('Error updating location:', error);
          handleFirestoreError(error, OperationType.WRITE, 'bus_locations');
        } finally {
          setIsSyncingGps(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Failed to forcibly sync location.');
        setIsSyncingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const toggleSelectStudent = (id: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedStudents(newSelected);
  };

  const updateStatus = async (studentIds: string[], status: string, customMessage?: string) => {
    if (!user || studentIds.length === 0 || !status) return;
    
    setLoading(true);
    try {
      const now = new Date();
      const dateStr = format(now, 'yyyy-MM-dd');
      
      // Update Firestore logs
      for (const studentId of studentIds) {
        const logRef = doc(collection(db, 'tracking_logs'));
        await setDoc(logRef, {
          studentId,
          driverId: user.uid,
          status,
          timestamp: now,
          date: dateStr,
          ...(customMessage ? { message: customMessage } : {})
        });
      }

      // Send SMS via API
      const selectedStudentData = students.filter(s => studentIds.includes(s.id));
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: selectedStudentData,
          status,
          customMessage
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send SMS');
      }

      toast.success(`Status updated and SMS sent for ${studentIds.length} student(s)`);
      setSelectedStudents(new Set());
      setBulkStatus('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyAlert = async () => {
    if (!user || students.length === 0) return;
    
    setSendingEmergency(true);
    try {
      // Send emergency alert to ALL students assigned to this driver
      const allStudentIds = students.map(s => s.id);
      await updateStatus(allStudentIds, 'emergency', emergencyMessage);
      
      setIsEmergencyOpen(false);
      setEmergencyMessage('');
      toast.success('Emergency alert sent to all parents.');
    } catch (error: any) {
      console.error('Emergency alert failed:', error);
      toast.error('Failed to send emergency alert.');
    } finally {
      setSendingEmergency(false);
    }
  };

  const statusOptions = [
    { value: 'picked_up', label: 'Picked up from home' },
    { value: 'reached_school', label: 'Reached school' },
    { value: 'left_school', label: 'Left school' },
    { value: 'reached_home', label: 'Reached home' }
  ];

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
    s.parentPhone.includes(debouncedSearchQuery) ||
    s.address.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 sm:px-6 md:px-8 pt-8 pb-24">
      <div className="bg-white/80 backdrop-blur-2xl border border-white p-6 sm:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mb-2">My Route</h1>
            <p className="text-slate-500 text-sm font-medium mb-6">Manage your assigned students and update their status in real-time.</p>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-2 sm:mb-0">
              <Button 
                onClick={toggleTracking}
                className={`rounded-2xl h-12 w-full sm:w-auto px-6 font-bold shadow-[0_4px_14px_0_rgba(15,23,42,0.1)] transition-all duration-300 hover:shadow-[0_6px_20px_rgba(15,23,42,0.15)] hover:-translate-y-0.5 border ${
                  isTracking 
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' 
                    : 'bg-white text-indigo-900 hover:bg-indigo-50 border-indigo-100'
                }`}
              >
                {isTracking ? (
                  <>
                    <span className="relative flex h-3 w-3 mr-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    Tracking Active
                  </>
                ) : (
                  <>
                    <MapPin className="w-5 h-5 mr-2" strokeWidth={2.5} />
                    Start GPS Tracking
                  </>
                )}
              </Button>

              {isTracking && (
                <Button 
                  onClick={forceGpsSync}
                  disabled={isSyncingGps}
                  className="rounded-2xl h-12 w-full sm:w-auto px-5 font-bold transition-all duration-300 bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 shadow-sm"
                  variant="outline"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingGps ? 'animate-spin' : ''}`} strokeWidth={2.5} />
                  {isSyncingGps ? 'Syncing...' : 'Force Sync'}
                </Button>
              )}
            </div>
          </div>
          
          {/* Emergency Alert Button */}
          <Dialog open={isEmergencyOpen} onOpenChange={setIsEmergencyOpen}>
            <DialogTrigger render={
              <Button variant="destructive" className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white shadow-[0_4px_14px_0_rgba(239,68,68,0.39)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.23)] border-0 font-black rounded-2xl h-12 px-6 transition-all duration-300 hover:-translate-y-0.5" />
            }>
              <AlertTriangle className="w-5 h-5 mr-2" strokeWidth={2.5} />
              Emergency Alert
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-red-100 bg-red-50/95 backdrop-blur-2xl rounded-3xl p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-red-700 flex items-center">
                  <AlertTriangle className="w-7 h-7 mr-3" strokeWidth={2.5} />
                  Trigger Emergency
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-red-100/60 p-5 rounded-2xl border border-red-200 text-red-800 text-sm font-medium">
                  <strong className="text-red-900 font-bold block mb-1">Warning:</strong> This will immediately send an SMS alert to the parents of <strong className="text-red-900">{students.length} students</strong> on your route. Use this only in genuine emergencies.
                </div>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-red-900 drop-shadow-sm">Quick Select Preset</label>
                    <Select onValueChange={(val: string | null) => setEmergencyMessage(val || '')}>
                      <SelectTrigger className="w-full border-red-200 bg-white/80 backdrop-blur-sm rounded-2xl h-12 text-slate-700 font-semibold focus:ring-red-500/50">
                        <SelectValue placeholder="Select a common issue..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                        <SelectItem value="Bus broken down. Replacement bus is on the way. All children are safe." className="py-3 font-medium">Bus Broken Down</SelectItem>
                        <SelectItem value="Heavy traffic delay. Route will be delayed by 30-45 minutes." className="py-3 font-medium">Heavy Traffic Delay</SelectItem>
                        <SelectItem value="Minor accident. Everyone is completely safe, but we are waiting for protocol clearance." className="py-3 font-medium">Minor Accident</SelectItem>
                        <SelectItem value="Weather conditions delaying route. Proceeding safely but slowly." className="py-3 font-medium">Severe Weather Delay</SelectItem>
                        <SelectItem value="Route diversion due to road closure. Experiencing delays." className="py-3 font-medium">Route Diversion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-red-900 drop-shadow-sm">Or type custom message</label>
                    <Textarea 
                      placeholder="Provide specific details about the emergency..."
                      value={emergencyMessage}
                      onChange={(e) => setEmergencyMessage(e.target.value)}
                      className="border-red-200 focus-visible:ring-red-500/50 bg-white/80 backdrop-blur-sm min-h-[100px] rounded-2xl p-4 font-medium transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-3 sm:gap-0">
                <Button variant="outline" onClick={() => setIsEmergencyOpen(false)} disabled={sendingEmergency} className="border-red-200 text-red-700 hover:bg-red-100 rounded-xl font-bold h-11">
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleEmergencyAlert} disabled={sendingEmergency} className="bg-red-600 hover:bg-red-700 rounded-xl font-bold h-11 shadow-md">
                  {sendingEmergency ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <AlertTriangle className="w-5 h-5 mr-2" strokeWidth={2.5} />}
                  {sendingEmergency ? 'Sending Alert...' : 'Send Alert to All Parents'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center bg-white/70 backdrop-blur-xl px-5 py-2 rounded-2xl border border-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] w-full sticky top-4 z-20 transition-all focus-within:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] focus-within:bg-white">
        <Search className="w-6 h-6 text-indigo-400 mr-3" strokeWidth={2} />
        <Input 
          placeholder="Search students by name, phone or address..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-0 h-12 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-lg bg-transparent placeholder:text-slate-400 font-medium font-sans"
        />
      </div>

      <div className="bg-white/50 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center space-x-4 w-full sm:w-auto">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
            <Checkbox 
              checked={filteredStudents.length > 0 && selectedStudents.size === filteredStudents.length}
              onCheckedChange={toggleSelectAll}
              className="border-indigo-300 data-[state=checked]:bg-indigo-600 w-6 h-6 rounded-lg transition-all"
            />
          </div>
          <span className="text-sm font-bold tracking-wide text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100/50">
            {selectedStudents.size} SELECTED
          </span>
        </div>
        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
          <Select value={bulkStatus} onValueChange={(val: string | null) => {
            if (val) setBulkStatus(val);
          }}>
            <SelectTrigger className="w-full sm:w-[220px] border-slate-200 bg-white/80 backdrop-blur-sm rounded-xl h-12 text-base font-semibold">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100 shadow-xl">
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="rounded-lg py-3 font-medium">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => updateStatus(Array.from(selectedStudents), bulkStatus)}
            disabled={selectedStudents.size === 0 || !bulkStatus || loading}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white shadow-[0_4px_14px_0_rgba(15,23,42,0.2)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.23)] rounded-xl h-12 px-8 font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100 hover:-translate-y-0.5"
          >
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" strokeWidth={2.5} />}
            {loading ? 'Updating' : 'Update'}
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        {filteredStudents.length === 0 ? (
          <div className="text-center text-slate-500 py-16 bg-white/50 backdrop-blur-xl rounded-[2rem] border border-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-4">
              <User className="w-10 h-10 text-slate-300" strokeWidth={2} />
            </div>
            <p className="text-lg font-bold">No students found.</p>
            <p className="text-sm mt-1 opacity-70">Try a different search term.</p>
          </div>
        ) : (
          filteredStudents.map((student) => (
            <div 
              key={student.id} 
              className={`bg-white/80 backdrop-blur-lg p-6 rounded-[2rem] transition-all duration-300 flex flex-col gap-5 relative overflow-hidden group ${
                selectedStudents.has(student.id) 
                  ? 'border border-indigo-400 ring-4 ring-indigo-400/10 shadow-[0_8px_30px_-4px_rgba(99,102,241,0.15)] bg-indigo-50/40' 
                  : 'border border-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_40px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-1'
              }`}
            >
              <div className="flex items-start gap-5">
                <div className="pt-2">
                  <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                    <Checkbox 
                      checked={selectedStudents.has(student.id)}
                      onCheckedChange={() => toggleSelectStudent(student.id)}
                      className="border-slate-300 data-[state=checked]:bg-indigo-600 w-7 h-7 rounded-lg transition-transform active:scale-90"
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-900 text-xl truncate tracking-tight">{student.name}</h3>
                      <div className="flex items-center text-slate-500 mt-2 text-sm font-medium">
                        <MapPin className="w-4 h-4 mr-2 flex-shrink-0 text-indigo-400" strokeWidth={2.5} />
                        <span className="truncate leading-relaxed">{student.address}</span>
                      </div>
                    </div>
                    <a 
                      href={`tel:${student.parentPhone}`}
                      className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all flex-shrink-0 shadow-sm border border-emerald-100 hover:shadow-[0_8px_20px_-4px_rgba(16,185,129,0.3)] hover:-translate-y-1"
                    >
                      <Phone className="w-5 h-5 pointer-events-none" strokeWidth={2.5} />
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="pl-14">
                <Select onValueChange={(val: string | null) => {
                  if (val) {
                    updateStatus([student.id], val);
                  }
                }}>
                  <SelectTrigger className="w-full border-slate-200 bg-white shadow-sm rounded-2xl h-12 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-indigo-500/20">
                    <SelectValue placeholder="Quick Update Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="rounded-xl py-3 font-medium">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
