// ============================================
// grades.js - GRADE MANAGEMENT (Tanpa Supabase)
// ============================================

class GradeManager {
    constructor(ui) {
        this.ui = ui;
        this.gradesData = new Map();
        this.KKTP = 75;

        // Pagination
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.searchQuery = '';

        // Current session
        this.currentSession = {
            classId: null,
            className: '',
            subjectId: null,
            subjectName: '',
            assessmentType: '',
            date: '',
            scope: '',
            gradesData: {}
        };

        // Assessment types
        this.assessmentTypes = {
            'tes_tertulis': { name: 'Tes Tertulis', weight: 30, icon: 'fa-pen' },
            'tes_lisan': { name: 'Tes Lisan', weight: 20, icon: 'fa-microphone' },
            'proyek_akhir': { name: 'Proyek Akhir', weight: 25, icon: 'fa-project-diagram' },
            'portofolio_akhir': { name: 'Portofolio', weight: 15, icon: 'fa-folder-open' },
            'demonstrasi_pkl': { name: 'Demonstrasi / PKL', weight: 10, icon: 'fa-chalkboard-user' }
        };

        // Scope options
        this.scopeOptions = ['LM-1','LM-2','LM-3','LM-4','LM-5','LM-6','LM-7','LM-8','LM-9','UK'];
        this.scopeNames = {
            'LM-1': 'Lingkup Materi 1','LM-2': 'Lingkup Materi 2','LM-3': 'Lingkup Materi 3',
            'LM-4': 'Lingkup Materi 4','LM-5': 'Lingkup Materi 5','LM-6': 'Lingkup Materi 6',
            'LM-7': 'Lingkup Materi 7','LM-8': 'Lingkup Materi 8','LM-9': 'Lingkup Materi 9',
            'UK': 'Uji Kompetensi'
        };

        // Subjects
        this.subjects = [
            { id: 'pjok', name: 'PJOK', KKTP: 75 }
        ];

        this._handlers = {};
    }

    // ==================== INIT ====================
    
    async init() {
        console.log('GradeManager initializing...');
        this.bindEvents();
        this.setupSelectors();
        this.setDefaultDate();
        this.setupSearchAndPagination();
        console.log('GradeManager initialized');
    }

    // ==================== EVENT BINDING ====================
    
    bindEvents() {
        const saveBtn = document.getElementById('btnSimpanNilai');
        if (saveBtn) saveBtn.onclick = () => this.saveAllGrades();

        const generateBtn = document.getElementById('btnGenerateNilai');
        if (generateBtn) generateBtn.onclick = () => this.generateRandomGrades();

        const clearBtn = document.getElementById('btnClearAll');
        if (clearBtn) clearBtn.onclick = () => this.clearAllGrades();

        const resetGradesBtn = document.getElementById('resetGradesBtn');
        if (resetGradesBtn) resetGradesBtn.onclick = () => this.showResetConfirmation();

        const exportBtn = document.getElementById('exportGradesBtn');
        if (exportBtn) exportBtn.onclick = () => this.exportGradesToExcel();

        const previewBtn = document.getElementById('previewGradesRecapBtn');
        if (previewBtn) previewBtn.onclick = () => this.loadGradesRecap(true);

        const refreshBtn = document.getElementById('loadGradesRecapBtn');
        if (refreshBtn) refreshBtn.onclick = () => this.loadGradesRecap(false);

        const mapelSelect = document.getElementById('nilaiMapel');
        if (mapelSelect) mapelSelect.onchange = () => this.onSubjectChange();

        const manualMapel = document.getElementById('mapelManual');
        if (manualMapel) manualMapel.oninput = () => this.onManualMapelChange();

        const tipeSelect = document.getElementById('nilaiTipe');
        if (tipeSelect) tipeSelect.onchange = () => this.onAssessmentChange();

        const lingkupSelect = document.getElementById('nilaiLingkup');
        if (lingkupSelect) lingkupSelect.onchange = () => this.onScopeChange();

        const tanggalInput = document.getElementById('nilaiTanggal');
        if (tanggalInput) tanggalInput.onchange = () => this.onDateChange();

        const closeResetModal = document.getElementById('closeResetModal');
        if (closeResetModal) closeResetModal.onclick = () => this.closeResetModal();
        
        const cancelResetBtn = document.getElementById('cancelResetBtn');
        if (cancelResetBtn) cancelResetBtn.onclick = () => this.closeResetModal();
        
        const confirmResetBtn = document.getElementById('confirmResetBtn');
        if (confirmResetBtn) confirmResetBtn.onclick = () => this.executeResetGrades();

        const closePreviewBtn = document.getElementById('closePreviewRecapModal');
        if (closePreviewBtn) closePreviewBtn.onclick = () => this.closePreviewModal();
        
        const exportRecapBtn = document.getElementById('exportRecapToExcelBtn');
        if (exportRecapBtn) exportRecapBtn.onclick = () => this.exportRecapToExcel();

        const closeEditModal = document.getElementById('closeEditModal');
        if (closeEditModal) closeEditModal.onclick = () => this.closeEditModal();
        
        const cancelEdit = document.getElementById('cancelEdit');
        if (cancelEdit) cancelEdit.onclick = () => this.closeEditModal();
        
        const saveEdit = document.getElementById('saveEdit');
        if (saveEdit) saveEdit.onclick = () => this.saveEditGrade();
    }

    // ==================== HELPERS ====================
    
