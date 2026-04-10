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
import { Search, Phone, MapPin, User, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
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
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 -mx-4 -mt-4 p-6 sm:mx-0 sm:mt-0 sm:rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">My Route</h1>
            <p className="text-indigo-200 text-sm mb-4">Manage your assigned students and update their status in real-time.</p>
            
            <Button 
              onClick={toggleTracking}
              className={`rounded-xl h-10 px-4 font-semibold shadow-md transition-all ${
                isTracking 
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' 
                  : 'bg-white text-indigo-900 hover:bg-indigo-50'
              }`}
            >
              <MapPin className={`w-4 h-4 mr-2 ${isTracking ? 'animate-pulse' : ''}`} />
              {isTracking ? 'GPS Tracking Active' : 'Start GPS Tracking'}
            </Button>
          </div>
          
          {/* Emergency Alert Button */}
          <Dialog open={isEmergencyOpen} onOpenChange={setIsEmergencyOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 border-0 font-bold rounded-xl h-11 px-4">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Emergency Alert
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-red-200 bg-red-50/95 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-red-700 flex items-center">
                  <AlertTriangle className="w-6 h-6 mr-2" />
                  Trigger Emergency Alert
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-red-100/50 p-4 rounded-xl border border-red-200 text-red-800 text-sm">
                  <strong>Warning:</strong> This will immediately send an SMS alert to the parents of <strong>ALL {students.length} students</strong> on your route. Use this only in genuine emergencies (e.g., breakdown, accident, severe weather).
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-red-900">Additional Details (Optional)</label>
                  <Textarea 
                    placeholder="E.g., Bus broken down on Main St. Replacement bus is on the way. All children are safe."
                    value={emergencyMessage}
                    onChange={(e) => setEmergencyMessage(e.target.value)}
                    className="border-red-200 focus-visible:ring-red-500 bg-white min-h-[100px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEmergencyOpen(false)} disabled={sendingEmergency} className="border-red-200 text-red-700 hover:bg-red-100">
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleEmergencyAlert} disabled={sendingEmergency} className="bg-red-600 hover:bg-red-700">
                  {sendingEmergency ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                  {sendingEmergency ? 'Sending Alert...' : 'Send Alert to All Parents'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200/50 shadow-sm w-full sticky top-4 z-20">
        <Search className="w-5 h-5 text-indigo-400 mr-3" />
        <Input 
          placeholder="Search students by name, phone or address..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-0 h-10 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-base bg-transparent placeholder:text-slate-400"
        />
      </div>

      <div className="bg-white/60 backdrop-blur-xl p-4 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Checkbox 
            checked={filteredStudents.length > 0 && selectedStudents.size === filteredStudents.length}
            onCheckedChange={toggleSelectAll}
            className="border-indigo-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 w-5 h-5 rounded-md"
          />
          <span className="text-sm font-semibold text-slate-700 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-100">
            {selectedStudents.size} selected
          </span>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Select value={bulkStatus} onValueChange={(val) => {
            if (val) setBulkStatus(val);
          }}>
            <SelectTrigger className="w-full sm:w-[200px] border-slate-200 bg-white/50 backdrop-blur-sm rounded-xl h-11">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="rounded-lg">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => updateStatus(Array.from(selectedStudents), bulkStatus)}
            disabled={selectedStudents.size === 0 || !bulkStatus || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-xl h-11 px-6 font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {loading ? '' : 'Update'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredStudents.length === 0 ? (
          <div className="text-center text-slate-500 py-12 bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 border-dashed">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium">No students found.</p>
          </div>
        ) : (
          filteredStudents.map((student) => (
            <div 
              key={student.id} 
              className={`bg-white p-5 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col gap-4 relative overflow-hidden ${
                selectedStudents.has(student.id) ? 'border-indigo-400 ring-1 ring-indigo-400/20 bg-indigo-50/30' : 'border-slate-200/60 hover:border-indigo-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  <Checkbox 
                    checked={selectedStudents.has(student.id)}
                    onCheckedChange={() => toggleSelectStudent(student.id)}
                    className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 w-5 h-5 rounded-md"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg truncate pr-4">{student.name}</h3>
                      <div className="flex items-center text-slate-500 mt-1 text-sm">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-indigo-400" />
                        <span className="truncate">{student.address}</span>
                      </div>
                    </div>
                    <a 
                      href={`tel:${student.parentPhone}`}
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors flex-shrink-0 shadow-sm border border-emerald-100"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="pl-9">
                <Select onValueChange={(val: string | null) => {
                  if (val) {
                    updateStatus([student.id], val);
                  }
                }}>
                  <SelectTrigger className="w-full border-slate-200 bg-slate-50/50 rounded-xl h-11 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="Quick Update Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="rounded-lg">{opt.label}</SelectItem>
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
