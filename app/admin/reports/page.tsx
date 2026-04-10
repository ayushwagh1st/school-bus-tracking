'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Download, FileText, FileSpreadsheet, Calendar, Filter, Clock, User, Bus } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '@/components/auth-provider';

interface TrackingLog {
  id: string;
  studentId: string;
  driverId: string;
  status: string;
  timestamp: Date;
  date: string;
}

interface Student {
  id: string;
  name: string;
}

interface Driver {
  uid: string;
  name: string;
}

export default function ReportsPage() {
  const { user, role } = useAuth();
  const [logs, setLogs] = useState<TrackingLog[]>([]);
  const [students, setStudents] = useState<Record<string, string>>({});
  const [drivers, setDrivers] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!user || role !== 'admin') return;
      try {
        const studentsSnap = await getDocs(collection(db, 'students'));
        const studentsMap: Record<string, string> = {};
        studentsSnap.forEach(doc => { studentsMap[doc.id] = doc.data().name; });
        setStudents(studentsMap);

        const driversSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'driver')));
        const driversMap: Record<string, string> = {};
        driversSnap.forEach(doc => { driversMap[doc.id] = doc.data().name; });
        setDrivers(driversMap);
      } catch (error) {
        console.error("Error fetching metadata", error);
      }
    };
    fetchMetadata();
  }, [user, role]);

  const fetchReports = useCallback(async () => {
    if (!user || role !== 'admin') return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'tracking_logs'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const querySnapshot = await getDocs(q);
      const logsData: TrackingLog[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        logsData.push({
          id: doc.id,
          studentId: data.studentId,
          driverId: data.driverId,
          status: data.status,
          timestamp: data.timestamp?.toDate() || new Date(),
          date: data.date
        });
      });
      // Sort by timestamp descending
      logsData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setLogs(logsData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'tracking_logs');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, user, role]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const formatStatus = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Student Transport Report', 14, 15);
    doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 25);
    
    const tableData = logs.map(log => [
      format(log.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      students[log.studentId] || 'Unknown',
      drivers[log.driverId] || 'Unknown',
      formatStatus(log.status)
    ]);

    autoTable(doc, {
      head: [['Time', 'Student', 'Driver', 'Status']],
      body: tableData,
      startY: 30,
    });

    doc.save(`transport_report_${startDate}_${endDate}.pdf`);
  };

  const exportExcel = () => {
    const data = logs.map(log => ({
      Time: format(log.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      Student: students[log.studentId] || 'Unknown',
      Driver: drivers[log.driverId] || 'Unknown',
      Status: formatStatus(log.status)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `transport_report_${startDate}_${endDate}.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 -mx-4 -mt-4 p-6 sm:mx-0 sm:mt-0 sm:rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Reports</h1>
            <p className="text-indigo-200 text-sm">View and export transport tracking logs.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={exportPDF} className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-none backdrop-blur-sm">
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" onClick={exportExcel} className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-none backdrop-blur-sm">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-end gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/50 shadow-sm sticky top-4 z-20">
        <div className="flex gap-4 w-full sm:w-auto flex-1">
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center"><Calendar className="w-3 h-3 mr-1" /> Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-slate-200 h-10 bg-white" />
          </div>
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center"><Calendar className="w-3 h-3 mr-1" /> End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-slate-200 h-10 bg-white" />
          </div>
        </div>
        <Button onClick={fetchReports} disabled={isLoading} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-10 px-6">
          <Filter className="w-4 h-4 mr-2" /> {isLoading ? 'Filtering...' : 'Filter Logs'}
        </Button>
      </div>

      <div className="space-y-3 pb-4">
        {logs.length === 0 ? (
          <div className="text-center text-slate-500 py-12 bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 border-dashed">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium">No logs found for selected date range.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-md transition-all duration-200 shadow-sm flex flex-col gap-3 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm text-slate-500 font-medium flex items-center bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  {format(log.timestamp, 'MMM dd, yyyy HH:mm a')}
                </span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  log.status === 'picked_up' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                  log.status === 'reached_school' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                  log.status === 'left_school' ? 'bg-sky-100 text-sky-700 border border-sky-200' :
                  'bg-indigo-100 text-indigo-700 border border-indigo-200'
                }`}>
                  {formatStatus(log.status)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <div className="flex items-center p-2 rounded-xl bg-slate-50/50 border border-slate-100">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 mr-3 shadow-sm">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">Student</span>
                    <span className="text-sm font-bold text-slate-900">{students[log.studentId] || 'Unknown'}</span>
                  </div>
                </div>
                <div className="flex items-center p-2 rounded-xl bg-slate-50/50 border border-slate-100">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 mr-3 shadow-sm">
                    <Bus className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">Driver</span>
                    <span className="text-sm font-semibold text-slate-700">{drivers[log.driverId] || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
