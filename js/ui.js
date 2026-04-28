// ============================================
// ui.js - UI MANAGEMENT (Tanpa Supabase)
// ============================================

class UI {
    constructor() {
        this.currentClass = null;
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.searchQuery = '';
        this.filteredStudents = null;
        this.gradeManager = null;
        
        this.attendanceStatuses = [
            { id: 'hadir', name: 'Hadir', short: 'H', icon: '✅', color: '#06d6a0' },
            { id: 'sakit', name: 'Sakit', short: 'S', icon: '🤒', color: '#4895ef' },
            { id: 'izin', name: 'Izin', short: 'I', icon: '📝', color: '#f72585' },
            { id: 'alpa', name: 'Alpa', short: 'A', icon: '❌', color: '#e63946' }
        ];
        
        this._handlers = {};
    }

    // ==================== INITIALIZATION ====================
    
    async init() {
        console.log('UI Initializing...');
        
        if (!window.db || !window.db.db) {
            await window.db.init();
        }
        
        this.bindEvents();
        await this.loadClasses();
        this.setDefaultDates();
        
        this.gradeManager = new GradeManager(this);
        await this.gradeManager.init();
        
        await this.checkStorageStatus();
        
        this.showNotification('Selamat datang! Pilih kelas untuk memulai', 'info');
        console.log('UI Initialized successfully');
    }

    // ==================== EVENT BINDING ====================
    
