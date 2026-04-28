// ============================================
// export.js - REPORT EXPORTER (Tanpa Supabase)
// ============================================

class ReportExporter {
    
    static async exportAttendanceToExcel(classId, startDate, endDate, className) {
        try {
            const students = await db.getStudents(classId);
            const attendanceRecords = await db.getAttendanceByDateRange(classId, startDate, endDate);
            
            // Group attendance by date
            const attendanceByDate = {};
            const allDates = new Set();
            
            attendanceRecords.forEach(record => {
                if (!attendanceByDate[record.date]) {
                    attendanceByDate[record.date] = {};
                }
                attendanceByDate[record.date][record.studentId] = record.status;
                allDates.add(record.date);
            });
            
            const sortedDates = Array.from(allDates).sort();
            
            // Prepare data for Excel
            const excelData = [];
            
            // Header row
            const headerRow = ['Nama Siswa', ...sortedDates.map(d => d.slice(5)), 'Hadir', 'Sakit', 'Izin', 'Alpa', '% Kehadiran'];
            excelData.push(headerRow);
            
            // Data rows
            for (const student of students) {
                const row = [student.name];
                let hadir = 0, sakit = 0, izin = 0, alpa = 0;
                
                for (const date of sortedDates) {
                    const status = attendanceByDate[date]?.[student.id] || '-';
                    let displayStatus = '-';
                    if (status === 'hadir') {
                        displayStatus = 'H';
                        hadir++;
                    } else if (status === 'sakit') {
                        displayStatus = 'S';
                        sakit++;
                    } else if (status === 'izin') {
                        displayStatus = 'I';
                        izin++;
                    } else if (status === 'alpa') {
                        displayStatus = 'A';
                        alpa++;
                    }
                    row.push(displayStatus);
                }
                
                const totalDays = sortedDates.length;
                const totalPresent = hadir + sakit + izin;
                const percent = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;
                
                row.push(hadir, sakit, izin, alpa, `${percent}%`);
                excelData.push(row);
            }
            
            // Create worksheet
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Laporan_${className}`);
            
            // Auto-size columns
            ws['!cols'] = [{ wch: 25 }, ...sortedDates.map(() => ({ wch: 5 })), { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }];
            
            // Download file
            XLSX.writeFile(wb, `laporan_kehadiran_${className}_${startDate}_sd_${endDate}.xlsx`);
            return true;
            
        } catch (error) {
            console.error('Export error:', error);
            return false;
        }
    }
    
    static async exportStudentRecapToExcel(classId, startDate, endDate, className, students, attendanceRecords) {
        try {
            // Group attendance by date
            const attendanceByDate = {};
            const allDates = new Set();
            
            attendanceRecords.forEach(record => {
                if (!attendanceByDate[record.date]) {
                    attendanceByDate[record.date] = {};
                }
                attendanceByDate[record.date][record.studentId] = record.status;
                allDates.add(record.date);
            });
            
            const sortedDates = Array.from(allDates).sort();
            
            // Prepare data for Excel
            const excelData = [];
            
            // Header row
            const headerRow = ['Nama Siswa', ...sortedDates.map(d => d.slice(5)), 'Hadir', 'Sakit', 'Izin', 'Alpa', '% Kehadiran'];
            excelData.push(headerRow);
            
            // Data rows
            for (const student of students) {
                const row = [student.name];
                let hadir = 0, sakit = 0, izin = 0, alpa = 0;
                
                for (const date of sortedDates) {
                    const status = attendanceByDate[date]?.[student.id] || '-';
                    let displayStatus = '-';
                    if (status === 'hadir') {
                        displayStatus = 'H';
                        hadir++;
                    } else if (status === 'sakit') {
                        displayStatus = 'S';
                        sakit++;
                    } else if (status === 'izin') {
                        displayStatus = 'I';
                        izin++;
                    } else if (status === 'alpa') {
                        displayStatus = 'A';
                        alpa++;
                    }
                    row.push(displayStatus);
                }
                
                const totalDays = sortedDates.length;
                const totalPresent = hadir + sakit + izin;
                const percent = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;
                
                row.push(hadir, sakit, izin, alpa, `${percent}%`);
                excelData.push(row);
            }
            
            // Create worksheet
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Rekap_${className}`);
            
            // Auto-size columns
            ws['!cols'] = [{ wch: 25 }, ...sortedDates.map(() => ({ wch: 5 })), { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }];
            
            // Download file
            XLSX.writeFile(wb, `rekap_siswa_${className}_${startDate}_sd_${endDate}.xlsx`);
            return true;
            
        } catch (error) {
            console.error('Export error:', error);
            return false;
        }
    }

    static async exportGradesToExcel(classId, className, gradesData, students, assessmentTypes) {
        try {
            const excelData = [['No', 'Nama Siswa', ...assessmentTypes.map(t => t.name), 'Rata-rata', 'Predikat']];
            
            for (let i = 0; i < students.length; i++) {
                const student = students[i];
                const studentGrades = gradesData.filter(g => g.studentId === student.id);
                const row = [i + 1, student.name];
                let total = 0, count = 0;
                
                for (const type of assessmentTypes) {
                    const grade = studentGrades.find(g => g.assessmentType === type.id);
                    const nilai = grade?.nilai !== undefined ? grade.nilai : '-';
                    if (nilai !== '-' && !isNaN(nilai)) {
                        total += parseFloat(nilai);
                        count++;
                    }
                    row.push(nilai);
                }
                
                const avg = count > 0 ? (total / count).toFixed(1) : '-';
                const predicate = this.getPredicate(parseFloat(avg));
                row.push(avg);
                row.push(predicate);
                excelData.push(row);
            }
            
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Rekap_Nilai_${className}`);
            ws['!cols'] = [{ wch: 5 }, { wch: 25 }, ...assessmentTypes.map(() => ({ wch: 12 })), { wch: 12 }, { wch: 15 }];
            XLSX.writeFile(wb, `rekap_nilai_${className}_${new Date().toISOString().split('T')[0]}.xlsx`);
            
            return true;
        } catch (error) {
            console.error('Export grades error:', error);
            return false;
        }
    }

    static getPredicate(nilai) {
        if (isNaN(nilai) || nilai === null) return '-';
        if (nilai >= 90) return 'A';
        if (nilai >= 80) return 'B';
        if (nilai >= 70) return 'C';
        if (nilai >= 60) return 'D';
        return 'E';
    }
}

window.ReportExporter = ReportExporter;