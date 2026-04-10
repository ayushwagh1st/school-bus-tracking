import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';

export async function generateStudentReport(student: any, driverName: string) {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('Student Transit Report', 14, 25);
  
  // Student Details
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFontSize(14);
  doc.text('Student Information', 14, 55);
  
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text(`Name: ${student.name}`, 14, 65);
  doc.text(`Parent Phone: ${student.parentPhone}`, 14, 72);
  doc.text(`Address: ${student.address}`, 14, 79);
  doc.text(`Assigned Driver: ${driverName}`, 14, 86);

  // Fetch Logs
  const q = query(
    collection(db, 'tracking_logs'),
    where('studentId', '==', student.id)
  );
  
  const snapshot = await getDocs(q);
  const logs: any[] = [];
  snapshot.forEach(doc => {
    logs.push({ id: doc.id, ...doc.data() });
  });
  
  // Sort by timestamp descending
  logs.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

  // Process logs into attendance format
  const attendanceMap = new Map<string, any>();
  
  logs.forEach(log => {
    const date = log.date;
    if (!attendanceMap.has(date)) {
      attendanceMap.set(date, { date, morning: 'Absent', afternoon: 'Absent', events: [] });
    }
    
    const dayRecord = attendanceMap.get(date);
    dayRecord.events.push(log);
    
    if (log.status === 'picked_up' || log.status === 'reached_school') {
      dayRecord.morning = 'Present';
    }
    if (log.status === 'left_school' || log.status === 'reached_home') {
      dayRecord.afternoon = 'Present';
    }
  });

  const tableData = Array.from(attendanceMap.values()).map(record => [
    record.date,
    record.morning,
    record.afternoon,
    record.morning === 'Present' && record.afternoon === 'Present' ? 'Full Day' : 
    (record.morning === 'Present' || record.afternoon === 'Present' ? 'Half Day' : 'Absent')
  ]);

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Attendance Summary', 14, 105);

  autoTable(doc, {
    startY: 110,
    head: [['Date', 'Morning (To School)', 'Afternoon (To Home)', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 110;

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Detailed Logs', 14, finalY + 15);

  const logTableData = logs.map(log => [
    log.date,
    new Date(log.timestamp.toMillis()).toLocaleTimeString(),
    log.status.replace('_', ' ').toUpperCase(),
    log.message || '-'
  ]);

  autoTable(doc, {
    startY: finalY + 20,
    head: [['Date', 'Time', 'Status', 'Message']],
    body: logTableData,
    theme: 'striped',
    headStyles: { fillColor: [100, 116, 139] },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`${student.name.replace(/\s+/g, '_')}_Transit_Report.pdf`);
}
