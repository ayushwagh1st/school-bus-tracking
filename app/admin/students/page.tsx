'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Edit, Eye, Bus, Loader2, Upload, Download, FileText } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import * as XLSX from 'xlsx';
import { generateStudentReport } from '@/app/lib/pdf-generator';
import { useAuth } from '@/components/auth-provider';

interface Student {
  id: string;
  name: string;
  parentPhone: string;
  address: string;
  driverId: string;
  createdAt: Date;
}

interface Driver {
  uid: string;
  name: string;
  status?: string;
}

export default function StudentsPage() {
  const { user, role } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', parentPhone: '', address: '', driverId: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!user || role !== 'admin') return;
    try {
      // Fetch students
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentsData: Student[] = [];
      studentsSnap.forEach((doc) => {
        const data = doc.data();
        studentsData.push({
          id: doc.id,
          name: data.name,
          parentPhone: data.parentPhone,
          address: data.address,
          driverId: data.driverId,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });
      setStudents(studentsData);

      // Fetch drivers
      const q = query(collection(db, 'users'), where('role', '==', 'driver'));
      const driversSnap = await getDocs(q);
      const driversData: Driver[] = [];
      driversSnap.forEach((doc) => {
        driversData.push({ uid: doc.id, name: doc.data().name, status: doc.data().status });
      });
      setDrivers(driversData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'students');
    }
  }, [user, role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveClick = () => {
    if (formData.id) {
      setIsConfirmSaveOpen(true);
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.parentPhone || !formData.address || !formData.driverId) {
        toast.error("All fields are required");
        return;
      }
      
      if (formData.id) {
        // Edit existing
        const studentRef = doc(db, 'students', formData.id);
        await updateDoc(studentRef, {
          name: formData.name,
          parentPhone: formData.parentPhone,
          address: formData.address,
          driverId: formData.driverId,
        });
        toast.success('Student updated successfully');
      } else {
        // Add new
        const newStudentRef = doc(collection(db, 'students'));
        await setDoc(newStudentRef, {
          name: formData.name,
          parentPhone: formData.parentPhone,
          address: formData.address,
          driverId: formData.driverId,
          createdAt: new Date()
        });
        toast.success('Student added successfully');
      }
      
      setIsConfirmSaveOpen(false);
      setIsDialogOpen(false);
      setFormData({ id: '', name: '', parentPhone: '', address: '', driverId: '' });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `students`);
    }
  };

  const handleDeleteClick = (id: string) => {
    setStudentToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'students', studentToDelete));
      toast.success('Student deleted');
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${studentToDelete}`);
    } finally {
      setIsDeleting(false);
      setIsConfirmDeleteOpen(false);
      setStudentToDelete(null);
    }
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      { Name: 'John Doe', ParentPhone: '+1234567890', Address: '123 Main St', DriverID: drivers[0]?.uid || 'DRIVER_ID_HERE' }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students_sample.xlsx");
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
        const name = row.Name || row.name;
        const parentPhone = row.ParentPhone || row.parentPhone || row.Phone || row.phone;
        const address = row.Address || row.address;
        const driverId = row.DriverID || row.driverId || row.DriverId;

        if (!name || !parentPhone || !address || !driverId) {
          errorCount++;
          invalidRows.push(`Row ${i + 2}: Missing Name, Phone, Address, or DriverID`);
          continue;
        }

        // Convert phone to string to ensure matching works
        const phoneStr = String(parentPhone);

        const newStudentRef = doc(collection(db, 'students'));
        await setDoc(newStudentRef, {
          name: String(name),
          parentPhone: phoneStr,
          address: String(address),
          driverId: String(driverId),
          createdAt: new Date()
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
      
      fetchData();
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

  const openEditDialog = (student: Student) => {
    setFormData({
      id: student.id,
      name: student.name,
      parentPhone: student.parentPhone,
      address: student.address,
      driverId: student.driverId
    });
    setIsDialogOpen(true);
  };

  const openViewDialog = (student: Student) => {
    setSelectedStudent(student);
    setIsViewDialogOpen(true);
  };

  const handleDownloadPdf = async (student: Student) => {
    try {
      const driverName = getDriverName(student.driverId);
      await generateStudentReport(student, driverName);
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  const getDriverName = (driverId: string) => {
    return drivers.find(d => d.uid === driverId)?.name || 'Unknown';
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
    s.parentPhone.includes(debouncedSearchQuery) ||
    s.address.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  const isFormValid = formData.name && formData.parentPhone && formData.address && formData.driverId;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 -mx-4 -mt-4 p-6 sm:mx-0 sm:mt-0 sm:rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Students</h1>
            <p className="text-indigo-200 text-sm">Manage student records and assignments.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
              <DialogTrigger render={<Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-none backdrop-blur-sm" />}>
                <Upload className="w-4 h-4 mr-2" /> Bulk Upload
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Bulk Upload Students</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="font-medium text-slate-900 mb-2">Step 1: Download Sample</h4>
                    <p className="text-sm text-slate-500 mb-3">Download the sample Excel file to see the required format. You will need the Driver IDs listed below.</p>
                    <Button variant="outline" onClick={downloadSampleExcel} className="w-full sm:w-auto">
                      <Download className="w-4 h-4 mr-2" /> Download Sample.xlsx
                    </Button>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                    <h4 className="font-medium text-slate-900 mb-2 text-sm">Available Drivers</h4>
                    <ul className="text-xs space-y-1 text-slate-600">
                      {drivers.map(d => (
                        <li key={d.uid} className="flex justify-between border-b border-slate-200/50 pb-1">
                          <span>{d.name}</span>
                          <span className="font-mono bg-slate-200 px-1 rounded">{d.uid}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="font-medium text-slate-900 mb-2">Step 2: Upload Filled File</h4>
                    <p className="text-sm text-slate-500 mb-3">Upload your completed Excel file.</p>
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
              if (!open) setFormData({ id: '', name: '', parentPhone: '', address: '', driverId: '' });
            }}>
              <DialogTrigger render={<Button className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm flex-1 sm:flex-none border-0" />}>
                <Plus className="w-4 h-4 mr-1" /> Add Student
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-slate-900">{formData.id ? 'Edit Student' : 'Add Student'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      className="border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Parent Phone</Label>
                    <Input 
                      value={formData.parentPhone} 
                      onChange={e => setFormData({...formData, parentPhone: e.target.value})} 
                      className="border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input 
                      value={formData.address} 
                      onChange={e => setFormData({...formData, address: e.target.value})} 
                      className="border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assign Driver</Label>
                    <Select value={formData.driverId} onValueChange={(val) => {
                      if (val) {
                        setFormData({...formData, driverId: val});
                      }
                    }}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder="Select a driver">
                          {formData.driverId ? drivers.find(d => d.uid === formData.driverId)?.name : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map(driver => (
                          <SelectItem key={driver.uid} value={driver.uid} disabled={driver.status === 'unavailable'}>
                            {driver.name} {driver.status === 'unavailable' ? '(Unavailable)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" 
                    onClick={handleSaveClick}
                    disabled={!isFormValid}
                  >
                    Save Student
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12 bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 border-dashed">
            <p className="font-medium">No students found.</p>
          </div>
        ) : (
          filteredStudents.map((student) => (
            <div key={student.id} className="bg-white p-5 rounded-2xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-md transition-all duration-200 shadow-sm flex flex-col gap-3 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="min-w-0 pr-2">
                  <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">{student.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{student.parentPhone}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleDownloadPdf(student)} className="h-8 w-8 text-emerald-500 bg-emerald-50 hover:bg-emerald-100 rounded-full" title="Download PDF Report">
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openViewDialog(student)} className="h-8 w-8 text-sky-500 bg-sky-50 hover:bg-sky-100 rounded-full">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(student)} className="h-8 w-8 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-full">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(student.id)} className="h-8 w-8 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-full">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-1">
                {student.address}
              </div>
              <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-100 text-sm text-slate-700 font-medium">
                <Bus className="w-4 h-4 text-indigo-500" />
                <span className="truncate">{getDriverName(student.driverId)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isConfirmSaveOpen} onOpenChange={setIsConfirmSaveOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Changes</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">Are you sure you want to save these changes to the student&apos;s information?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmSaveOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave}>Confirm Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">Are you sure you want to delete this student? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDeleteOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Student Details</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-3">
                <div className="text-sm font-medium text-slate-500">Name</div>
                <div className="col-span-2 text-sm font-semibold text-slate-900">{selectedStudent.name}</div>
              </div>
              <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-3">
                <div className="text-sm font-medium text-slate-500">Parent Phone</div>
                <div className="col-span-2 text-sm text-slate-700">{selectedStudent.parentPhone}</div>
              </div>
              <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-3">
                <div className="text-sm font-medium text-slate-500">Address</div>
                <div className="col-span-2 text-sm text-slate-700">{selectedStudent.address}</div>
              </div>
              <div className="grid grid-cols-3 gap-4 pb-1">
                <div className="text-sm font-medium text-slate-500">Assigned Driver</div>
                <div className="col-span-2 text-sm font-medium text-indigo-600 flex items-center">
                  <Bus className="w-4 h-4 mr-2" />
                  {getDriverName(selectedStudent.driverId)}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setIsViewDialogOpen(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