    bindEvents() {
        // Class selector
        this.bindEvent('classSelector', 'change', () => this.onClassSelect());
        
        // Buttons
        this.bindEvent('viewStatsBtn', 'click', () => this.showStatistics());
        this.bindEvent('backupBtn', 'click', () => this.backupData());
        this.bindEvent('restoreFile', 'change', (e) => this.restoreData(e));
        this.bindEvent('resetBtn', 'click', () => this.resetData());
        this.bindEvent('setAllPresentBtn', 'click', () => this.setAllPresent());
        this.bindEvent('attendanceDate', 'change', () => this.renderAttendanceTable());
        this.bindEvent('loadRecapBtn', 'click', () => this.loadStudentRecap());
        this.bindEvent('searchStudent', 'input', () => setTimeout(() => this.searchStudents(), 300));
        this.bindEvent('prevPageBtn', 'click', () => this.prevPage());
        this.bindEvent('nextPageBtn', 'click', () => this.nextPage());
        
        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.removeEventListener('click', this._getHandler('tabClick'));
            tab.addEventListener('click', (e) => this.switchTab(e));
        });
        
        // Modals
        this.bindEvent('manageClassesBtn', 'click', () => this.showManageModal());
        this.bindEvent('closeManageModal', 'click', () => this.closeModal('manageModal'));
        this.bindEvent('closeStatsBtn', 'click', () => this.closeModal('statsModal'));
        
        // Modal tabs
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.removeEventListener('click', this._getHandler('modalTab'));
            tab.addEventListener('click', (e) => this.switchModalTab(e));
        });
        
        // Class management
        this.bindEvent('addClassBtn', 'click', () => this.showAddClassModal());
        this.bindEvent('classForm', 'submit', (e) => this.saveClass(e));
        this.bindEvent('closeClassFormModal', 'click', () => this.closeModal('classFormModal'));
        this.bindEvent('cancelClassBtn', 'click', () => this.closeModal('classFormModal'));
        
        // Student management
        this.bindEvent('addStudentBtn', 'click', () => this.showAddStudentModal());
        this.bindEvent('studentForm', 'submit', (e) => this.saveStudent(e));
        this.bindEvent('closeStudentFormModal', 'click', () => this.closeModal('studentFormModal'));
        this.bindEvent('cancelStudentBtn', 'click', () => this.closeModal('studentFormModal'));
        this.bindEvent('studentClassFilter', 'change', () => this.loadStudentsTable());
        
        // Import
        this.bindEvent('importClassesBtn', 'click', () => this.importClassesFromFile());
        this.bindEvent('downloadTemplateBtn', 'click', () => this.downloadTemplate());
        
        // Edit modal
        this.bindEvent('closeEditModal', 'click', () => this.closeModal('editModal'));
        this.bindEvent('cancelEdit', 'click', () => this.closeModal('editModal'));
        this.bindEvent('saveEdit', 'click', () => this.saveEditGrade());
        
        // Close modals on outside click
        window.removeEventListener('click', this._getHandler('outsideClick'));
        window.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    bindEvent(elementId, eventType, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.removeEventListener(eventType, this._getHandler(elementId));
            element.addEventListener(eventType, handler);
        }
    }

    _getHandler(key) {
        if (!this._handlers[key]) {
            this._handlers[key] = (...args) => {
                if (this[key]) return this[key](...args);
            };
        }
        return this._handlers[key];
    }

    // ==================== CLASS SELECTION ====================

    async getClassPerformanceReport() {
        if (!this.currentClass) return null;
        
        // Gunakan SQL untuk query kompleks
        if (window.sqlEngine && window.sqlEngine.isReady) {
            const report = window.sqlEngine.getAll(`
                SELECT 
                    s.name as student_name,
                    AVG(g.score) as avg_score,
                    COUNT(DISTINCT g.assessmentType) as total_assessments,
                    COUNT(CASE WHEN a.status = 'hadir' THEN 1 END) as attendance_count
                FROM students s
                LEFT JOIN grades g ON s.id = g.studentId
                LEFT JOIN attendance a ON s.id = a.studentId AND a.date BETWEEN date('now', '-30 days') AND date('now')
                WHERE s.classId = ?
                GROUP BY s.id
                ORDER BY avg_score DESC
            `, [this.currentClass]);
            
            return report;
        }
        
        // Fallback ke IndexedDB jika SQLite belum siap
        return null;
    }

    async getTopPerformer(limit = 3) {
        if (!this.currentClass) return [];
        
        if (window.sqlEngine && window.sqlEngine.isReady) {
            return window.sqlEngine.getAll(`
                SELECT s.name, AVG(g.score) as avg_score
                FROM students s
                JOIN grades g ON s.id = g.studentId
                WHERE s.classId = ?
                GROUP BY s.id
                ORDER BY avg_score DESC
                LIMIT ?
            `, [this.currentClass, limit]);
        }
        
        return [];
    }

    async getAttendanceSummary() {
        if (!this.currentClass) return null;
        
        if (window.sqlEngine && window.sqlEngine.isReady) {
            return window.sqlEngine.getFirst(`
                SELECT 
                    COUNT(CASE WHEN status = 'hadir' THEN 1 END) as hadir,
                    COUNT(CASE WHEN status = 'sakit' THEN 1 END) as sakit,
                    COUNT(CASE WHEN status = 'izin' THEN 1 END) as izin,
                    COUNT(CASE WHEN status = 'alpha' THEN 1 END) as alpha,
                    COUNT(*) as total
                FROM attendance
                WHERE classId = ?
            `, [this.currentClass]);
        }
        
        return null;
    }

    // Tambahkan dashboard widget untuk menampilkan hasil SQL query
    async showPerformanceDashboard() {
        const topStudents = await this.getTopPerformer(5);
        const attendanceSummary = await this.getAttendanceSummary();
        
        const dashboardHtml = `
            <div class="performance-dashboard">
                <h4>🏆 Top 5 Performa Akademik</h4>
                <div class="top-performer-list">
                    ${topStudents.map((s, i) => `
                        <div class="performer-item">
                            <span class="rank">${i + 1}</span>
                            <span class="name">${this.escapeHtml(s.name)}</span>
                            <span class="score">${Math.round(s.avg_score)}</span>
                        </div>
                    `).join('')}
                </div>
                
                ${attendanceSummary ? `
                    <h4 class="mt-3">📊 Ringkasan Kehadiran</h4>
                    <div class="attendance-summary">
                        <div class="summary-item hadir">✅ Hadir: ${attendanceSummary.hadir || 0}</div>
                        <div class="summary-item sakit">🤒 Sakit: ${attendanceSummary.sakit || 0}</div>
                        <div class="summary-item izin">📝 Izin: ${attendanceSummary.izin || 0}</div>
                        <div class="summary-item alpha">❌ Alpha: ${attendanceSummary.alpha || 0}</div>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Tampilkan di modal atau container
        const container = document.getElementById('performanceContainer');
        if (container) {
            container.innerHTML = dashboardHtml;
        }
    }

    async loadClasses() {
        const classes = await db.getClasses();
        const selector = document.getElementById('classSelector');
        
        if (!selector) return;
        
        selector.innerHTML = '<option value="">-- Pilih Kelas --</option>';
        classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.id;
            option.textContent = cls.name;
            selector.appendChild(option);
        });
    }

    async onClassSelect() {
        const selector = document.getElementById('classSelector');
        const selectedId = selector?.value;
        
        if (!selectedId) {
            this.currentClass = null;
            const mainContent = document.getElementById('mainContent');
            const selectedInfo = document.getElementById('selectedClassInfo');
            if (mainContent) mainContent.style.display = 'none';
            if (selectedInfo) selectedInfo.style.display = 'none';
            return;
        }
        
        this.currentClass = selectedId;
        this.currentPage = 1;
        this.searchQuery = '';
        
        const searchInput = document.getElementById('searchStudent');
        if (searchInput) searchInput.value = '';
        
        const classes = await db.getClasses();
        const classItem = classes.find(c => c.id === selectedId);
        const students = await db.getStudents(selectedId);
        
        const infoClassName = document.getElementById('infoClassName');
        const infoStudentCount = document.getElementById('infoStudentCount');
        const selectedInfo = document.getElementById('selectedClassInfo');
        const mainContent = document.getElementById('mainContent');
        
        if (infoClassName) infoClassName.textContent = classItem?.name || selectedId;
        if (infoStudentCount) infoStudentCount.textContent = students.length;
        if (selectedInfo) selectedInfo.style.display = 'flex';
        if (mainContent) mainContent.style.display = 'block';
        
        await this.renderAttendanceTable();
        await this.loadStudentRecap();
        
        if (this.gradeManager) {
            await this.gradeManager.onClassChange(selectedId, classItem?.name);
        }
    }

    // ==================== ATTENDANCE TABLE ====================
    
    async renderAttendanceTable() {
        if (!this.currentClass) {
            const tbody = document.getElementById('attendanceTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="3" class="text-center text-muted" style="padding: 60px;">
                            <i class="fas fa-chalkboard-user" style="font-size: 2rem;"></i>
                            <p>Pilih kelas terlebih dahulu</p>
                        </td>
                    </tr>
                `;
            }
            return;
        }
        
        this.showLoading('attendanceTableBody', 'Memuat data siswa...');
        
        // Ambil data siswa
        const students = await db.getStudents(this.currentClass);
        console.log('Students loaded:', students); // Debug: cek apakah siswa terload
        
        if (!students || students.length === 0) {
            const tbody = document.getElementById('attendanceTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="3" class="text-center text-muted" style="padding: 40px;">
                            <i class="fas fa-users" style="font-size: 2rem;"></i>
                            <p>Belum ada siswa di kelas ini</p>
                            <small>Kelola data siswa melalui tombol "Manajemen Data"</small>
                        </td>
                    </tr>
                `;
            }
            return;
        }
        
        // Filter siswa berdasarkan pencarian
        let studentsToDisplay = students;
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            studentsToDisplay = students.filter(s => s.name.toLowerCase().includes(query));
        }
        
        const totalStudents = studentsToDisplay.length;
        const totalPages = Math.ceil(totalStudents / this.itemsPerPage);
        
        if (this.currentPage > totalPages && totalPages > 0) {
            this.currentPage = totalPages;
        } else if (this.currentPage < 1) {
            this.currentPage = 1;
        }
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalStudents);
        const pageStudents = studentsToDisplay.slice(startIndex, endIndex);
        
        // Pastikan date memiliki nilai
        let date = document.getElementById('attendanceDate').value;
        if (!date) {
            date = new Date().toISOString().split('T')[0];
            document.getElementById('attendanceDate').value = date;
        }
        
        // Ambil data absensi
        const attendanceRecords = await db.getAttendance(this.currentClass, date);
        const attendanceMap = new Map(attendanceRecords.map(a => [a.studentId, a]));
        
        const tbody = document.getElementById('attendanceTableBody');
        if (!tbody) return;
        
        // Render tabel
        tbody.innerHTML = pageStudents.map((student, idx) => {
            const record = attendanceMap.get(student.id);
            const status = record?.status || 'hadir';
            
            return `
                <tr>
                    <td style="width: 60px;">${startIndex + idx + 1}</td>
                    <td><strong>${this.escapeHtml(student.name)}</strong></td>
                    <td>
                        <select class="status-select form-control" data-student-id="${student.id}" data-record-id="${record?.id || ''}" style="width: auto; min-width: 130px;">
                            ${this.attendanceStatuses.map(s => `
                                <option value="${s.id}" ${status === s.id ? 'selected' : ''}>
                                    ${s.icon} ${s.name}
                                </option>
                            `).join('')}
                        </select>
                    </td>
                </tr>
            `;
        }).join('');
        
        this.updatePaginationInfo(startIndex + 1, endIndex, totalStudents);
        this.renderPaginationNumbers(totalPages);
        
        const paginationDiv = document.getElementById('paginationControls');
        if (paginationDiv) {
            paginationDiv.style.display = totalPages > 1 ? 'flex' : 'none';
        }
        
        // Bind status change events
        const currentDate = date;
        document.querySelectorAll('.status-select').forEach(select => {
            select.removeEventListener('change', this._getHandler('statusChange'));
            select.addEventListener('change', (e) => this.handleStatusChange(e, currentDate));
        });
        
        // Update info jumlah siswa di card class info
        const infoStudentCount = document.getElementById('infoStudentCount');
        if (infoStudentCount) {
            infoStudentCount.textContent = students.length;
        }
    }

    showLoading(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center" style="padding: 40px;">
                        <i class="fas fa-spinner fa-pulse" style="font-size: 2rem;"></i>
                        <p>${message}</p>
                    </td>
                </tr>
            `;
        }
    }

    async handleStatusChange(event, date) {
        const select = event.target;
        const studentId = parseInt(select.dataset.studentId);
        const recordId = select.dataset.recordId;
        const newStatus = select.value;
        
        if (recordId) {
            await db.updateAttendance(parseInt(recordId), newStatus);
        } else {
            await db.addAttendance({
                classId: this.currentClass,
                studentId: studentId,
                date: date,
                status: newStatus,
                createdAt: new Date().toISOString()
            });
        }
        
        this.showNotification(`Status berhasil diubah menjadi ${newStatus}`, 'success');
    }

    updatePaginationInfo(start, end, total) {
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            pageInfo.textContent = total > 0 ? `Menampilkan ${start}-${end} dari ${total} siswa` : 'Tidak ada data';
        }
    }

    renderPaginationNumbers(totalPages) {
        const container = document.getElementById('pageNumbers');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (totalPages <= 1) return;
        
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        if (startPage > 1) {
            this.addPageButton(container, 1);
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '6px 12px';
                container.appendChild(ellipsis);
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            this.addPageButton(container, i);
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '6px 12px';
                container.appendChild(ellipsis);
            }
            this.addPageButton(container, totalPages);
        }
        
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    }

    addPageButton(container, pageNum) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${pageNum === this.currentPage ? 'active' : ''}`;
        btn.textContent = pageNum;
        btn.addEventListener('click', () => this.goToPage(pageNum));
        container.appendChild(btn);
    }

    goToPage(pageNumber) {
        this.currentPage = pageNumber;
        this.renderAttendanceTable();
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderAttendanceTable();
        }
    }

    nextPage() {
        this.currentPage++;
        this.renderAttendanceTable();
    }

    searchStudents() {
        const searchInput = document.getElementById('searchStudent');
        this.searchQuery = searchInput?.value.trim() || '';
        this.currentPage = 1;
        this.renderAttendanceTable();
    }

    async setAllPresent() {
        if (!this.currentClass) {
            this.showNotification('Pilih kelas terlebih dahulu', 'error');
            return;
        }

        const students = await db.getStudents(this.currentClass);
        const date = document.getElementById('attendanceDate').value;
        const existing = await db.getAttendance(this.currentClass, date);
        const existingMap = new Map(existing.map(a => [a.studentId, a]));

        for (const student of students) {
            const existingRecord = existingMap.get(student.id);
            if (existingRecord) {
                if (existingRecord.status !== 'hadir') {
                    await db.updateAttendance(existingRecord.id, 'hadir');
                }
            } else {
                await db.addAttendance({
                    classId: this.currentClass,
                    studentId: student.id,
                    date: date,
                    status: 'hadir',
                    createdAt: new Date().toISOString()
                });
            }
        }

        await this.renderAttendanceTable();
        this.showNotification('Semua siswa telah dihadirkan', 'success');
    }

    // ==================== STUDENT RECAP ====================
    
    async loadStudentRecap() {
    if (!this.currentClass) {
        const container = document.getElementById('recapContainer');
        if (container) {
            container.innerHTML = '<div class="text-center text-muted" style="padding: 60px;"><i class="fas fa-chalkboard-user" style="font-size: 2rem;"></i><p>Pilih kelas terlebih dahulu</p></div>';
        }
        return;
    }
    
    const startDate = document.getElementById('recapStartDate').value;
    const endDate = document.getElementById('recapEndDate').value;
    
    if (!startDate || !endDate) {
        this.showNotification('Silakan pilih periode rekap', 'error');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        this.showNotification('Tanggal mulai tidak boleh setelah tanggal selesai', 'error');
        return;
    }
    
    const container = document.getElementById('recapContainer');
    if (container) {
        container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-pulse"></i> Memuat data...</div>';
    }
    
    const students = await db.getStudents(this.currentClass);
    console.log('Recap - Students:', students); // Debug
    
    if (!students || students.length === 0) {
        if (container) {
            container.innerHTML = '<div class="text-center text-muted" style="padding: 60px;"><i class="fas fa-users" style="font-size: 2rem;"></i><p>Belum ada siswa di kelas ini</p><small>Tambahkan siswa melalui tombol "Manajemen Data"</small></div>';
        }
        return;
    }
    
    const attendanceRecords = await db.getAttendanceByDateRange(this.currentClass, startDate, endDate);
    
    const attendanceByDate = {};
    attendanceRecords.forEach(record => {
        if (!attendanceByDate[record.date]) {
            attendanceByDate[record.date] = {};
        }
        attendanceByDate[record.date][record.studentId] = record.status;
    });
    
    const dates = Object.keys(attendanceByDate).sort();
    
    if (!container) return;
    
    if (dates.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted" style="padding: 60px;">
                <i class="fas fa-info-circle" style="font-size: 2rem;"></i>
                <p>Belum ada data kehadiran untuk periode ini</p>
                <small>Silakan input kehadiran pada tab "Kehadiran" terlebih dahulu</small>
            </div>
        `;
        return;
    }
        
        let tableHTML = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nama Siswa</th>
                            ${dates.map(date => `<th>${date.slice(5)}</th>`).join('')}
                            <th>H</th><th>S</th><th>I</th><th>A</th><th>%</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        let classTotalHadir = 0, classTotalSakit = 0, classTotalIzin = 0, classTotalAlpa = 0;
        
        for (const student of students) {
            let hadir = 0, sakit = 0, izin = 0, alpa = 0;
            tableHTML += `<tr><td><strong>${this.escapeHtml(student.name)}</strong></td>`;
            
            for (const date of dates) {
                const status = attendanceByDate[date]?.[student.id];
                let statusShort = '-';
                let statusClass = '';
                
                if (status === 'hadir') {
                    statusShort = 'H';
                    statusClass = 'status-hadir';
                    hadir++;
                } else if (status === 'sakit') {
                    statusShort = 'S';
                    statusClass = 'status-sakit';
                    sakit++;
                } else if (status === 'izin') {
                    statusShort = 'I';
                    statusClass = 'status-izin';
                    izin++;
                } else if (status === 'alpa') {
                    statusShort = 'A';
                    statusClass = 'status-alpa';
                    alpa++;
                }
                
                tableHTML += `<td><span class="status-badge ${statusClass}">${statusShort}</span></td>`;
            }
            
            classTotalHadir += hadir;
            classTotalSakit += sakit;
            classTotalIzin += izin;
            classTotalAlpa += alpa;
            
            const totalDays = dates.length;
            const totalPresent = hadir + sakit + izin;
            const percent = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;
            const percentClass = percent >= 80 ? 'status-hadir' : (percent >= 60 ? 'status-izin' : 'status-alpa');
            
            tableHTML += `
                <td><span class="status-badge status-hadir">${hadir}</span></td>
                <td><span class="status-badge status-sakit">${sakit}</span></td>
                <td><span class="status-badge status-izin">${izin}</span></td>
                <td><span class="status-badge status-alpa">${alpa}</span></td>
                <td><span class="status-badge ${percentClass}">${percent}%</span></td>
            </tr>`;
        }
        
        tableHTML += `</tbody></table></div>`;
        
        const totalRecords = students.length * dates.length;
        const totalPresent = classTotalHadir + classTotalSakit + classTotalIzin;
        const classAttendanceRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
        
        const summaryHTML = `
            <div class="stats-grid mt-3">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-calendar"></i></div>
                    <div class="stat-info">
                        <h4>Total Hari</h4>
                        <div class="value">${dates.length}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-info">
                        <h4>Total Hadir</h4>
                        <div class="value">${classTotalHadir}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-info">
                        <h4>Persentase</h4>
                        <div class="value">${classAttendanceRate}%</div>
                    </div>
                </div>
            </div>
            <div class="d-flex justify-content-end mt-3">
                <button class="btn btn-success" id="downloadRecapBtn">
                    <i class="fas fa-file-excel"></i> Download Excel
                </button>
            </div>
        `;
        
        container.innerHTML = tableHTML + summaryHTML;
        
        const downloadBtn = document.getElementById('downloadRecapBtn');
        if (downloadBtn) {
            downloadBtn.onclick = () => this.downloadRecapExcel(startDate, endDate);
        }
    }

    async downloadRecapExcel(startDate, endDate) {
        if (!this.currentClass) return;
        
        const students = await db.getStudents(this.currentClass);
        const attendanceRecords = await db.getAttendanceByDateRange(this.currentClass, startDate, endDate);
        const classes = await db.getClasses();
        const classItem = classes.find(c => c.id === this.currentClass);
        
        if (window.ReportExporter) {
            await window.ReportExporter.exportStudentRecapToExcel(
                this.currentClass, startDate, endDate, classItem?.name || this.currentClass, students, attendanceRecords
            );
            this.showNotification('Rekap Excel berhasil diunduh', 'success');
        } else {
            this.showNotification('Fitur export tidak tersedia', 'error');
        }
    }

    // ==================== STATISTICS ====================
    
    async showStatistics() {
        if (!this.currentClass) {
            this.showNotification('Pilih kelas terlebih dahulu', 'error');
            return;
        }
        
        const students = await db.getStudents(this.currentClass);
        const attendanceRecords = await db.getAllAttendance();
        const classAttendance = attendanceRecords.filter(a => a.classId === this.currentClass);
        
        const stats = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        classAttendance.forEach(a => {
            if (stats[a.status] !== undefined) stats[a.status]++;
        });
        
        const total = classAttendance.length;
        const container = document.getElementById('statsContainer');
        
        if (!container) return;
        
        const statusIcons = { hadir: 'fa-check-circle', sakit: 'fa-thermometer-half', izin: 'fa-envelope', alpa: 'fa-times-circle' };
        const statusColors = { hadir: '#06d6a0', sakit: '#4895ef', izin: '#f72585', alpa: '#e63946' };
        
        container.innerHTML = '';
        
        for (const status of this.attendanceStatuses) {
            const count = stats[status.id];
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            
            container.innerHTML += `
                <div class="stat-card">
                    <div class="stat-icon" style="background: ${statusColors[status.id]}">
                        <i class="fas ${statusIcons[status.id]}"></i>
                    </div>
                    <div class="stat-info">
                        <h4>${status.name}</h4>
                        <div class="value">${count} (${percentage}%)</div>
                    </div>
                </div>
            `;
        }
        
        const detailedStats = document.getElementById('detailedStats');
        if (detailedStats) {
            const classes = await db.getClasses();
            const classItem = classes.find(c => c.id === this.currentClass);
            detailedStats.innerHTML = `<p class="text-muted">Total catatan kehadiran: ${total} | Total siswa: ${students.length}</p>`;
        }
        
        this.showModal('statsModal');
    }

    // ==================== DATA MANAGEMENT ====================
    
    async backupData() {
        const data = {
            classes: await db.getClasses(),
            students: await db.getStudents(),
            attendance: await db.getAllAttendance(),
            grades: await db.getAllGrades(),
            backupDate: new Date().toISOString()
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_sistem_kehadiran_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('Backup data berhasil', 'success');
    }

    async restoreData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const confirmed = confirm('Restore data akan mengganti semua data yang ada. Lanjutkan?');
        if (!confirmed) {
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.classes || !data.students) {
                    throw new Error('Format file backup tidak valid');
                }
                
                // Clear all stores
                const stores = ['classes', 'students', 'attendance', 'grades'];
                for (const storeName of stores) {
                    await db.clear(storeName);
                }
                
                // Restore data
                for (const cls of data.classes) {
                    await db.addClass(cls);
                }
                
                for (const student of data.students) {
                    await db.addStudent(student);
                }
                
                if (data.attendance) {
                    for (const att of data.attendance) {
                        await db.addAttendance(att);
                    }
                }
                
                if (data.grades) {
                    for (const grade of data.grades) {
                        await db.addGrade(grade);
                    }
                }
                
                this.showNotification('Restore data berhasil', 'success');
                await this.loadClasses();
                
                if (this.currentClass) {
                    await this.renderAttendanceTable();
                    await this.loadStudentRecap();
                    if (this.gradeManager) {
                        await this.gradeManager.loadGradesTable();
                    }
                }
            } catch (error) {
                console.error(error);
                this.showNotification('File backup tidak valid', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    async resetData() {
        const confirmed = confirm('Apakah Anda yakin ingin mereset semua data? Tindakan ini tidak dapat dibatalkan.');
        if (confirmed) {
            await db.resetAll();
            this.showNotification('Data berhasil direset', 'success');
            location.reload();
        }
    }

    // ==================== CLASS & STUDENT MANAGEMENT ====================
    
    async showManageModal() {
        await this.loadClassesTable();
        await this.loadStudentsTable();
        await this.loadClassFilter();
        this.showModal('manageModal');
    }

    async loadClassesTable() {
        const classes = await db.getClasses();
        const tbody = document.getElementById('classesTableBody');
        if (!tbody) return;
        
        if (classes.length === 0) {
            tbody.innerHTML = '<td><td colspan="4" class="text-center text-muted">Belum ada kelas</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        for (const cls of classes) {
            const students = await db.getStudents(cls.id);
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${this.escapeHtml(cls.id)}</td>
                <td><strong>${this.escapeHtml(cls.name)}</strong></td>
                <td>${students.length}</td>
                <td>
                    <button class="btn btn-sm btn-outline edit-class" data-class-id="${cls.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-class" data-class-id="${cls.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                  </td>
            `;
        }
        
        document.querySelectorAll('.edit-class').forEach(btn => {
            btn.onclick = () => this.editClass(btn.dataset.classId);
        });
        document.querySelectorAll('.delete-class').forEach(btn => {
            btn.onclick = () => this.deleteClass(btn.dataset.classId);
        });
    }

    async loadStudentsTable() {
        const classFilter = document.getElementById('studentClassFilter')?.value;
        let students = await db.getStudents();
        
        if (classFilter) {
            students = students.filter(s => s.classId === classFilter);
        }
        
        const classes = await db.getClasses();
        const classMap = new Map(classes.map(c => [c.id, c.name]));
        
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;
        
        if (students.length === 0) {
            tbody.innerHTML = '<td><td colspan="4" class="text-center text-muted">Belum ada siswa</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        students.forEach((student, idx) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${idx + 1}</td>
                <td><strong>${this.escapeHtml(student.name)}</strong></td>
                <td>${this.escapeHtml(classMap.get(student.classId) || student.classId)}</td>
                <td>
                    <button class="btn btn-sm btn-outline edit-student" data-student-id="${student.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-student" data-student-id="${student.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                  </td>
            `;
        });
        
        document.querySelectorAll('.edit-student').forEach(btn => {
            btn.onclick = () => this.editStudent(parseInt(btn.dataset.studentId));
        });
        document.querySelectorAll('.delete-student').forEach(btn => {
            btn.onclick = () => this.deleteStudent(parseInt(btn.dataset.studentId));
        });
    }

    async loadClassFilter() {
        const classes = await db.getClasses();
        const filter = document.getElementById('studentClassFilter');
        const studentClassSelect = document.getElementById('studentClass');
        
        if (filter) {
            const currentValue = filter.value;
            filter.innerHTML = '<option value="">Semua Kelas</option>' +
                classes.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');
            if (currentValue) filter.value = currentValue;
        }
        
        if (studentClassSelect) {
            const currentValue = studentClassSelect.value;
            studentClassSelect.innerHTML = '<option value="">Pilih Kelas</option>' +
                classes.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');
            if (currentValue) studentClassSelect.value = currentValue;
        }
    }

    showAddClassModal() {
        const title = document.getElementById('classFormTitle');
        const classId = document.getElementById('classId');
        const className = document.getElementById('className');
        const classStudents = document.getElementById('classStudents');
        
        if (title) title.innerHTML = '<i class="fas fa-plus"></i> Tambah Kelas';
        if (classId) {
            classId.value = '';
            classId.readOnly = false;
        }
        if (className) className.value = '';
        if (classStudents) classStudents.value = '';
        
        this.showModal('classFormModal');
    }

    async editClass(classId) {
        const classes = await db.getClasses();
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;
        
        const students = await db.getStudents(classId);
        const studentNames = students.map(s => s.name).join('\n');
        
        const title = document.getElementById('classFormTitle');
        const classIdInput = document.getElementById('classId');
        const classNameInput = document.getElementById('className');
        const classStudents = document.getElementById('classStudents');
        
        if (title) title.innerHTML = '<i class="fas fa-edit"></i> Edit Kelas';
        if (classIdInput) {
            classIdInput.value = cls.id;
            classIdInput.readOnly = true;
        }
        if (classNameInput) classNameInput.value = cls.name;
        if (classStudents) classStudents.value = studentNames;
        
        this.showModal('classFormModal');
    }

    async deleteClass(classId) {
        const confirmed = confirm(`Hapus kelas "${classId}"? Semua data terkait akan dihapus.`);
        if (confirmed) {
            await db.deleteClass(classId);
            await this.loadClassesTable();
            await this.loadStudentsTable();
            await this.loadClassFilter();
            await this.loadClasses();
            this.showNotification('Kelas berhasil dihapus', 'success');
            
            if (this.currentClass === classId) {
                this.currentClass = null;
                const selector = document.getElementById('classSelector');
                if (selector) selector.value = '';
                const mainContent = document.getElementById('mainContent');
                const selectedInfo = document.getElementById('selectedClassInfo');
                if (mainContent) mainContent.style.display = 'none';
                if (selectedInfo) selectedInfo.style.display = 'none';
            }
        }
    }

    async saveClass(event) {
        event.preventDefault();
        
        const classId = document.getElementById('classId').value.trim();
        const className = document.getElementById('className').value.trim();
        const studentsText = document.getElementById('classStudents').value;
        
        if (!classId || !className) {
            this.showNotification('ID Kelas dan Nama Kelas harus diisi', 'error');
            return;
        }
        
        if (!/^[a-z0-9-]+$/.test(classId)) {
            this.showNotification('ID Kelas hanya boleh berisi huruf kecil, angka, dan tanda hubung', 'error');
            return;
        }
        
        const existingClasses = await db.getClasses();
        const isNew = !existingClasses.find(c => c.id === classId);
        
        if (isNew) {
            await db.addClass({ id: classId, name: className, createdAt: new Date().toISOString() });
        } else {
            await db.updateClass({ id: classId, name: className });
        }
        
        // Handle students
        const studentNames = studentsText.split('\n').filter(s => s.trim().length > 0);
        const existingStudents = await db.getStudents(classId);
        
        // Delete removed students
        for (const existing of existingStudents) {
            if (!studentNames.includes(existing.name)) {
                await db.deleteStudent(existing.id);
            }
        }
        
        // Add or update students
        for (const studentName of studentNames) {
            const existing = existingStudents.find(s => s.name === studentName);
            if (existing) {
                if (existing.name !== studentName) {
                    existing.name = studentName;
                    await db.updateStudent(existing);
                }
            } else {
                await db.addStudent({
                    name: studentName,
                    classId: classId,
                    createdAt: new Date().toISOString()
                });
            }
        }
        
        this.closeModal('classFormModal');
        await this.loadClassesTable();
        await this.loadStudentsTable();
        await this.loadClassFilter();
        await this.loadClasses();
        this.showNotification(isNew ? 'Kelas berhasil ditambahkan' : 'Kelas berhasil diupdate', 'success');
        
        if (this.currentClass === classId) {
            const students = await db.getStudents(classId);
            const infoStudentCount = document.getElementById('infoStudentCount');
            if (infoStudentCount) infoStudentCount.textContent = students.length;
            await this.renderAttendanceTable();
            await this.loadStudentRecap();
        }
    }

    showAddStudentModal() {
        const title = document.getElementById('studentFormTitle');
        const studentId = document.getElementById('studentId');
        const studentName = document.getElementById('studentName');
        const studentClass = document.getElementById('studentClass');
        
        if (title) title.innerHTML = '<i class="fas fa-user-plus"></i> Tambah Siswa';
        if (studentId) studentId.value = '';
        if (studentName) studentName.value = '';
        if (studentClass) studentClass.value = '';
        
        this.showModal('studentFormModal');
    }

    async editStudent(studentId) {
        const students = await db.getStudents();
        const student = students.find(s => s.id === studentId);
        if (!student) return;
        
        const title = document.getElementById('studentFormTitle');
        const idInput = document.getElementById('studentId');
        const nameInput = document.getElementById('studentName');
        const classSelect = document.getElementById('studentClass');
        
        if (title) title.innerHTML = '<i class="fas fa-edit"></i> Edit Siswa';
        if (idInput) idInput.value = student.id;
        if (nameInput) nameInput.value = student.name;
        if (classSelect) classSelect.value = student.classId;
        
        this.showModal('studentFormModal');
    }

    async deleteStudent(studentId) {
        const confirmed = confirm('Hapus siswa ini? Data kehadiran dan nilai juga akan dihapus.');
        if (confirmed) {
            await db.deleteStudent(studentId);
            await this.loadStudentsTable();
            await this.loadClassesTable();
            if (this.currentClass) {
                await this.renderAttendanceTable();
                await this.loadStudentRecap();
                const students = await db.getStudents(this.currentClass);
                const infoStudentCount = document.getElementById('infoStudentCount');
                if (infoStudentCount) infoStudentCount.textContent = students.length;
            }
            this.showNotification('Siswa berhasil dihapus', 'success');
        }
    }

    async saveStudent(event) {
        event.preventDefault();
        
        const studentId = document.getElementById('studentId').value;
        const studentName = document.getElementById('studentName').value.trim();
        const classId = document.getElementById('studentClass').value;
        
        if (!studentName || !classId) {
            this.showNotification('Nama siswa dan kelas harus diisi', 'error');
            return;
        }
        
        if (studentId) {
            await db.updateStudent({ id: parseInt(studentId), name: studentName, classId: classId });
            this.showNotification('Siswa berhasil diupdate', 'success');
        } else {
            await db.addStudent({
                name: studentName,
                classId: classId,
                createdAt: new Date().toISOString()
            });
            this.showNotification('Siswa berhasil ditambahkan', 'success');
        }
        
        this.closeModal('studentFormModal');
        await this.loadStudentsTable();
        await this.loadClassesTable();
        
        if (this.currentClass === classId) {
            await this.renderAttendanceTable();
            await this.loadStudentRecap();
            const students = await db.getStudents(this.currentClass);
            const infoStudentCount = document.getElementById('infoStudentCount');
            if (infoStudentCount) infoStudentCount.textContent = students.length;
        }
    }

    // ==================== IMPORT/EXPORT ====================
    
    async importClassesFromFile() {
        const fileInput = document.getElementById('importClassesFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showNotification('Pilih file terlebih dahulu', 'error');
            return;
        }
        
        const extension = file.name.split('.').pop().toLowerCase();
        
        try {
            let data;
            
            if (extension === 'csv') {
                const text = await file.text();
                data = this.parseCSV(text);
            } else if (extension === 'xlsx' || extension === 'xls') {
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer);
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            } else {
                this.showNotification('Format file tidak didukung. Gunakan .csv atau .xlsx', 'error');
                return;
            }
            
            let startRow = 0;
            if (data[0] && (data[0][0]?.toLowerCase().includes('kelas') || data[0][1]?.toLowerCase().includes('siswa'))) {
                startRow = 1;
            }
            
            const classMap = new Map();
            
            for (let i = startRow; i < data.length; i++) {
                const row = data[i];
                if (!row[0] || !row[1]) continue;
                
                const className = row[0].toString().trim();
                const studentName = row[1].toString().trim();
                
                if (!classMap.has(className)) {
                    classMap.set(className, []);
                }
                classMap.get(className).push(studentName);
            }
            
            let classCount = 0;
            let studentCount = 0;
            
            for (const [className, students] of classMap) {
                const classId = className.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const existingClasses = await db.getClasses();
                const existingClass = existingClasses.find(c => c.id === classId);
                
                if (!existingClass) {
                    await db.addClass({ id: classId, name: className, createdAt: new Date().toISOString() });
                    classCount++;
                }
                
                for (const studentName of students) {
                    const existingStudents = await db.getStudents(classId);
                    if (!existingStudents.find(s => s.name === studentName)) {
                        await db.addStudent({
                            name: studentName,
                            classId: classId,
                            createdAt: new Date().toISOString()
                        });
                        studentCount++;
                    }
                }
            }
            
            await this.loadClassesTable();
            await this.loadStudentsTable();
            await this.loadClassFilter();
            await this.loadClasses();
            
            this.showNotification(`Import selesai: ${classCount} kelas baru, ${studentCount} siswa baru`, 'success');
            fileInput.value = '';
            
        } catch (error) {
            console.error(error);
            this.showNotification('Gagal import file. Pastikan format file benar.', 'error');
        }
    }

    parseCSV(text) {
        const lines = text.split(/\r?\n/);
        return lines
            .filter(line => line.trim().length > 0)
            .map(line => {
                const regex = /("([^"]*)")|([^,]+)/g;
                const matches = [];
                let match;
                while ((match = regex.exec(line)) !== null) {
                    matches.push((match[2] || match[3] || '').trim());
                }
                return matches.length ? matches : line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
            });
    }

    downloadTemplate() {
        const templateData = [
            ['Nama Kelas', 'Nama Siswa'],
            ['VII-1', 'Ahmad Fauzi'],
            ['VII-1', 'Budi Santoso'],
            ['VII-2', 'Citra Dewi'],
            ['VII-2', 'Dian Pratama'],
            ['VIII-1', 'Eka Putri'],
            ['VIII-1', 'Fajar Nugroho']
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Kelas & Siswa');
        ws['!cols'] = [{ wch: 20 }, { wch: 30 }];
        XLSX.writeFile(wb, 'template_import_kelas_siswa.xlsx');
        this.showNotification('Template berhasil diunduh', 'success');
    }

    // ==================== GRADE MANAGEMENT DELEGATION ====================
    
    saveEditGrade() {
        if (this.gradeManager) {
            this.gradeManager.saveEditGrade();
        }
    }

    // ==================== UTILITIES ====================
    
    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        // Pastikan attendanceDate memiliki nilai
        const attendanceDate = document.getElementById('attendanceDate');
        if (attendanceDate && !attendanceDate.value) {
            attendanceDate.value = today;
        }
        
        const recapStart = document.getElementById('recapStartDate');
        const recapEnd = document.getElementById('recapEndDate');
        
        if (recapStart && !recapStart.value) {
            recapStart.value = weekAgo.toISOString().split('T')[0];
        }
        if (recapEnd && !recapEnd.value) {
            recapEnd.value = today;
        }
    }

    switchTab(event) {
        const tab = event.target.closest('.tab');
        if (!tab) return;
        
        const tabName = tab.getAttribute('data-tab');
        
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabContent = document.getElementById(`${tabName}Tab`);
        if (tabContent) tabContent.classList.add('active');
        
        if (tabName === 'recap') {
            this.loadStudentRecap();
        }
    }

    switchModalTab(event) {
        const tab = event.target.closest('.modal-tab');
        if (!tab) return;
        
        const tabName = tab.getAttribute('data-modal-tab');
        
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const targetId = `modal${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`;
        const target = document.getElementById(targetId);
        if (target) target.classList.add('active');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) {
            // Fallback to global toast
            if (typeof showToast === 'function') {
                showToast(message, type);
            }
            return;
        }
        
        toast.textContent = message;
        toast.className = `toast toast-${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    async checkStorageStatus() {
        try {
            const stats = await db.getStats();
            console.log('Storage Status:', stats);
            return true;
        } catch (error) {
            console.error('Storage check failed:', error);
            return false;
        }
    }
        // ==================== SQL OPTIMIZED QUERIES ====================
    // Tambahkan method ini setelah checkStorageStatus()

    async getClassPerformanceReport() {
        if (!this.currentClass) return null;
        
        try {
            // Gunakan SQL untuk query kompleks
            if (window.sqlEngine && window.sqlEngine.isReady) {
                const report = window.sqlEngine.getAll(`
                    SELECT 
                        s.name as student_name,
                        AVG(g.score) as avg_score,
                        COUNT(DISTINCT g.assessmentType) as total_assessments,
                        COUNT(CASE WHEN a.status = 'hadir' THEN 1 END) as attendance_count
                    FROM students s
                    LEFT JOIN grades g ON s.id = g.studentId
                    LEFT JOIN attendance a ON s.id = a.studentId AND a.date BETWEEN date('now', '-30 days') AND date('now')
                    WHERE s.classId = ?
                    GROUP BY s.id
                    ORDER BY avg_score DESC
                `, [this.currentClass]);
                
                return report;
            }
        } catch (error) {
            console.error('Failed to get performance report:', error);
        }
        
        return null;
    }

    async getTopPerformer(limit = 5) {
        if (!this.currentClass) return [];
        
        try {
            if (window.sqlEngine && window.sqlEngine.isReady) {
                return window.sqlEngine.getAll(`
                    SELECT 
                        s.id,
                        s.name, 
                        AVG(g.score) as avg_score,
                        COUNT(g.id) as total_grades
                    FROM students s
                    JOIN grades g ON s.id = g.studentId
                    WHERE s.classId = ?
                    GROUP BY s.id
                    ORDER BY avg_score DESC
                    LIMIT ?
                `, [this.currentClass, limit]);
            }
        } catch (error) {
            console.error('Failed to get top performers:', error);
        }
        
        return [];
    }

    async getAttendanceSummarySQL() {
        if (!this.currentClass) return null;
        
        try {
            if (window.sqlEngine && window.sqlEngine.isReady) {
                return window.sqlEngine.getFirst(`
                    SELECT 
                        COUNT(CASE WHEN status = 'hadir' THEN 1 END) as hadir,
                        COUNT(CASE WHEN status = 'sakit' THEN 1 END) as sakit,
                        COUNT(CASE WHEN status = 'izin' THEN 1 END) as izin,
                        COUNT(CASE WHEN status = 'alpha' THEN 1 END) as alpha,
                        COUNT(*) as total,
                        ROUND(CAST(COUNT(CASE WHEN status = 'hadir' THEN 1 END) AS FLOAT) / COUNT(*) * 100, 1) as attendance_rate
                    FROM attendance
                    WHERE classId = ?
                `, [this.currentClass]);
            }
        } catch (error) {
            console.error('Failed to get attendance summary:', error);
        }
        
        return null;
    }

    async getStudentGradeDistribution() {
        if (!this.currentClass) return null;
        
        try {
            if (window.sqlEngine && window.sqlEngine.isReady) {
                return window.sqlEngine.getAll(`
                    SELECT 
                        CASE 
                            WHEN g.score >= 90 THEN 'A (90-100)'
                            WHEN g.score >= 80 THEN 'B (80-89)'
                            WHEN g.score >= 70 THEN 'C (70-79)'
                            WHEN g.score >= 60 THEN 'D (60-69)'
                            ELSE 'E (<60)'
                        END as grade_letter,
                        COUNT(*) as count,
                        ROUND(CAST(COUNT(*) AS FLOAT) / (SELECT COUNT(*) FROM grades WHERE classId = ?) * 100, 1) as percentage
                    FROM grades g
                    WHERE g.classId = ?
                    GROUP BY grade_letter
                    ORDER BY MIN(g.score) DESC
                `, [this.currentClass, this.currentClass]);
            }
        } catch (error) {
            console.error('Failed to get grade distribution:', error);
        }
        
        return null;
    }

    // Dashboard widget untuk menampilkan hasil SQL query
    async showPerformanceDashboard() {
        const topStudents = await this.getTopPerformer(5);
        const attendanceSummary = await this.getAttendanceSummarySQL();
        const gradeDistribution = await this.getStudentGradeDistribution();
        
        let dashboardHtml = `
            <div class="performance-dashboard" style="padding: 15px;">
                <h4 style="margin-bottom: 15px;">🏆 Top 5 Performa Akademik</h4>
                <div class="top-performer-list" style="margin-bottom: 20px;">
                    ${topStudents.map((s, i) => `
                        <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee;">
                            <span style="font-weight: bold;">${i + 1}. ${this.escapeHtml(s.name)}</span>
                            <span style="color: #4361ee;">⭐ ${Math.round(s.avg_score)}</span>
                        </div>
                    `).join('')}
                </div>
        `;
        
        if (attendanceSummary) {
            dashboardHtml += `
                <h4 style="margin-bottom: 15px;">📊 Ringkasan Kehadiran</h4>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;">
                    <div style="background: #06d6a0; padding: 10px; border-radius: 8px; text-align: center; color: white;">
                        <div style="font-size: 20px; font-weight: bold;">${attendanceSummary.hadir || 0}</div>
                        <div style="font-size: 12px;">Hadir</div>
                    </div>
                    <div style="background: #4895ef; padding: 10px; border-radius: 8px; text-align: center; color: white;">
                        <div style="font-size: 20px; font-weight: bold;">${attendanceSummary.sakit || 0}</div>
                        <div style="font-size: 12px;">Sakit</div>
                    </div>
                    <div style="background: #f72585; padding: 10px; border-radius: 8px; text-align: center; color: white;">
                        <div style="font-size: 20px; font-weight: bold;">${attendanceSummary.izin || 0}</div>
                        <div style="font-size: 12px;">Izin</div>
                    </div>
                    <div style="background: #e63946; padding: 10px; border-radius: 8px; text-align: center; color: white;">
                        <div style="font-size: 20px; font-weight: bold;">${attendanceSummary.alpha || 0}</div>
                        <div style="font-size: 12px;">Alpha</div>
                    </div>
                    <div style="background: #4361ee; padding: 10px; border-radius: 8px; text-align: center; color: white;">
                        <div style="font-size: 20px; font-weight: bold;">${attendanceSummary.attendance_rate || 0}%</div>
                        <div style="font-size: 12px;">Kehadiran</div>
                    </div>
                </div>
            `;
        }
        
        if (gradeDistribution && gradeDistribution.length > 0) {
            dashboardHtml += `
                <h4 style="margin-bottom: 15px;">📈 Distribusi Nilai</h4>
                <div style="margin-bottom: 20px;">
                    ${gradeDistribution.map(g => `
                        <div style="margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span>${g.grade_letter}</span>
                                <span>${g.count} siswa (${g.percentage}%)</span>
                            </div>
                            <div style="background: #e0e0e0; border-radius: 10px; overflow: hidden;">
                                <div style="background: #4361ee; width: ${g.percentage}%; height: 8px;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        dashboardHtml += `</div>`;
        
        // Tampilkan di modal atau container
        const container = document.getElementById('performanceContainer');
        if (container) {
            container.innerHTML = dashboardHtml;
            container.style.display = 'block';
        } else {
            // Create temporary modal
            this.showPerformanceModal(dashboardHtml);
        }
    }

    showPerformanceModal(contentHtml) {
        // Check if modal exists
        let modal = document.getElementById('performanceModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'performanceModal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10001;
            `;
            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 80%; overflow: auto; padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3>📊 Dashboard Performa Kelas</h3>
                        <button id="closePerformanceModal" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
                    </div>
                    <div id="performanceModalContent"></div>
                </div>
            `;
            document.body.appendChild(modal);
            
            document.getElementById('closePerformanceModal').onclick = () => {
                modal.style.display = 'none';
            };
            
            modal.onclick = (e) => {
                if (e.target === modal) modal.style.display = 'none';
            };
        }
        
        const contentDiv = document.getElementById('performanceModalContent');
        if (contentDiv) {
            contentDiv.innerHTML = contentHtml;
        }
        modal.style.display = 'flex';
    }
}