    getEl(id) { return document.getElementById(id); }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = this.getEl('nilaiTanggal');
        if (dateInput && !dateInput.value) {
            dateInput.value = today;
            this.currentSession.date = today;
        }
    }

    setupSelectors() {
        const mapelSelect = this.getEl('nilaiMapel');
        if (mapelSelect) {
            mapelSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>' +
                this.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('') +
                '<option value="lainnya">Lainnya...</option>';
        }

        const tipeSelect = this.getEl('nilaiTipe');
        if (tipeSelect) {
            tipeSelect.innerHTML = '<option value="">-- Pilih Tipe --</option>' +
                Object.entries(this.assessmentTypes).map(([id, data]) => 
                    `<option value="${id}">${data.name}</option>`
                ).join('');
        }

        const lingkupSelect = this.getEl('nilaiLingkup');
        if (lingkupSelect) {
            lingkupSelect.innerHTML = '<option value="">-- Pilih Lingkup --</option>' +
                this.scopeOptions.map(s => `<option value="${s}">${this.scopeNames[s] || s}</option>`).join('');
        }
    }

    updateCurrentSession() {
        let subjectId = this.getEl('nilaiMapel')?.value || '';
        let manualMapel = this.getEl('mapelManual')?.value || '';
        let subjectName = subjectId === 'lainnya' ? manualMapel :
            this.subjects.find(s => s.id === subjectId)?.name || subjectId;

        this.currentSession.subjectId = subjectId;
        this.currentSession.subjectName = subjectName;
        this.currentSession.assessmentType = this.getEl('nilaiTipe')?.value || '';
        this.currentSession.date = this.getEl('nilaiTanggal')?.value || '';
        this.currentSession.scope = this.getEl('nilaiLingkup')?.value || '';

        const subject = this.subjects.find(s => s.id === subjectId);
        if (subject?.KKTP) this.KKTP = subject.KKTP;

        console.log('Session updated:', this.currentSession);
    }

    onSubjectChange() {
        const mapelSelect = this.getEl('nilaiMapel');
        const manualGroup = this.getEl('mapelManualGroup');
        if (manualGroup) {
            manualGroup.style.display = mapelSelect?.value === 'lainnya' ? 'block' : 'none';
        }
        this.updateCurrentSession();
        this.loadGradesTable();
    }

    onManualMapelChange() { this.updateCurrentSession(); }
    onAssessmentChange() { this.updateCurrentSession(); this.loadGradesTable(); }
    onScopeChange() { this.updateCurrentSession(); this.loadGradesTable(); }
    onDateChange() { this.updateCurrentSession(); this.loadGradesTable(); }

       // ==================== OPTIMIZED QUERIES WITH SQL ====================

    async getStudentAverageWithSQL(studentId) {
        // Gunakan SQL untuk perhitungan yang lebih cepat
        if (window.sqlEngine && window.sqlEngine.isReady) {
            return window.sqlEngine.getFirst(`
                SELECT 
                    AVG(score) as average,
                    COUNT(*) as total,
                    MAX(score) as highest,
                    MIN(score) as lowest
                FROM grades
                WHERE studentId = ?
            `, [studentId]);
        }
        
        // Fallback ke method lama
        return await this.getStudentAverageScore(studentId);
    }

    async getClassAnalytics() {
        const { classId } = this.currentSession;
        if (!classId) return null;
        
        if (window.sqlEngine && window.sqlEngine.isReady) {
            return window.sqlEngine.getFirst(`
                SELECT 
                    COUNT(DISTINCT s.id) as total_students,
                    COUNT(DISTINCT g.assessmentType) as assessment_types,
                    AVG(g.score) as class_average,
                    MAX(g.score) as highest_score,
                    MIN(g.score) as lowest_score,
                    COUNT(CASE WHEN g.score >= 75 THEN 1 END) as students_passed
                FROM students s
                LEFT JOIN grades g ON s.id = g.studentId
                WHERE s.classId = ?
            `, [classId]);
        }
        
        return null;
    }

    // Perbaiki method loadGradesTable untuk menggunakan SQL jika memungkinkan
    async loadGradesTableOptimized() {
        const { classId, assessmentType, date, scope } = this.currentSession;
        
        if (!classId) return;
        
        // Gunakan SQL JOIN untuk mengambil data sekaligus
        if (window.sqlEngine && window.sqlEngine.isReady && assessmentType && date && scope) {
            const results = window.sqlEngine.getAll(`
                SELECT 
                    s.id as student_id,
                    s.name as student_name,
                    g.id as grade_id,
                    g.score,
                    g.notes
                FROM students s
                LEFT JOIN grades g ON s.id = g.studentId 
                    AND g.classId = ? 
                    AND g.assessmentType = ? 
                    AND g.date = ? 
                    AND g.scope = ?
                WHERE s.classId = ?
                ORDER BY s.name
            `, [classId, assessmentType, date, scope, classId]);
            
            // Process results...
            return results;
        }
        
        // Fallback ke method lama
        return this.loadGradesTable();
    }
    // ==================== CLASS CHANGE ====================
    
    async onClassChange(classId, className) {
        console.log('GradeManager onClassChange:', classId, className);
        this.currentSession.classId = classId;
        this.currentSession.className = className || classId;
        this.currentSession.gradesData = {};
        this.currentPage = 1;
        this.searchQuery = '';
        
        const searchInput = document.getElementById('searchGradeStudent');
        if (searchInput) searchInput.value = '';
        
        const totalSiswaElem = document.getElementById('totalSiswaNilai');
        if (totalSiswaElem) {
            const students = await db.getStudents(classId);
            totalSiswaElem.textContent = students.length;
        }
        
        await this.loadGradesTable();
        await this.loadGradesRecap(false);
        
        const saveBtn = document.getElementById('btnSimpanNilai');
        if (saveBtn) saveBtn.disabled = true;
    }

    // ==================== SEARCH & PAGINATION ====================
    
    setupSearchAndPagination() {
        let searchInput = document.getElementById('searchGradeStudent');
        if (!searchInput) {
            const gradesTab = document.getElementById('gradesTab');
            if (gradesTab) {
                const searchDiv = document.createElement('div');
                searchDiv.className = 'form-row mb-3';
                searchDiv.innerHTML = `
                    <div class="form-group" style="flex: 1;">
                        <label><i class="fas fa-search"></i> Cari Siswa</label>
                        <input type="text" id="searchGradeStudent" class="form-control" placeholder="Nama siswa...">
                    </div>
                    <div class="form-group" style="flex: 0.3;">
                        <label><i class="fas fa-list"></i> Tampilkan</label>
                        <select id="gradesPerPage" class="form-control">
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                `;
                const gradesCard = gradesTab.querySelector('.card');
                if (gradesCard && gradesCard.querySelector('.card-body')) {
                    gradesCard.querySelector('.card-body').insertBefore(searchDiv, gradesCard.querySelector('.table-wrapper'));
                }
                searchInput = document.getElementById('searchGradeStudent');
            }
        }
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.currentPage = 1;
                this.loadGradesTable();
            });
        }

        const perPageSelect = document.getElementById('gradesPerPage');
        if (perPageSelect) {
            perPageSelect.addEventListener('change', (e) => {
                this.itemsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.loadGradesTable();
            });
        }
    }

    async goToPage(page) {
        this.currentPage = page;
        await this.loadGradesTable();
    }

    // ==================== GRADE INPUT ====================
    
    handleGradeInput(event) {
        const input = event.target;
        const studentId = parseInt(input.dataset.studentId);
        let nilai = input.value === '' ? null : parseFloat(input.value);

        if (!isNaN(nilai) && nilai >= 0 && nilai <= 100) {
            if (!this.currentSession.gradesData[studentId]) {
                this.currentSession.gradesData[studentId] = { id: null, nilai: '', catatan: '' };
            }
            this.currentSession.gradesData[studentId].nilai = nilai.toString();
            this.updatePredicateDisplay(studentId, nilai);
        } else if (input.value === '') {
            if (!this.currentSession.gradesData[studentId]) {
                this.currentSession.gradesData[studentId] = { id: null, nilai: '', catatan: '' };
            }
            this.currentSession.gradesData[studentId].nilai = '';
            this.updatePredicateDisplay(studentId, null);
        }
        
        const saveBtn = document.getElementById('btnSimpanNilai');
        if (saveBtn) saveBtn.disabled = false;
        this.updateStatisticsFromCurrentData();
    }

    handleCatatanInput(event) {
        const input = event.target;
        const studentId = parseInt(input.dataset.studentId);
        const catatan = input.value;
        
        if (!this.currentSession.gradesData[studentId]) {
            this.currentSession.gradesData[studentId] = { id: null, nilai: '', catatan: '' };
        }
        this.currentSession.gradesData[studentId].catatan = catatan;
        
        const saveBtn = document.getElementById('btnSimpanNilai');
        if (saveBtn) saveBtn.disabled = false;
    }
    
    updatePredicateDisplay(studentId, nilai) {
        const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
        if (!row) return;
        
        const nilaiCell = row.querySelector('.grade-value');
        if (!nilaiCell) return;
        
        const predicate = this.getPredicate(nilai);
        let badgeSpan = nilaiCell.querySelector('.grade-badge');
        
        if (!badgeSpan) {
            badgeSpan = document.createElement('span');
            badgeSpan.className = 'grade-badge';
            nilaiCell.appendChild(badgeSpan);
        }
        
        if (nilai !== null && !isNaN(nilai)) {
            badgeSpan.className = `grade-badge grade-${predicate.grade}`;
            badgeSpan.textContent = predicate.predikat;
            badgeSpan.style.marginLeft = '8px';
        } else {
            badgeSpan.textContent = '';
            badgeSpan.className = 'grade-badge';
        }
    }
    
    getPredicate(nilai) {
        if (nilai === null || nilai === undefined || isNaN(nilai)) {
            return { predikat: '-', grade: 'empty' };
        }
        if (nilai >= 90) return { predikat: 'A', grade: 'A' };
        if (nilai >= 80) return { predikat: 'B', grade: 'B' };
        if (nilai >= this.KKTP) return { predikat: 'C', grade: 'C' };
        if (nilai >= 60) return { predikat: 'D', grade: 'D' };
        return { predikat: 'E', grade: 'E' };
    }
        // ==================== SQL OPTIMIZED QUERIES ====================
    
    async getStudentAverageWithSQL(studentId) {
        // Gunakan SQL untuk perhitungan yang lebih cepat
        if (window.sqlEngine && window.sqlEngine.isReady) {
            try {
                return window.sqlEngine.getFirst(`
                    SELECT 
                        AVG(score) as average,
                        COUNT(*) as total,
                        MAX(score) as highest,
                        MIN(score) as lowest,
                        ROUND(AVG(score), 1) as rounded_average
                    FROM grades
                    WHERE studentId = ?
                `, [studentId]);
            } catch (error) {
                console.error('SQL average calculation failed:', error);
            }
        }
        
        // Fallback ke method lama
        return await this.getStudentAverageScore(studentId);
    }

    async getClassAnalytics() {
        const { classId } = this.currentSession;
        if (!classId) return null;
        
        if (window.sqlEngine && window.sqlEngine.isReady) {
            try {
                return window.sqlEngine.getFirst(`
                    SELECT 
                        COUNT(DISTINCT s.id) as total_students,
                        COUNT(DISTINCT g.assessmentType) as assessment_types,
                        AVG(g.score) as class_average,
                        MAX(g.score) as highest_score,
                        MIN(g.score) as lowest_score,
                        COUNT(CASE WHEN g.score >= 75 THEN 1 END) as students_passed,
                        ROUND(AVG(CASE WHEN g.score >= 75 THEN 1 ELSE 0 END) * 100, 1) as pass_percentage
                    FROM students s
                    LEFT JOIN grades g ON s.id = g.studentId
                    WHERE s.classId = ?
                `, [classId]);
            } catch (error) {
                console.error('Failed to get class analytics:', error);
            }
        }
        
        return null;
    }

    async getStudentDetailReport(studentId) {
        if (window.sqlEngine && window.sqlEngine.isReady) {
            try {
                // Get all grades with assessment type names
                const grades = window.sqlEngine.getAll(`
                    SELECT 
                        assessmentType,
                        score,
                        date,
                        scope,
                        notes,
                        CASE 
                            WHEN score >= 90 THEN 'A'
                            WHEN score >= 80 THEN 'B'
                            WHEN score >= 75 THEN 'C'
                            WHEN score >= 60 THEN 'D'
                            ELSE 'E'
                        END as predicate
                    FROM grades
                    WHERE studentId = ?
                    ORDER BY date DESC
                `, [studentId]);
                
                // Get attendance summary
                const attendance = window.sqlEngine.getFirst(`
                    SELECT 
                        COUNT(CASE WHEN status = 'hadir' THEN 1 END) as hadir,
                        COUNT(CASE WHEN status = 'sakit' THEN 1 END) as sakit,
                        COUNT(CASE WHEN status = 'izin' THEN 1 END) as izin,
                        COUNT(CASE WHEN status = 'alpha' THEN 1 END) as alpha,
                        COUNT(*) as total
                    FROM attendance
                    WHERE studentId = ?
                `, [studentId]);
                
                return { grades, attendance };
            } catch (error) {
                console.error('Failed to get student detail report:', error);
            }
        }
        
        return null;
    }

    async getSubjectAnalytics() {
        const { classId } = this.currentSession;
        if (!classId) return null;
        
        if (window.sqlEngine && window.sqlEngine.isReady) {
            try {
                return window.sqlEngine.getAll(`
                    SELECT 
                        assessmentType,
                        COUNT(*) as total_grades,
                        AVG(score) as average_score,
                        MAX(score) as highest,
                        MIN(score) as lowest,
                        ROUND(AVG(score), 1) as rounded_average
                    FROM grades
                    WHERE classId = ?
                    GROUP BY assessmentType
                    ORDER BY average_score DESC
                `, [classId]);
            } catch (error) {
                console.error('Failed to get subject analytics:', error);
            }
        }
        
        return [];
    }

    // Method untuk load grades table dengan SQL JOIN (lebih cepat)
    async loadGradesTableOptimized() {
        const { classId, assessmentType, date, scope } = this.currentSession;
        
        if (!classId) {
            const tbody = document.getElementById('gradesTableBody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 60px;">
                    <i class="fas fa-edit" style="font-size: 2rem;"></i><p>Pilih kelas terlebih dahulu</p></tr></tr>`;
            }
            return;
        }
        
        const students = await db.getStudents(classId);
        
        if (students.length === 0) {
            const tbody = document.getElementById('gradesTableBody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 60px;">
                    <i class="fas fa-users" style="font-size: 2rem;"></i><p>Belum ada siswa di kelas ini</p></td></tr>`;
            }
            return;
        }
        
        // Gunakan SQL JOIN jika memungkinkan
        let existingGrades = [];
        if (assessmentType && date && scope && window.sqlEngine && window.sqlEngine.isReady) {
            try {
                existingGrades = window.sqlEngine.getAll(`
                    SELECT * FROM grades 
                    WHERE classId = ? AND assessmentType = ? AND date = ? AND scope = ?
                `, [classId, assessmentType, date, scope]);
            } catch (error) {
                console.error('SQL query failed, falling back to IndexedDB:', error);
                existingGrades = await db.getGradesBySession(classId, assessmentType, date, scope);
            }
        } else if (assessmentType && date && scope) {
            existingGrades = await db.getGradesBySession(classId, assessmentType, date, scope);
        }
        
        // Rest of the method continues with the same logic as loadGradesTable()
        const gradesMap = new Map();
        existingGrades.forEach(g => gradesMap.set(g.studentId, g));
        
        for (const student of students) {
            const existing = gradesMap.get(student.id);
            if (existing) {
                if (!this.currentSession.gradesData[student.id]) {
                    this.currentSession.gradesData[student.id] = {
                        id: existing.id,
                        nilai: existing.score ? existing.score.toString() : '',
                        catatan: existing.notes || ''
                    };
                }
            } else if (!this.currentSession.gradesData[student.id]) {
                this.currentSession.gradesData[student.id] = { id: null, nilai: '', catatan: '' };
            }
        }
        
        // Apply search filter
        let filteredStudents = students;
        if (this.searchQuery) {
            filteredStudents = students.filter(s => s.name.toLowerCase().includes(this.searchQuery));
        }
        
        const totalStudents = filteredStudents.length;
        const totalPages = Math.ceil(totalStudents / this.itemsPerPage);
        
        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        else if (this.currentPage < 1) this.currentPage = 1;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalStudents);
        const pageStudents = filteredStudents.slice(startIndex, endIndex);
        
        this.updateStatisticsFromCurrentData();
        
        const tbody = document.getElementById('gradesTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = pageStudents.map((student, idx) => {
            const gradeData = this.currentSession.gradesData[student.id] || { nilai: '', catatan: '' };
            const nilai = gradeData.nilai;
            const catatan = gradeData.catatan || '';
            const predicate = this.getPredicate(parseFloat(nilai));
            const isEditable = assessmentType && date && scope;
            
            return `<tr data-student-id="${student.id}">
                <td>${startIndex + idx + 1}</td>
                <td><strong>${this.escapeHtml(student.name)}</strong></td>
                <td class="grade-value">
                    <div class="grade-input-wrapper">
                        <input type="number" class="grade-input form-control" data-student-id="${student.id}"
                            value="${nilai !== '' ? nilai : ''}" min="0" max="100" step="0.1"
                            ${isEditable ? '' : 'disabled'} style="width: 80px; display: inline-block;">
                        <span class="grade-badge grade-${predicate.grade}" style="margin-left: 8px;">${predicate.predikat}</span>
                    </div>
                </td>
                <td>${this.scopeNames[scope] || scope || '-'}</td>
                <td>${this.assessmentTypes[assessmentType]?.name || assessmentType || '-'}</td>
                <td><input type="text" class="form-control" data-student-id="${student.id}" data-catatan="true"
                    value="${this.escapeHtml(catatan)}" placeholder="Catatan..." ${isEditable ? '' : 'disabled'} style="min-width: 150px;"></td>
                <td class="text-center">${isEditable ? `
                    <button class="btn btn-sm btn-outline edit-grade-btn" data-student-id="${student.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger delete-grade-btn" data-student-id="${student.id}"><i class="fas fa-trash"></i></button>
                ` : '<span class="text-muted">-</span>'}</td>
            </tr>`;
        }).join('');
        
        // Re-attach event listeners
        document.querySelectorAll('.grade-input').forEach(input => {
            input.removeEventListener('input', this._getHandler('gradeInput'));
            input.addEventListener('input', (e) => this.handleGradeInput(e));
        });
        
        document.querySelectorAll('input[data-catatan="true"]').forEach(input => {
            input.removeEventListener('input', this._getHandler('catatanInput'));
            input.addEventListener('input', (e) => this.handleCatatanInput(e));
        });
        
        document.querySelectorAll('.edit-grade-btn').forEach(btn => {
            btn.onclick = () => this.showEditModal(parseInt(btn.dataset.studentId));
        });
        
        document.querySelectorAll('.delete-grade-btn').forEach(btn => {
            btn.onclick = () => this.deleteSingleGrade(parseInt(btn.dataset.studentId));
        });
        
        this.updateGradesPagination(totalStudents, totalPages);
        
        const saveBtn = document.getElementById('btnSimpanNilai');
        if (saveBtn) saveBtn.disabled = !(assessmentType && date && scope);
        
        const totalSiswaElem = document.getElementById('totalSiswaNilai');
        if (totalSiswaElem) totalSiswaElem.textContent = students.length;
    }
    
    updateStatistics(grades) {
        const validGrades = grades.filter(g => !isNaN(g) && g !== null && g !== '');
        const total = validGrades.length;
        const sum = validGrades.reduce((a, b) => a + b, 0);
        const avg = total > 0 ? (sum / total).toFixed(1) : 0;
        const highest = total > 0 ? Math.max(...validGrades) : 0;
        const lowest = total > 0 ? Math.min(...validGrades) : 0;
        
        this.updateElement('rataNilai', avg);
        this.updateElement('nilaiTertinggi', highest);
        this.updateElement('nilaiTerendah', lowest);
    }
    
    updateStatisticsFromCurrentData() {
        const allGrades = [];
        for (const [studentId, data] of Object.entries(this.currentSession.gradesData)) {
            const nilai = parseFloat(data?.nilai);
            if (!isNaN(nilai)) allGrades.push(nilai);
        }
        this.updateStatistics(allGrades);
    }
    
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }
    
    // ==================== LOAD GRADES TABLE ====================
    
    async loadGradesTable() {
        const { classId, assessmentType, date, scope } = this.currentSession;
        
        if (!classId) {
            const tbody = document.getElementById('gradesTableBody');
            if (tbody) {
                tbody.innerHTML = `<td><td colspan="7" class="text-center text-muted" style="padding: 60px;">
                    <i class="fas fa-edit" style="font-size: 2rem;"></i><p>Pilih kelas terlebih dahulu</p></td></tr>`;
            }
            return;
        }
        
        const students = await db.getStudents(classId);
        
        if (students.length === 0) {
            const tbody = document.getElementById('gradesTableBody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 60px;">
                    <i class="fas fa-users" style="font-size: 2rem;"></i><p>Belum ada siswa di kelas ini</p></td></tr>`;
            }
            return;
        }
        
        let filteredStudents = students;
        if (this.searchQuery) {
            filteredStudents = students.filter(s => s.name.toLowerCase().includes(this.searchQuery));
        }
        
        const totalStudents = filteredStudents.length;
        const totalPages = Math.ceil(totalStudents / this.itemsPerPage);
        
        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        else if (this.currentPage < 1) this.currentPage = 1;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalStudents);
        const pageStudents = filteredStudents.slice(startIndex, endIndex);
        
        let existingGrades = [];
        if (assessmentType && date && scope) {
            const allGrades = await db.getAllGrades();
            existingGrades = allGrades.filter(g => 
                g.classId === classId && g.assessmentType === assessmentType && 
                g.date === date && g.scope === scope);
        }
        
        const gradesMap = new Map();
        existingGrades.forEach(g => gradesMap.set(g.studentId, g));
        
        for (const student of students) {
            const existing = gradesMap.get(student.id);
            if (existing) {
                if (!this.currentSession.gradesData[student.id]) {
                    this.currentSession.gradesData[student.id] = {
                        id: existing.id,
                        nilai: existing.nilai.toString(),
                        catatan: existing.catatan || ''
                    };
                }
            } else if (!this.currentSession.gradesData[student.id]) {
                this.currentSession.gradesData[student.id] = { id: null, nilai: '', catatan: '' };
            }
        }
        
        this.updateStatisticsFromCurrentData();
        
        const tbody = document.getElementById('gradesTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = pageStudents.map((student, idx) => {
            const gradeData = this.currentSession.gradesData[student.id] || { nilai: '', catatan: '' };
            const nilai = gradeData.nilai;
            const catatan = gradeData.catatan || '';
            const predicate = this.getPredicate(parseFloat(nilai));
            const isEditable = assessmentType && date && scope;
            
            return `<tr data-student-id="${student.id}">
                <td>${startIndex + idx + 1}</td>
                <td><strong>${this.escapeHtml(student.name)}</strong></td>
                <td class="grade-value">
                    <div class="grade-input-wrapper">
                        <input type="number" class="grade-input form-control" data-student-id="${student.id}"
                            value="${nilai !== '' ? nilai : ''}" min="0" max="100" step="0.1"
                            ${isEditable ? '' : 'disabled'} style="width: 80px; display: inline-block;">
                        <span class="grade-badge grade-${predicate.grade}" style="margin-left: 8px;">${predicate.predikat}</span>
                    </div>
                </td>
                <td>${this.scopeNames[scope] || scope || '-'}</td>
                <td>${this.assessmentTypes[assessmentType]?.name || assessmentType || '-'}</td>
                <td><input type="text" class="form-control" data-student-id="${student.id}" data-catatan="true"
                    value="${this.escapeHtml(catatan)}" placeholder="Catatan..." ${isEditable ? '' : 'disabled'} style="min-width: 150px;"></td>
                <td class="text-center">${isEditable ? `
                    <button class="btn btn-sm btn-outline edit-grade-btn" data-student-id="${student.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger delete-grade-btn" data-student-id="${student.id}"><i class="fas fa-trash"></i></button>
                ` : '<span class="text-muted">-</span>'}</td>
            </tr>`;
        }).join('');
        
        document.querySelectorAll('.grade-input').forEach(input => {
            input.removeEventListener('input', this._getHandler('gradeInput'));
            input.addEventListener('input', (e) => this.handleGradeInput(e));
        });
        
        document.querySelectorAll('input[data-catatan="true"]').forEach(input => {
            input.removeEventListener('input', this._getHandler('catatanInput'));
            input.addEventListener('input', (e) => this.handleCatatanInput(e));
        });
        
        document.querySelectorAll('.edit-grade-btn').forEach(btn => {
            btn.onclick = () => this.showEditModal(parseInt(btn.dataset.studentId));
        });
        
        document.querySelectorAll('.delete-grade-btn').forEach(btn => {
            btn.onclick = () => this.deleteSingleGrade(parseInt(btn.dataset.studentId));
        });
        
        this.updateGradesPagination(totalStudents, totalPages);
        
        const saveBtn = document.getElementById('btnSimpanNilai');
        if (saveBtn) saveBtn.disabled = !(assessmentType && date && scope);
        
        const totalSiswaElem = document.getElementById('totalSiswaNilai');
        if (totalSiswaElem) totalSiswaElem.textContent = students.length;
    }

    updateGradesPagination(totalStudents, totalPages) {
        const paginationDiv = document.getElementById('gradesPaginationControls');
        if (!paginationDiv) return;
        
        if (totalPages <= 1) {
            paginationDiv.style.display = 'none';
            return;
        }
        
        paginationDiv.style.display = 'flex';
        
        const infoDiv = document.getElementById('gradesPaginationInfo');
        if (infoDiv) {
            const start = (this.currentPage - 1) * this.itemsPerPage + 1;
            const end = Math.min(start + this.itemsPerPage - 1, totalStudents);
            infoDiv.textContent = `Menampilkan ${start}-${end} dari ${totalStudents} siswa`;
        }
        
        const numbersDiv = document.getElementById('gradesPaginationNumbers');
        if (numbersDiv) {
            numbersDiv.innerHTML = '';
            
            const prevBtn = document.createElement('button');
            prevBtn.className = `page-btn ${this.currentPage <= 1 ? 'disabled' : ''}`;
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prevBtn.disabled = this.currentPage <= 1;
            prevBtn.onclick = () => this.goToPage(this.currentPage - 1);
            numbersDiv.appendChild(prevBtn);
            
            let startPage = Math.max(1, this.currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
            
            if (startPage > 1) {
                const firstBtn = document.createElement('button');
                firstBtn.className = 'page-btn';
                firstBtn.textContent = '1';
                firstBtn.onclick = () => this.goToPage(1);
                numbersDiv.appendChild(firstBtn);
                if (startPage > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.style.padding = '6px 12px';
                    numbersDiv.appendChild(ellipsis);
                }
            }
            
            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === this.currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.onclick = () => this.goToPage(i);
                numbersDiv.appendChild(pageBtn);
            }
            
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.style.padding = '6px 12px';
                    numbersDiv.appendChild(ellipsis);
                }
                const lastBtn = document.createElement('button');
                lastBtn.className = 'page-btn';
                lastBtn.textContent = totalPages;
                lastBtn.onclick = () => this.goToPage(totalPages);
                numbersDiv.appendChild(lastBtn);
            }
            
            const nextBtn = document.createElement('button');
            nextBtn.className = `page-btn ${this.currentPage >= totalPages ? 'disabled' : ''}`;
            nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            nextBtn.disabled = this.currentPage >= totalPages;
            nextBtn.onclick = () => this.goToPage(this.currentPage + 1);
            numbersDiv.appendChild(nextBtn);
        }
    }
    
    // ==================== SAVE ALL GRADES ====================
    
    async saveAllGrades() {
        const { classId, assessmentType, date, scope, gradesData } = this.currentSession;
        
        if (!classId) {
            this.ui?.showNotification('Pilih kelas terlebih dahulu', 'error');
            return;
        }
        
        if (!assessmentType || !date || !scope) {
            this.ui?.showNotification('Lengkapi semua data terlebih dahulu (Tipe, Tanggal, Lingkup)', 'error');
            return;
        }
        
        let saved = 0, errors = 0;
        
        for (const [studentId, data] of Object.entries(gradesData)) {
            if (!data || !data.nilai || data.nilai === '') continue;
            
            const nilaiNum = parseFloat(data.nilai);
            if (isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) continue;
            
            try {
                const allGrades = await db.getAllGrades();
                const existingGrade = allGrades.find(g => 
                    g.classId === classId && g.studentId === parseInt(studentId) &&
                    g.assessmentType === assessmentType && g.scope === scope && g.date === date);
                
                const gradeRecord = {
                    studentId: parseInt(studentId),
                    classId: classId,
                    assessmentType: assessmentType,
                    scope: scope,
                    date: date,
                    nilai: nilaiNum,
                    catatan: data.catatan || '',
                    updatedAt: new Date().toISOString()
                };
                
                if (existingGrade) {
                    gradeRecord.id = existingGrade.id;
                    gradeRecord.createdAt = existingGrade.createdAt;
                    await db.update('grades', gradeRecord);
                    data.id = existingGrade.id;
                } else {
                    gradeRecord.createdAt = new Date().toISOString();
                    const newId = await db.add('grades', gradeRecord);
                    data.id = newId;
                }
                saved++;
            } catch (error) {
                console.error('Failed to save grade:', error);
                errors++;
            }
        }
        
        if (saved > 0) {
            this.ui?.showNotification(`✅ ${saved} nilai berhasil disimpan${errors > 0 ? `, ${errors} gagal` : ''}`, errors > 0 ? 'warning' : 'success');
            await this.loadGradesTable();
            await this.loadGradesRecap(false);
            const saveBtn = document.getElementById('btnSimpanNilai');
            if (saveBtn) saveBtn.disabled = true;
        } else if (errors > 0) {
            this.ui?.showNotification(`❌ Gagal menyimpan ${errors} nilai`, 'error');
        } else {
            this.ui?.showNotification('Tidak ada nilai yang disimpan', 'info');
        }
    }
    
    // ==================== GENERATE RANDOM GRADES ====================
    
    generateRandomGrades() {
        const { classId, assessmentType, date, scope } = this.currentSession;
        
        if (!classId) {
            this.ui?.showNotification('Pilih kelas terlebih dahulu', 'error');
            return;
        }
        
        if (!assessmentType || !date || !scope) {
            this.ui?.showNotification('⚠️ Pilih Tipe Penilaian dan Lingkup Materi terlebih dahulu!', 'warning');
            return;
        }
        
        const studentIds = Object.keys(this.currentSession.gradesData);
        if (studentIds.length === 0) {
            this.ui?.showNotification('Tidak ada data siswa. Pastikan kelas sudah dipilih.', 'warning');
            return;
        }
        
        studentIds.forEach(studentId => {
            const bias = Math.random();
            let randomGrade;
            if (bias < 0.25) randomGrade = Math.floor(Math.random() * 16) + 85;
            else if (bias < 0.5) randomGrade = Math.floor(Math.random() * 10) + 75;
            else if (bias < 0.75) randomGrade = Math.floor(Math.random() * 10) + 65;
            else randomGrade = Math.floor(Math.random() * 5) + 60;
            
            if (!this.currentSession.gradesData[studentId]) {
                this.currentSession.gradesData[studentId] = { id: null, nilai: '', catatan: '' };
            }
            this.currentSession.gradesData[studentId].nilai = randomGrade.toString();
        });
        
        this.loadGradesTable();
        const saveBtn = document.getElementById('btnSimpanNilai');
        if (saveBtn) saveBtn.disabled = false;
        this.updateStatisticsFromCurrentData();
        this.ui?.showNotification(`🎲 Nilai random berhasil digenerate! Jangan lupa disimpan.`, 'success');
    }
    
    clearAllGrades() {
        const hasData = Object.values(this.currentSession.gradesData).some(d => d && d.nilai && d.nilai !== '');
        if (!hasData) {
            this.ui?.showNotification('Tidak ada nilai untuk dihapus', 'info');
            return;
        }
        
        if (confirm('Hapus semua nilai yang belum disimpan?')) {
            for (const studentId of Object.keys(this.currentSession.gradesData)) {
                const data = this.currentSession.gradesData[studentId];
                if (data && !data.id) {
                    data.nilai = '';
                    data.catatan = '';
                }
            }
            this.loadGradesTable();
            this.updateStatisticsFromCurrentData();
            this.ui?.showNotification('Nilai yang belum disimpan dihapus', 'success');
        }
    }
    
    // ==================== CRUD OPERATIONS ====================
    
    async deleteSingleGrade(studentId) {
        const gradeData = this.currentSession.gradesData[studentId];
        
        if (!gradeData || !gradeData.id) {
            if (gradeData) {
                gradeData.nilai = '';
                gradeData.catatan = '';
            }
            this.loadGradesTable();
            this.updateStatisticsFromCurrentData();
            this.ui?.showNotification('Nilai dihapus dari form', 'info');
            return;
        }
        
        if (confirm('Hapus nilai siswa ini?')) {
            try {
                await db.delete('grades', gradeData.id);
                gradeData.id = null;
                gradeData.nilai = '';
                gradeData.catatan = '';
                await this.loadGradesTable();
                await this.loadGradesRecap(false);
                this.updateStatisticsFromCurrentData();
                this.ui?.showNotification('Nilai berhasil dihapus', 'success');
            } catch (error) {
                this.ui?.showNotification('Gagal menghapus nilai', 'error');
            }
        }
    }
    
    async showEditModal(studentId) {
        const gradeData = this.currentSession.gradesData[studentId] || { nilai: '', catatan: '' };
        const students = await db.getStudents(this.currentSession.classId);
        const student = students.find(s => s.id === studentId);
        
        const modal = document.getElementById('editModal');
        const editStudentName = document.getElementById('editStudentName');
        const editNilai = document.getElementById('editNilai');
        const editCatatan = document.getElementById('editCatatan');
        const editStudentId = document.getElementById('editStudentId');
        
        if (modal && editStudentName && editNilai && editCatatan && editStudentId) {
            editStudentName.value = student ? student.name : '';
            editNilai.value = gradeData.nilai || '';
            editCatatan.value = gradeData.catatan || '';
            editStudentId.value = studentId;
            modal.style.display = 'flex';
        }
    }
    
    saveEditGrade() {
        const studentId = parseInt(document.getElementById('editStudentId')?.value);
        const nilai = document.getElementById('editNilai')?.value;
        const catatan = document.getElementById('editCatatan')?.value;
        
        if (!studentId) return;
        
        const nilaiNum = parseFloat(nilai);
        if (nilai && (isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100)) {
            this.ui?.showNotification('Nilai harus antara 0-100', 'error');
            return;
        }
        
        if (!this.currentSession.gradesData[studentId]) {
            this.currentSession.gradesData[studentId] = { id: null, nilai: '', catatan: '' };
        }
        
        this.currentSession.gradesData[studentId].nilai = nilai || '';
        this.currentSession.gradesData[studentId].catatan = catatan || '';
        
        this.closeEditModal();
        this.loadGradesTable();
        this.updateStatisticsFromCurrentData();
        
        const saveBtn = document.getElementById('btnSimpanNilai');
        if (saveBtn) saveBtn.disabled = false;
        this.ui?.showNotification('Nilai berhasil diperbarui', 'success');
    }
    
    closeEditModal() {
        const modal = document.getElementById('editModal');
        if (modal) modal.style.display = 'none';
    }
    
    // ==================== RESET GRADES ====================
    
    showResetConfirmation() {
        const modal = document.getElementById('resetGradesModal');
        if (modal) modal.style.display = 'flex';
    }
    
    closeResetModal() {
        const modal = document.getElementById('resetGradesModal');
        if (modal) modal.style.display = 'none';
    }
    
    async executeResetGrades() {
        const { classId } = this.currentSession;
        
        if (!classId) {
            this.ui?.showNotification('Pilih kelas terlebih dahulu', 'error');
            this.closeResetModal();
            return;
        }
        
        try {
            const allGrades = await db.getAllGrades();
            const classGrades = allGrades.filter(g => g.classId === classId);
            for (const grade of classGrades) await db.delete('grades', grade.id);
            
            for (const studentId of Object.keys(this.currentSession.gradesData)) {
                if (this.currentSession.gradesData[studentId]) {
                    this.currentSession.gradesData[studentId].id = null;
                    this.currentSession.gradesData[studentId].nilai = '';
                    this.currentSession.gradesData[studentId].catatan = '';
                }
            }
            
            await this.loadGradesTable();
            await this.loadGradesRecap(false);
            this.updateStatisticsFromCurrentData();
            this.ui?.showNotification('Semua nilai di kelas ini telah direset', 'success');
        } catch (error) {
            console.error('Reset grades error:', error);
            this.ui?.showNotification('Gagal mereset nilai', 'error');
        }
        this.closeResetModal();
    }
    
    // ==================== EXPORT ====================
    
    async exportGradesToExcel() {
        const { classId, className } = this.currentSession;
        
        if (!classId) {
            this.ui?.showNotification('Pilih kelas terlebih dahulu', 'error');
            return;
        }
        
        const students = await db.getStudents(classId);
        const allGrades = await db.getAllGrades();
        const classGrades = allGrades.filter(g => g.classId === classId);
        const assessmentTypes = [...new Set(classGrades.map(g => g.assessmentType).filter(Boolean))];
        
        const assessmentTypeObjects = assessmentTypes.map(t => ({ id: t, name: this.assessmentTypes[t]?.name || t }));
        
        if (window.ReportExporter) {
            await window.ReportExporter.exportGradesToExcel(classId, className || classId, classGrades, students, assessmentTypeObjects);
            this.ui?.showNotification('Export rekap nilai berhasil', 'success');
        } else {
            this.ui?.showNotification('Fitur export tidak tersedia', 'error');
        }
    }
    
    // ==================== RECAP ====================
    
    async loadGradesRecap(showInModal = false) {
        const { classId, className } = this.currentSession;
        
        if (!classId) {
            const container = document.getElementById('gradesRecapContainer');
            if (container) container.innerHTML = '<div class="text-center text-muted" style="padding: 40px;">Pilih kelas terlebih dahulu</div>';
            return;
        }
        
        const students = await db.getStudents(classId);
        const allGrades = await db.getAllGrades();
        const classGrades = allGrades.filter(g => g.classId === classId);
        
        const byAssessment = {};
        for (const grade of classGrades) {
            if (grade.nilai !== null && !isNaN(grade.nilai)) {
                if (!byAssessment[grade.assessmentType]) byAssessment[grade.assessmentType] = [];
                byAssessment[grade.assessmentType].push(grade.nilai);
            }
        }
        
        const recapHTML = this.generateRecapHTML(students, classGrades, byAssessment);
        
        if (showInModal) {
            const previewContainer = document.getElementById('previewRecapContainer');
            const previewClassName = document.getElementById('previewClassName');
            const modal = document.getElementById('previewRecapModal');
            if (previewContainer) previewContainer.innerHTML = recapHTML;
            if (previewClassName) previewClassName.textContent = className || classId;
            if (modal) modal.style.display = 'flex';
        } 
    }

    generateRecapHTML(students, classGrades, byAssessment) {
        if (students.length === 0) return '<div class="text-center text-muted" style="padding: 40px;">Belum ada siswa di kelas ini</div>';
        
        let html = `<div class="stats-grid">
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-chart-line"></i></div>
            <div class="stat-info"><h4>Total Nilai</h4><div class="value">${classGrades.filter(g => g.nilai).length}</div></div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-calculator"></i></div>
            <div class="stat-info"><h4>Rata-rata Kelas</h4><div class="value">${this.calculateClassAverage(classGrades)}</div></div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-users"></i></div>
            <div class="stat-info"><h4>Jumlah Siswa</h4><div class="value">${students.length}</div></div></div>
        </div>`;
        
        if (Object.keys(byAssessment).length > 0) {
            html += `<div class="assessment-summary mt-3"><h4>Ringkasan per Tipe Penilaian</h4><div class="stats-grid">`;
            for (const [type, grades] of Object.entries(byAssessment)) {
                const typeInfo = this.assessmentTypes[type] || { name: type, icon: 'fa-clipboard-list' };
                const avg = grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1) : 0;
                html += `<div class="stat-card"><div class="stat-icon" style="background: ${this.getAssessmentColor(type)}">
                    <i class="fas ${typeInfo.icon}"></i></div><div class="stat-info"><h4>${typeInfo.name}</h4>
                    <div class="value">${avg}</div><small>${grades.length} nilai</small></div></div>`;
            }
            html += `</div></div>`;
        }
        
        const assessmentTypes = Object.keys(byAssessment);
        html += `<div class="table-wrapper mt-3"><table class="data-table"><thead><tr>
            <th>No</th><th>Nama Siswa</th>
            ${assessmentTypes.map(type => `<th>${this.assessmentTypes[type]?.name || type}</th>`).join('')}
            <th>Rata-rata</th><th>Predikat</th>
        </tr></thead><tbody>`;
        
        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            const studentGrades = classGrades.filter(g => g.studentId === student.id);
            html += `<tr><td>${i + 1}</td><td><strong>${this.escapeHtml(student.name)}</strong></td>`;
            let total = 0, count = 0;
            for (const type of assessmentTypes) {
                const grade = studentGrades.find(g => g.assessmentType === type);
                const nilai = grade?.nilai !== undefined ? grade.nilai : '-';
                if (nilai !== '-' && !isNaN(nilai)) {
                    total += parseFloat(nilai);
                    count++;
                }
                html += `<td>${nilai !== '-' ? nilai : '-'}</td>`;
            }
            const avg = count > 0 ? (total / count).toFixed(1) : '-';
            const predicate = avg !== '-' ? this.getPredicate(parseFloat(avg)) : { predikat: '-', grade: 'empty' };
            html += `<td><strong>${avg}</strong></td><td><span class="grade-badge grade-${predicate.grade}">${predicate.predikat}</span></td></tr>`;
        }
        html += `</tbody></table></div>`;
        return html;
    }

    calculateClassAverage(grades) {
        const validGrades = grades.filter(g => g.nilai && !isNaN(g.nilai));
        if (validGrades.length === 0) return '0';
        const sum = validGrades.reduce((a, b) => a + b.nilai, 0);
        return (sum / validGrades.length).toFixed(1);
    }

    getAssessmentColor(type) {
        const colors = { 'tes_tertulis': '#4361ee', 'tes_lisan': '#06d6a0', 'proyek_akhir': '#f72585', 'portofolio_akhir': '#4895ef', 'demonstrasi_pkl': '#4cc9f0' };
        return colors[type] || '#64748b';
    }

    async exportRecapToExcel() {
        const { classId, className } = this.currentSession;
        
        if (!classId) {
            this.ui?.showNotification('Pilih kelas terlebih dahulu', 'error');
            return;
        }
        
        const students = await db.getStudents(classId);
        const allGrades = await db.getAllGrades();
        const classGrades = allGrades.filter(g => g.classId === classId);
        const assessmentTypes = [...new Set(classGrades.map(g => g.assessmentType).filter(Boolean))];
        
        const assessmentTypeObjects = assessmentTypes.map(t => ({ id: t, name: this.assessmentTypes[t]?.name || t }));
        
        if (window.ReportExporter) {
            await window.ReportExporter.exportGradesToExcel(classId, className || classId, classGrades, students, assessmentTypeObjects);
            this.ui?.showNotification('Export rekap nilai berhasil', 'success');
        } else {
            this.ui?.showNotification('Fitur export tidak tersedia', 'error');
        }
    }
    
    closePreviewModal() {
        const modal = document.getElementById('previewRecapModal');
        if (modal) modal.style.display = 'none';
    }
    
    // ==================== UTILITIES ====================
    
    _getHandler(key) {
        if (!this._handlers[key]) {
            this._handlers[key] = (...args) => {
                if (this[key]) return this[key](...args);
            };
        }
        return this._handlers[key];
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
// Add reset button handler
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirmResetBtn')?.addEventListener('click', () => {
        if (window.ui?.gradeManager) {
            window.ui.gradeManager.executeReset();
        }
    });
    document.getElementById('closeResetModal')?.addEventListener('click', () => {
        document.getElementById('resetGradesModal').style.display = 'none';
    });
    document.getElementById('cancelResetBtn')?.addEventListener('click', () => {
        document.getElementById('resetGradesModal').style.display = 'none';
    });
    document.getElementById('closeEditModal')?.addEventListener('click', () => {
        document.getElementById('editModal').style.display = 'none';
    });
    document.getElementById('cancelEdit')?.addEventListener('click', () => {
        document.getElementById('editModal').style.display = 'none';
    });
    document.getElementById('saveEdit')?.addEventListener('click', () => {
        if (window.ui?.gradeManager) {
            window.ui.gradeManager.saveEditGrade();
        }
    });
});