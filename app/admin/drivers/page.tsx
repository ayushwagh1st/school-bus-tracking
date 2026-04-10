'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Edit, Upload, Download, Loader2, User, AlertTriangle } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { createSecondaryUser } from '@/app/lib/auth-utils';
import { useAuth } from '@/components/auth-provider';

interface Driver {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  route?: string;
  status?: 'available' | 'unavailable';
}

export default function DriversPage() {
  const { user, role } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [formData, setFormData] = useState<Driver>({ uid: '', name: '', email: '', phone: '', route: '', status: 'available' });
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [selectedDriverForEmergency, setSelectedDriverForEmergency] = useState<Driver | null>(null);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [sendingEmergency, setSendingEmergency] = useState(false);

  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [driverToReassignFrom, setDriverToReassignFrom] = useState<Driver | null>(null);
  const [driverToReassignTo, setDriverToReassignTo] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState(false);

  const fetchDrivers = useCallback(async () => {
    if (!user || role !== 'admin') return;
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'driver'));
      const querySnapshot = await getDocs(q);
      const driversData: Driver[] = [];
      querySnapshot.forEach((doc) => {
        driversData.push(doc.data() as Driver);
      });
      setDrivers(driversData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  }, [user, role]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.email) {
        toast.error("Name and Email are required");
        return;
      }

      let uid = formData.uid;

      if (isCreating) {
        if (!password || password.length < 6) {
          toast.error("Password is required and must be at least 6 characters");
          return;
        }
        try {
          uid = await createSecondaryUser(formData.email, password);
        } catch (error: any) {
          toast.error(error.message || "Failed to create driver account");
          return;
        }
      } else if (!uid) {
        toast.error("UID is required for updating");
        return;
      } else if (password) {
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }
        try {
          const idToken = await user?.getIdToken();
          const response = await fetch('/api/update-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ uid, password })
          });
          
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update password');
          }
          toast.success("Password updated successfully");
        } catch (error: any) {
          toast.error(error.message || "Failed to update password");
          return;
        }
      }
      
      const driverRef = doc(db, 'users', uid);
      await setDoc(driverRef, {
        uid: uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || '',
        route: formData.route || '',
        status: formData.status || 'available',
        role: 'driver'
      });
      
      toast.success(isCreating ? 'Driver created successfully' : 'Driver updated successfully');
      setIsDialogOpen(false);
      setFormData({ uid: '', name: '', email: '', phone: '', route: '', status: 'available' });
      setPassword('');
      fetchDrivers();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${formData.uid}`);
    }
  };

  const handleDelete = async (uid: string) => {
    if (confirm('Are you sure you want to delete this driver?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        toast.success('Driver deleted');
        fetchDrivers();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const handleEmergencyAlert = async () => {
    if (!selectedDriverForEmergency) return;
    
    setSendingEmergency(true);
    try {
      // Fetch all students for this driver
      const q = query(collection(db, 'students'), where('driverId', '==', selectedDriverForEmergency.uid));
      const querySnapshot = await getDocs(q);
      const studentsData: any[] = [];
      querySnapshot.forEach((doc) => {
        studentsData.push({ id: doc.id, ...doc.data() });
      });

      if (studentsData.length === 0) {
        toast.error('No students assigned to this driver.');
        setSendingEmergency(false);
        return;
      }

      const now = new Date();
      const dateStr = format(now, 'yyyy-MM-dd');
      
      const fullMessage = [emergencyReason, emergencyMessage].filter(Boolean).join(' - ');

      // Update Firestore logs
      for (const student of studentsData) {
        const logRef = doc(collection(db, 'tracking_logs'));
        await setDoc(logRef, {
          studentId: student.id,
          driverId: selectedDriverForEmergency.uid,
          driverName: selectedDriverForEmergency.name,
          status: 'emergency',
          timestamp: now,
          date: dateStr,
          ...(fullMessage ? { message: fullMessage } : {})
        });
      }

      // Send SMS via API
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: studentsData,
          status: 'emergency',
          customMessage: fullMessage
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send SMS');
      }

      toast.success(`Emergency alert sent to parents of ${studentsData.length} student(s) on ${selectedDriverForEmergency.name}'s route.`);
      setIsEmergencyOpen(false);
      setEmergencyReason('');
      setEmergencyMessage('');
      setSelectedDriverForEmergency(null);
    } catch (error: any) {
      console.error('Emergency alert failed:', error);
      toast.error(error.message || 'Failed to send emergency alert.');
    } finally {
      setSendingEmergency(false);
    }
  };

  const toggleDriverStatus = async (uid: string, currentStatus?: string) => {
    try {
      const newStatus = currentStatus === 'unavailable' ? 'available' : 'unavailable';
      await updateDoc(doc(db, 'users', uid), { status: newStatus });
      toast.success(`Driver marked as ${newStatus}`);
      fetchDrivers();

      if (newStatus === 'unavailable') {
        const driver = drivers.find(d => d.uid === uid);
        if (driver) {
          setDriverToReassignFrom(driver);
          setIsReassignOpen(true);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleReassign = async () => {
    if (!driverToReassignFrom || !driverToReassignTo) {
      toast.error("Please select a new driver.");
      return;
    }
    setIsReassigning(true);
    try {
      const q = query(collection(db, 'students'), where('driverId', '==', driverToReassignFrom.uid));
      const querySnapshot = await getDocs(q);
      
      let count = 0;
      for (const studentDoc of querySnapshot.docs) {
        await updateDoc(doc(db, 'students', studentDoc.id), {
          driverId: driverToReassignTo
        });
        count++;
      }
      
      toast.success(`Successfully reassigned ${count} student(s) to the new driver.`);
      setIsReassignOpen(false);
      setDriverToReassignFrom(null);
      setDriverToReassignTo('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'students');
    } finally {
      setIsReassigning(false);
    }
  };

  const openEditDialog = (driver: Driver) => {
    setIsCreating(false);
    setFormData(driver);
    setPassword('');
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setIsCreating(true);
    setFormData({ uid: '', name: '', email: '', phone: '', route: '', status: 'available' });
    setPassword('');
    setIsDialogOpen(true);
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      { UID: 'abc123xyz', Name: 'Jane Smith', Email: 'jane@example.com', Phone: '+1987654321', Route: 'Route A' }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Drivers");
    XLSX.writeFile(wb, "drivers_sample.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      let addedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      const invalidRows: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const uid = row.UID || row.uid;
        const name = row.Name || row.name;
        const email = row.Email || row.email;
        const phone = row.Phone || row.phone || '';
        const route = row.Route || row.route || '';

        if (!uid || !name || !email) {
          errorCount++;
          invalidRows.push(`Row ${i + 2}: Missing UID, Name, or Email`);
          continue;
        }

        const uidStr = String(uid);

        // Check for duplicates
        const isDuplicate = drivers.some(d => d.uid === uidStr || d.email === String(email));
        if (isDuplicate) {
          duplicateCount++;
          invalidRows.push(`Row ${i + 2}: Duplicate UID or Email (${email})`);
          continue;
        }

        const driverRef = doc(db, 'users', uidStr);
        await setDoc(driverRef, {
          uid: uidStr,
          name: String(name),
          email: String(email),
          phone: String(phone),
          route: String(route),
          status: 'available',
          role: 'driver'
        });
        addedCount++;
      }

      if (invalidRows.length > 0) {
        setUploadErrors(invalidRows);
        toast.warning(`Upload completed with issues. Added: ${addedCount}.`, {
          description: `Skipped ${invalidRows.length} rows. See details above.`
        });
      } else {
        setUploadErrors([]);
        toast.success(`Bulk upload complete: ${addedCount} added successfully.`);
        setIsBulkUploadOpen(false);
      }
      
      fetchDrivers();
    } catch (error) {
      console.error("Error uploading file", error);
      toast.error("Failed to process Excel file. Please check the format.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
    d.email.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
    (d.route && d.route.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 -mx-4 -mt-4 p-6 sm:mx-0 sm:mt-0 sm:rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Drivers</h1>
            <p className="text-indigo-200 text-sm">Manage driver accounts and routes.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
              <DialogTrigger render={<Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-none backdrop-blur-sm" />}>
                <Upload className="w-4 h-4 mr-2" /> Bulk Upload
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Bulk Upload Drivers</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="font-medium text-slate-900 mb-2">Step 1: Download Sample</h4>
                    <p className="text-sm text-slate-500 mb-3">Download the sample Excel file to see the required format. UID, Name, and Email are required.</p>
                    <Button variant="outline" onClick={downloadSampleExcel} className="w-full sm:w-auto">
                      <Download className="w-4 h-4 mr-2" /> Download Sample.xlsx
                    </Button>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="font-medium text-slate-900 mb-2">Step 2: Upload Filled File</h4>
                    <p className="text-sm text-slate-500 mb-3">Upload your completed Excel file. Duplicates (by UID or Email) will be skipped.</p>
                    <Input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      ref={fileInputRef}
                      className="cursor-pointer"
                    />
                    {isUploading && <p className="text-sm text-indigo-600 mt-2 flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing file...</p>}
                  </div>
                  
                  {uploadErrors.length > 0 && (
                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 mt-4">
                      <h4 className="font-medium text-rose-800 mb-2 text-sm">Upload Issues ({uploadErrors.length})</h4>
                      <ul className="text-xs space-y-1 text-rose-600 max-h-32 overflow-y-auto list-disc pl-4">
                        {uploadErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setFormData({ uid: '', name: '', email: '', phone: '', route: '', status: 'available' });
                setPassword('');
              }
            }}>
              <Button className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm flex-1 sm:flex-none border-0" onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-1" /> Add Driver
              </Button>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-slate-900">{isCreating ? 'Add Driver' : 'Edit Driver'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {!isCreating && (
                    <div className="space-y-2">
                      <Label>Firebase Auth UID</Label>
                      <Input 
                        value={formData.uid} 
                        onChange={e => setFormData({...formData, uid: e.target.value})} 
                        placeholder="e.g. abc123xyz"
                        disabled
                        className="border-slate-200 bg-slate-50"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      className="border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      disabled={!isCreating}
                      className={`border-slate-200 ${!isCreating ? 'bg-slate-50' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isCreating ? 'Password' : 'New Password (leave blank to keep current)'}</Label>
                    <Input 
                      type="password"
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      placeholder={isCreating ? "Minimum 6 characters" : "Enter new password"}
                      className="border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input 
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value})} 
                      className="border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Route</Label>
                    <Input 
                      value={formData.route} 
                      onChange={e => setFormData({...formData, route: e.target.value})} 
                      className="border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status || 'available'} onValueChange={(val: string | null) => {
                      if (val === 'available' || val === 'unavailable') {
                        setFormData({...formData, status: val});
                      }
                    }}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave}>Save Driver</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="flex items-center bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200/50 shadow-sm w-full sticky top-4 z-20">
        <Search className="w-5 h-5 text-indigo-400 mr-3" />
        <Input 
          placeholder="Search drivers by name, email or route..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-0 h-10 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-base bg-transparent placeholder:text-slate-400"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12 bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 border-dashed">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium">No drivers found.</p>
          </div>
        ) : (
          filteredDrivers.map((driver) => (
            <div key={driver.uid} className="bg-white p-5 rounded-2xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-md transition-all duration-200 shadow-sm flex flex-col gap-3 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="min-w-0 pr-2">
                  <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">{driver.name}</h3>
                  <p className="text-sm text-slate-500 mt-1 truncate">{driver.email}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => {
                    setSelectedDriverForEmergency(driver);
                    setIsEmergencyOpen(true);
                  }} className="h-8 w-8 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-full" title="Trigger Emergency Alert">
                    <AlertTriangle className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(driver)} className="h-8 w-8 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-full">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(driver.uid)} className="h-8 w-8 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-full">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-500 text-xs block mb-1 uppercase tracking-wider font-semibold">Phone</span>
                  <span className="text-slate-700 font-medium truncate block">{driver.phone || '-'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-500 text-xs block mb-1 uppercase tracking-wider font-semibold">Route</span>
                  <span className="text-slate-700 font-medium truncate block">{driver.route || '-'}</span>
                </div>
              </div>

              <div className="pt-3 mt-auto border-t border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 font-medium">Status</span>
                  <Badge variant={(!driver.status || driver.status === 'available') ? 'default' : 'destructive'} className={(!driver.status || driver.status === 'available') ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                    {(!driver.status || driver.status === 'available') ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`status-${driver.uid}`} className="text-xs text-slate-400 sr-only">Toggle Status</Label>
                  <Switch 
                    id={`status-${driver.uid}`}
                    checked={!driver.status || driver.status === 'available'}
                    onCheckedChange={() => toggleDriverStatus(driver.uid, driver.status || 'available')}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isEmergencyOpen} onOpenChange={setIsEmergencyOpen}>
        <DialogContent className="sm:max-w-[425px] border-rose-200">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Trigger Emergency Alert
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-rose-50 text-rose-800 p-3 rounded-lg text-sm border border-rose-100">
              <strong>Warning:</strong> This will immediately send an SMS alert to the parents of <strong>all students</strong> assigned to <strong>{selectedDriverForEmergency?.name}</strong>.
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={emergencyReason} onValueChange={(val: string | null) => setEmergencyReason(val || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bus breakdown">Bus breakdown</SelectItem>
                  <SelectItem value="Traffic accident">Traffic accident</SelectItem>
                  <SelectItem value="Medical emergency">Medical emergency</SelectItem>
                  <SelectItem value="Severe weather">Severe weather</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency-message">Additional Details (Optional)</Label>
              <Textarea 
                id="emergency-message"
                placeholder="e.g., Replacement on the way."
                value={emergencyMessage}
                onChange={(e) => setEmergencyMessage(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmergencyOpen(false)} disabled={sendingEmergency}>
              Cancel
            </Button>
            <Button 
              className="bg-rose-600 hover:bg-rose-700 text-white" 
              onClick={handleEmergencyAlert}
              disabled={sendingEmergency}
            >
              {sendingEmergency ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                'Send Emergency Alert'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reassign Students</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-slate-50 text-slate-800 p-3 rounded-lg text-sm border border-slate-200">
              <strong>{driverToReassignFrom?.name}</strong> has been marked as unavailable. Would you like to reassign their students to another driver?
            </div>
            <div className="space-y-2">
              <Label>Select New Driver</Label>
              <Select value={driverToReassignTo} onValueChange={(val: string | null) => setDriverToReassignTo(val || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a driver..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers
                    .filter(d => d.uid !== driverToReassignFrom?.uid && (!d.status || d.status === 'available'))
                    .map(d => (
                      <SelectItem key={d.uid} value={d.uid}>{d.name} ({d.route || 'No route'})</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReassignOpen(false)} disabled={isReassigning}>
              Skip
            </Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white" 
              onClick={handleReassign}
              disabled={isReassigning || !driverToReassignTo}
            >
              {isReassigning ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reassigning...</>
              ) : (
                'Reassign Students'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
