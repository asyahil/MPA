// ============================================
// database.js - INDEXEDDB STORAGE
// Mendukung semua atribut dari sistem yang ada
// ============================================

class IndexedDBManager {
    constructor() {
        this.DB_NAME = 'SistemAbsensiNilai';
        this.DB_VERSION = 3;
        this.db = null;
        this.isReady = false;
        
        // Store names
        this.STORES = {
            CLASSES: 'classes',
            STUDENTS: 'students',
            ATTENDANCE: 'attendance',
            GRADES: 'grades'
        };
    }

    // ==================== INITIALIZATION ====================
    
    async init() {
        console.log('IndexedDBManager initializing...');
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isReady = true;
                console.log('IndexedDB initialized successfully');
                
                // Handle database close/reopen events
                this.db.onclose = () => {
                    console.warn('Database connection closed');
                    this.isReady = false;
                };
                
                this.db.onversionchange = () => {
                    this.db.close();
                    console.warn('Database version change, reloading...');
                    window.location.reload();
                };
                
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                console.log(`Upgrading database from version ${oldVersion} to ${this.DB_VERSION}`);
                
                // Create classes store
                if (!db.objectStoreNames.contains(this.STORES.CLASSES)) {
                    const classStore = db.createObjectStore(this.STORES.CLASSES, { keyPath: 'id' });
                    classStore.createIndex('name', 'name', { unique: false });
                    classStore.createIndex('createdAt', 'createdAt', { unique: false });
                    console.log('Created classes store');
                }
                
                // Create students store
                if (!db.objectStoreNames.contains(this.STORES.STUDENTS)) {
                    const studentStore = db.createObjectStore(this.STORES.STUDENTS, { keyPath: 'id', autoIncrement: true });
                    studentStore.createIndex('classId', 'classId', { unique: false });
                    studentStore.createIndex('name', 'name', { unique: false });
                    studentStore.createIndex('createdAt', 'createdAt', { unique: false });
                    console.log('Created students store');
                }
                
                // Create attendance store
                if (!db.objectStoreNames.contains(this.STORES.ATTENDANCE)) {
                    const attendanceStore = db.createObjectStore(this.STORES.ATTENDANCE, { keyPath: 'id', autoIncrement: true });
                    attendanceStore.createIndex('classId', 'classId', { unique: false });
                    attendanceStore.createIndex('studentId', 'studentId', { unique: false });
                    attendanceStore.createIndex('date', 'date', { unique: false });
                    attendanceStore.createIndex('status', 'status', { unique: false });
                    attendanceStore.createIndex('classId_date', ['classId', 'date'], { unique: false });
                    attendanceStore.createIndex('studentId_date', ['studentId', 'date'], { unique: true });
                    console.log('Created attendance store');
                }
                
                // Create grades store
                if (!db.objectStoreNames.contains(this.STORES.GRADES)) {
                    const gradeStore = db.createObjectStore(this.STORES.GRADES, { keyPath: 'id', autoIncrement: true });
                    gradeStore.createIndex('classId', 'classId', { unique: false });
                    gradeStore.createIndex('studentId', 'studentId', { unique: false });
                    gradeStore.createIndex('assessmentType', 'assessmentType', { unique: false });
                    gradeStore.createIndex('date', 'date', { unique: false });
                    gradeStore.createIndex('scope', 'scope', { unique: false });
                    gradeStore.createIndex('classId_assessmentType', ['classId', 'assessmentType'], { unique: false });
                    gradeStore.createIndex('classId_date', ['classId', 'date'], { unique: false });
                    gradeStore.createIndex('studentId_assessmentType', ['studentId', 'assessmentType'], { unique: false });
                    console.log('Created grades store');
                }
                
                console.log('Database upgrade complete');
            };
        });
    }

    // ==================== GENERIC CRUD OPERATIONS ====================
    
    async getAll(storeName) {
        if (!this.isReady) throw new Error('Database not ready');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
    
    async get(storeName, id) {
        if (!this.isReady) throw new Error('Database not ready');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async add(storeName, data) {
        if (!this.isReady) throw new Error('Database not ready');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async put(storeName, data) {
        if (!this.isReady) throw new Error('Database not ready');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async update(storeName, data) {
        return this.put(storeName, data);
    }
    
    async delete(storeName, id) {
        if (!this.isReady) throw new Error('Database not ready');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    async clear(storeName) {
        if (!this.isReady) throw new Error('Database not ready');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    async getByIndex(storeName, indexName, value) {
        if (!this.isReady) throw new Error('Database not ready');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
    
    async getByCompoundIndex(storeName, indexName, values) {
        if (!this.isReady) throw new Error('Database not ready');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(values);
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== CLASS OPERATIONS ====================
    
    async getClasses() {
        return this.getAll(this.STORES.CLASSES);
    }
    
    async getClass(classId) {
        return this.get(this.STORES.CLASSES, classId);
    }
    
    async addClass(classData) {
        // Ensure required fields
        const newClass = {
            id: classData.id,
            name: classData.name,
            createdAt: classData.createdAt || new Date().toISOString()
        };
        return this.add(this.STORES.CLASSES, newClass);
    }
    
    async updateClass(classData) {
        const existing = await this.getClass(classData.id);
        if (existing) {
            const updated = {
                ...existing,
                name: classData.name || existing.name
            };
            return this.put(this.STORES.CLASSES, updated);
        }
        throw new Error('Class not found');
    }
    
    async deleteClass(classId) {
        // First delete all students in this class
        const students = await this.getStudentsByClass(classId);
        for (const student of students) {
            await this.deleteStudent(student.id);
        }
        return this.delete(this.STORES.CLASSES, classId);
    }
    
    // ==================== STUDENT OPERATIONS ====================
    
    async getStudents(classId = null) {
        if (classId) {
            return this.getStudentsByClass(classId);
        }
        return this.getAll(this.STORES.STUDENTS);
    }
    
    async getStudent(studentId) {
        return this.get(this.STORES.STUDENTS, studentId);
    }
    
    async getStudentsByClass(classId) {
        return this.getByIndex(this.STORES.STUDENTS, 'classId', classId);
    }
    
    async addStudent(studentData) {
        const newStudent = {
            name: studentData.name,
            classId: studentData.classId,
            createdAt: studentData.createdAt || new Date().toISOString()
        };
        return this.add(this.STORES.STUDENTS, newStudent);
    }
    
    async updateStudent(studentData) {
        const existing = await this.getStudent(studentData.id);
        if (existing) {
            const updated = {
                ...existing,
                name: studentData.name || existing.name,
                classId: studentData.classId || existing.classId
            };
            return this.put(this.STORES.STUDENTS, updated);
        }
        throw new Error('Student not found');
    }
    
    async deleteStudent(studentId) {
        // Delete all attendance records for this student
        const attendanceRecords = await this.getAttendanceByStudent(studentId);
        for (const record of attendanceRecords) {
            await this.delete(this.STORES.ATTENDANCE, record.id);
        }
        
        // Delete all grades for this student
        const grades = await this.getGradesByStudent(studentId);
        for (const grade of grades) {
            await this.delete(this.STORES.GRADES, grade.id);
        }
        
        return this.delete(this.STORES.STUDENTS, studentId);
    }
    
    // ==================== ATTENDANCE OPERATIONS ====================
    
    async getAllAttendance() {
        return this.getAll(this.STORES.ATTENDANCE);
    }
    
    async getAttendance(classId, date) {
        return this.getByCompoundIndex(this.STORES.ATTENDANCE, 'classId_date', [classId, date]);
    }
    
    async getAttendanceByStudent(studentId) {
        return this.getByIndex(this.STORES.ATTENDANCE, 'studentId', studentId);
    }
    
    async getAttendanceByDateRange(classId, startDate, endDate) {
        if (!this.isReady) throw new Error('Database not ready');
        
        const allAttendance = await this.getAttendanceByClass(classId);
        return allAttendance.filter(record => {
            return record.date >= startDate && record.date <= endDate;
        });
    }
    
    async getAttendanceByClass(classId) {
        return this.getByIndex(this.STORES.ATTENDANCE, 'classId', classId);
    }
    
    async addAttendance(attendanceData) {
        // Check for existing record on same student and date
        const existing = await this.getByCompoundIndex(
            this.STORES.ATTENDANCE, 
            'studentId_date', 
            [attendanceData.studentId, attendanceData.date]
        );
        
        if (existing && existing.length > 0) {
            // Update existing record
            const existingRecord = existing[0];
            const updated = {
                ...existingRecord,
                status: attendanceData.status,
                updatedAt: new Date().toISOString()
            };
            return this.put(this.STORES.ATTENDANCE, updated);
        }
        
        // Add new record
        const newRecord = {
            classId: attendanceData.classId,
            studentId: attendanceData.studentId,
            date: attendanceData.date,
            status: attendanceData.status,
            createdAt: attendanceData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        return this.add(this.STORES.ATTENDANCE, newRecord);
    }
    
    async updateAttendance(attendanceId, status) {
        const existing = await this.get(this.STORES.ATTENDANCE, attendanceId);
        if (existing) {
            const updated = {
                ...existing,
                status: status,
                updatedAt: new Date().toISOString()
            };
            return this.put(this.STORES.ATTENDANCE, updated);
        }
        throw new Error('Attendance record not found');
    }
    
    async deleteAttendance(attendanceId) {
        return this.delete(this.STORES.ATTENDANCE, attendanceId);
    }
    
    // ==================== GRADES OPERATIONS ====================
    
    async getAllGrades() {
        return this.getAll(this.STORES.GRADES);
    }
    
    async getGrade(gradeId) {
        return this.get(this.STORES.GRADES, gradeId);
    }
    
    async getGradesByClass(classId) {
        return this.getByIndex(this.STORES.GRADES, 'classId', classId);
    }
    
    async getGradesByStudent(studentId) {
        return this.getByIndex(this.STORES.GRADES, 'studentId', studentId);
    }
    
    async getGradesByAssessmentType(classId, assessmentType) {
        return this.getByCompoundIndex(this.STORES.GRADES, 'classId_assessmentType', [classId, assessmentType]);
    }
    
    async getGradesBySession(classId, assessmentType, date, scope) {
        if (!this.isReady) throw new Error('Database not ready');
        
        const allGrades = await this.getGradesByClass(classId);
        return allGrades.filter(grade => {
            return grade.assessmentType === assessmentType && 
                   grade.date === date && 
                   grade.scope === scope;
        });
    }
    
    async addGrade(gradeData) {
        const newGrade = {
            classId: gradeData.classId,
            studentId: gradeData.studentId,
            assessmentType: gradeData.assessmentType,
            score: gradeData.nilai !== undefined ? gradeData.nilai : gradeData.score,
            date: gradeData.date,
            scope: gradeData.scope || 'daily',
            notes: gradeData.catatan || gradeData.notes || '',
            createdAt: gradeData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        return this.add(this.STORES.GRADES, newGrade);
    }
    
    async updateGrade(gradeId, gradeData) {
        const existing = await this.getGrade(gradeId);
        if (existing) {
            const updated = {
                ...existing,
                score: gradeData.nilai !== undefined ? gradeData.nilai : gradeData.score || existing.score,
                notes: gradeData.catatan || gradeData.notes || existing.notes,
                updatedAt: new Date().toISOString()
            };
            return this.put(this.STORES.GRADES, updated);
        }
        throw new Error('Grade not found');
    }
    
    async deleteGrade(gradeId) {
        return this.delete(this.STORES.GRADES, gradeId);
    }
    
    // ==================== BULK OPERATIONS ====================
    
    async clearAllData() {
        await this.clear(this.STORES.ATTENDANCE);
        await this.clear(this.STORES.GRADES);
        await this.clear(this.STORES.STUDENTS);
        await this.clear(this.STORES.CLASSES);
        console.log('All data cleared');
    }
    
    async resetAll() {
        await this.clearAllData();
        await this.initializeDefaultData();
    }
    
    // ==================== DEFAULT DATA ====================
    
    async initializeDefaultData() {
        const existingClasses = await this.getClasses();
        if (existingClasses.length > 0) {
            console.log('Data already exists, skipping default initialization');
            return;
        }
        
        console.log('Initializing default data...');
        
        const defaultClasses = [
            { id: 'vii-1', name: 'Kelas VII - 1', createdAt: new Date().toISOString() },
            { id: 'vii-2', name: 'Kelas VII - 2', createdAt: new Date().toISOString() },
            { id: 'viii-1', name: 'Kelas VIII - 1', createdAt: new Date().toISOString() },
            { id: 'viii-2', name: 'Kelas VIII - 2', createdAt: new Date().toISOString() },
            { id: 'ix-1', name: 'Kelas IX - 1', createdAt: new Date().toISOString() },
            { id: 'ix-2', name: 'Kelas IX - 2', createdAt: new Date().toISOString() }
        ];
        
        const defaultStudents = {
            'vii-1': ['Ahmad Fauzi', 'Budi Santoso', 'Citra Dewi', 'Dian Pratama', 'Eka Wahyuni'],
            'vii-2': ['Fajar Nugroho', 'Gita Sari', 'Hendra Wijaya', 'Indah Lestari'],
            'viii-1': ['Joko Susilo', 'Kartika Sari', 'Lukman Hakim', 'Mega Puspita'],
            'viii-2': ['Nurul Hidayat', 'Oky Pratama', 'Putri Amelia', 'Rizki Ramadhan'],
            'ix-1': ['Siti Aisyah', 'Teguh Prakoso', 'Umi Kalsum', 'Vino Bastian'],
            'ix-2': ['Winda Sari', 'Xavier Putra', 'Yuni Shara', 'Zaki Zainal']
        };
        
        // Add classes
        for (const cls of defaultClasses) {
            await this.addClass(cls);
            console.log(`Added class: ${cls.id}`);
        }
        
        // Add students
        for (const [classId, students] of Object.entries(defaultStudents)) {
            for (const studentName of students) {
                await this.addStudent({
                    name: studentName,
                    classId: classId,
                    createdAt: new Date().toISOString()
                });
                console.log(`Added student: ${studentName} to ${classId}`);
            }
        }
        
        // Add sample attendance for today
        const today = new Date().toISOString().split('T')[0];
        const allStudents = await this.getStudents();
        
        for (const student of allStudents) {
            await this.addAttendance({
                classId: student.classId,
                studentId: student.id,
                date: today,
                status: 'hadir',
                createdAt: new Date().toISOString()
            });
        }
        
        console.log('Default data initialization complete');
    }
    
    // ==================== STATISTICS & UTILITIES ====================
    
    async getStats() {
        const classes = await this.getClasses();
        const students = await this.getStudents();
        const attendance = await this.getAllAttendance();
        const grades = await this.getAllGrades();
        
        return {
            classes: classes.length,
            students: students.length,
            attendance: attendance.length,
            grades: grades.length,
            databaseSize: await this.getDatabaseSize()
        };
    }
    
    async getDatabaseSize() {
        if (!this.isReady) return 0;
        
        return new Promise((resolve) => {
            const estimate = navigator.storage?.estimate?.();
            if (estimate) {
                estimate.then(est => {
                    resolve(est.usage || 0);
                }).catch(() => resolve(0));
            } else {
                resolve(0);
            }
        });
    }
    
    async exportData() {
        return {
            classes: await this.getClasses(),
            students: await this.getStudents(),
            attendance: await this.getAllAttendance(),
            grades: await this.getAllGrades(),
            exportDate: new Date().toISOString(),
            version: this.DB_VERSION
        };
    }
    
    async importData(data) {
        if (!data.classes || !data.students) {
            throw new Error('Invalid data format');
        }
        
        await this.clearAllData();
        
        for (const cls of data.classes) {
            await this.addClass(cls);
        }
        
        for (const student of data.students) {
            await this.addStudent(student);
        }
        
        if (data.attendance) {
            for (const att of data.attendance) {
                await this.addAttendance(att);
            }
        }
        
        if (data.grades) {
            for (const grade of data.grades) {
                await this.addGrade(grade);
            }
        }
        
        console.log('Data import complete');
    }
    
    // ==================== SYNC HELPERS ====================
    
    async syncToPersistentStorage() {
        // For IndexedDB, data is already persistent
        // This method exists for compatibility with SQLite version
        console.log('Data already persisted in IndexedDB');
        return true;
    }
}

// Create and expose global instance
window.db = new IndexedDBManager();

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.db.init();
        console.log('Database ready');
        
        // Initialize default data if needed
        const classes = await window.db.getClasses();
        if (classes.length === 0) {
            await window.db.initializeDefaultData();
        }
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
});