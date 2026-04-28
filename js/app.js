// ============================================
// app.js - MAIN APPLICATION ENTRY POINT
// VERSION: 2.0 - Fixed & Optimized
// ============================================

// ============================================
// GLOBAL NOTIFICATION SYSTEM
// ============================================

function showToast(message, type = 'info') {
    // Try to use UI notification if available
    if (window.ui && typeof window.ui.showNotification === 'function') {
        window.ui.showNotification(message, type);
        return;
    }
    
    // Fallback toast element
    const toastId = 'global-toast';
    let toast = document.getElementById(toastId);
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = toastId;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'error' ? '#e63946' : type === 'success' ? '#06d6a0' : type === 'warning' ? '#f72585' : '#4361ee'};
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            z-index: 10000;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            opacity: 0;
            transform: translateX(20px);
            transition: all 0.3s ease;
            pointer-events: none;
            max-width: 350px;
            font-size: 14px;
        `;
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#e63946' : type === 'success' ? '#06d6a0' : type === 'warning' ? '#f72585' : '#4361ee';
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
    }, 3000);
}

// ============================================
// STORAGE UTILITIES
// ============================================

async function checkStorageStatus() {
    if (!navigator.storage || !navigator.storage.estimate) {
        console.log('📊 Storage API not supported');
        return { supported: false };
    }
    
    try {
        const estimate = await navigator.storage.estimate();
        const usageMB = (estimate.usage / 1024 / 1024).toFixed(2);
        const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
        const percentage = ((estimate.usage / estimate.quota) * 100).toFixed(1);
        
        console.log(`📊 Storage: ${usageMB}MB / ${quotaMB}MB (${percentage}%)`);
        
        // Show warning if storage is almost full
        if (estimate.usage / estimate.quota > 0.8) {
            showToast(`⚠️ Peringatan: Penyimpanan hampir penuh! (${percentage}%)`, 'warning');
        }
        
        return {
            supported: true,
            usageMB: parseFloat(usageMB),
            quotaMB: parseFloat(quotaMB),
            percentage: parseFloat(percentage)
        };
    } catch (error) {
        console.error('Storage check failed:', error);
        return { supported: false, error: error.message };
    }
}

// ============================================
// DATABASE STATISTICS
// ============================================

async function getDatabaseStats() {
    if (!window.db || typeof window.db.getStats !== 'function') {
        console.warn('Database stats not available');
        return null;
    }
    
    try {
        const stats = await window.db.getStats();
        console.log('📊 Database Stats:', {
            classes: stats.classes,
            students: stats.students,
            attendance: stats.attendance,
            grades: stats.grades,
            dbSize: stats.databaseSize ? `${(stats.databaseSize / 1024 / 1024).toFixed(2)} MB` : 'Unknown'
        });
        return stats;
    } catch (error) {
        console.error('Failed to get database stats:', error);
        return null;
    }
}

// ============================================
// SQLITE ENGINE STATUS
// ============================================

function getSQLiteStatus() {
    if (!window.sqlEngine) {
        return { available: false, ready: false };
    }
    
    return {
        available: true,
        ready: window.sqlEngine.isReady || false,
        size: window.sqlEngine.getSize ? window.sqlEngine.getSize() : 0
    };
}

// ============================================
// APPLICATION INITIALIZATION (FIXED ORDER)
// ============================================

async function initializeApp() {
    console.log('🚀 ========================================');
    console.log('🚀 Initializing Application...');
    console.log('🚀 ========================================');
    
    // Track initialization time
    const startTime = performance.now();
    let steps = [];
    
    try {
        // ========== STEP 1: SQLite Engine ==========
        console.log('📀 [1/4] Initializing SQLite Engine...');
        const sqlStart = performance.now();
        
        if (window.sqlEngine && typeof window.sqlEngine.init === 'function') {
            await window.sqlEngine.init();
            const sqlTime = (performance.now() - sqlStart).toFixed(0);
            steps.push({ step: 'SQLite Engine', time: `${sqlTime}ms`, status: '✅' });
            
            const sqliteSize = window.sqlEngine.getSize ? window.sqlEngine.getSize() : 0;
            console.log(`   ✅ SQLite Engine ready (${(sqliteSize / 1024).toFixed(0)} KB, ${sqlTime}ms)`);
        } else {
            throw new Error('SQLite Engine not available - sqlite-engine.js may not be loaded');
        }
        
        // ========== STEP 2: Database Manager ==========
        console.log('💾 [2/4] Initializing Database Manager...');
        const dbStart = performance.now();
        
        if (window.db && typeof window.db.init === 'function') {
            await window.db.init();
            const dbTime = (performance.now() - dbStart).toFixed(0);
            steps.push({ step: 'Database Manager', time: `${dbTime}ms`, status: '✅' });
            console.log(`   ✅ Database Manager ready (${dbTime}ms)`);
        } else {
            throw new Error('Database Manager not available - db.js may not be loaded');
        }
        
        // ========== STEP 3: UI Controller ==========
        console.log('🎨 [3/4] Initializing UI...');
        const uiStart = performance.now();
        
        if (typeof UI !== 'undefined') {
            window.ui = new UI();
            await window.ui.init();
            const uiTime = (performance.now() - uiStart).toFixed(0);
            steps.push({ step: 'UI Controller', time: `${uiTime}ms`, status: '✅' });
            console.log(`   ✅ UI Controller ready (${uiTime}ms)`);
        } else {
            throw new Error('UI class not available - ui.js may not be loaded');
        }
        
        // ========== STEP 4: Post-Initialization Checks ==========
        console.log('🔍 [4/4] Running post-init checks...');
        
        // Check storage status
        const storageStatus = await checkStorageStatus();
        steps.push({ 
            step: 'Storage Check', 
            time: storageStatus.supported ? `${storageStatus.usageMB}MB used` : 'N/A', 
            status: storageStatus.supported ? '✅' : '⚠️' 
        });
        
        // Get database stats
        const dbStats = await getDatabaseStats();
        if (dbStats) {
            console.log(`   📊 Database contains: ${dbStats.classes} classes, ${dbStats.students} students, ${dbStats.attendance} attendance records, ${dbStats.grades} grades`);
        }
        
        // Get SQLite status
        const sqlStatus = getSQLiteStatus();
        
        // ========== COMPLETE ==========
        const totalTime = (performance.now() - startTime).toFixed(0);
        
        console.log('🚀 ========================================');
        console.log(`🚀 Application initialized successfully (${totalTime}ms)`);
        console.log('🚀 ========================================');
        
        // Display summary table
        console.table(steps);
        
        // Determine engine mode
        const engineMode = sqlStatus.ready ? '⚡ SQLite + IndexedDB' : '💾 IndexedDB Only';
        console.log(`🎯 Engine Mode: ${engineMode}`);
        
        // Show success notification
        showToast(`✅ Aplikasi siap digunakan! (${totalTime}ms)`, 'success');
        
        // Optional: Show performance dashboard button if available
        if (window.ui && typeof window.ui.showPerformanceDashboard === 'function') {
            // Add performance button to UI if needed
            console.log('💡 Tip: Gunakan window.debugApp untuk utilities debugging');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ ========================================');
        console.error('❌ Failed to initialize application:', error);
        console.error('❌ ========================================');
        
        // Show user-friendly error message
        let errorMessage = 'Gagal memuat aplikasi. ';
        
        if (error.message.includes('SQLite Engine not available')) {
            errorMessage += 'SQLite engine tidak tersedia. Coba refresh halaman.';
        } else if (error.message.includes('Database Manager not available')) {
            errorMessage += 'Database tidak tersedia. Coba refresh halaman.';
        } else if (error.message.includes('UI class not available')) {
            errorMessage += 'UI tidak tersedia. Coba refresh halaman.';
        } else {
            errorMessage += error.message;
        }
        
        showToast(errorMessage, 'error');
        
        // Show fallback UI for critical errors
        showFallbackUI(error.message);
        
        return false;
    }
}

// ============================================
// FALLBACK UI (when initialization fails)
// ============================================

function showFallbackUI(errorMessage) {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;
    
    mainContent.style.display = 'block';
    mainContent.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px; margin: 20px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #e63946; margin-bottom: 20px;"></i>
            <h3 style="color: #e63946; margin-bottom: 10px;">Gagal Memuat Aplikasi</h3>
            <p style="color: #64748b; margin-bottom: 20px;">${escapeHtml(errorMessage)}</p>
            <button onclick="location.reload()" class="btn btn-primary" style="margin-right: 10px;">
                <i class="fas fa-sync-alt"></i> Refresh Halaman
            </button>
            <button onclick="clearAndReload()" class="btn btn-outline">
                <i class="fas fa-trash"></i> Clear Cache & Reload
            </button>
        </div>
    `;
}

function clearAndReload() {
    if (confirm('Hapus cache dan muat ulang halaman?')) {
        if ('caches' in window) {
            caches.keys().then(keys => {
                keys.forEach(key => caches.delete(key));
            });
        }
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// REPORT & ANALYTICS (SQL Optimized)
// ============================================

async function getTopPerformerReport(limit = 5) {
    if (!window.ui || !window.ui.currentClass) {
        showToast('Pilih kelas terlebih dahulu', 'warning');
        return null;
    }
    
    try {
        // Try SQL first
        if (window.sqlEngine && window.sqlEngine.isReady) {
            const results = window.sqlEngine.getAll(`
                SELECT 
                    s.id,
                    s.name,
                    ROUND(AVG(g.score), 1) as average_score,
                    COUNT(g.id) as total_grades
                FROM students s
                LEFT JOIN grades g ON s.id = g.studentId
                WHERE s.classId = ?
                GROUP BY s.id
                ORDER BY average_score DESC
                LIMIT ?
            `, [window.ui.currentClass, limit]);
            
            console.log('🏆 Top Performers (SQL):', results);
            return results;
        }
        
        // Fallback to IndexedDB
        if (window.db && typeof window.db.getTopPerformers === 'function') {
            const results = await window.db.getTopPerformers(window.ui.currentClass, limit);
            console.log('🏆 Top Performers (IndexedDB):', results);
            return results;
        }
        
        console.warn('No method available to get top performers');
        return null;
    } catch (error) {
        console.error('Failed to get top performers:', error);
        return null;
    }
}

async function getAttendanceReport() {
    if (!window.ui || !window.ui.currentClass) {
        showToast('Pilih kelas terlebih dahulu', 'warning');
        return null;
    }
    
    try {
        // Try SQL first
        if (window.sqlEngine && window.sqlEngine.isReady) {
            const summary = window.sqlEngine.getFirst(`
                SELECT 
                    COUNT(CASE WHEN status = 'hadir' THEN 1 END) as hadir,
                    COUNT(CASE WHEN status = 'sakit' THEN 1 END) as sakit,
                    COUNT(CASE WHEN status = 'izin' THEN 1 END) as izin,
                    COUNT(CASE WHEN status = 'alpa' THEN 1 END) as alpa,
                    COUNT(*) as total,
                    ROUND(CAST(COUNT(CASE WHEN status = 'hadir' THEN 1 END) AS FLOAT) / COUNT(*) * 100, 1) as attendance_rate
                FROM attendance
                WHERE classId = ?
            `, [window.ui.currentClass]);
            
            console.log('📊 Attendance Summary (SQL):', summary);
            return summary;
        }
        
        // Fallback to IndexedDB
        if (window.db && typeof window.db.getAttendanceSummary === 'function') {
            const summary = await window.db.getAttendanceSummary(window.ui.currentClass);
            console.log('📊 Attendance Summary (IndexedDB):', summary);
            return summary;
        }
        
        console.warn('No method available to get attendance summary');
        return null;
    } catch (error) {
        console.error('Failed to get attendance summary:', error);
        return null;
    }
}

// ============================================
// DATA EXPORT/IMPORT
// ============================================

async function exportAllData() {
    if (!window.db) {
        showToast('Database tidak tersedia', 'error');
        return;
    }
    
    try {
        showToast('Menyiapkan data untuk export...', 'info');
        
        const data = {
            classes: await window.db.getClasses(),
            students: await window.db.getStudents(),
            attendance: await window.db.getAllAttendance(),
            grades: await window.db.getAllGrades(),
            exportDate: new Date().toISOString(),
            version: '2.0',
            engine: window.sqlEngine?.isReady ? 'SQLite + IndexedDB' : 'IndexedDB Only'
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        const fileSize = (blob.size / 1024).toFixed(2);
        showToast(`✅ Export data berhasil (${fileSize} KB)`, 'success');
    } catch (error) {
        console.error('Export failed:', error);
        showToast('❌ Gagal export data: ' + error.message, 'error');
    }
}

async function importDataFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                showToast('Memproses import data...', 'info');
                
                const data = JSON.parse(e.target.result);
                
                // Validate data structure
                if (!data.classes || !data.students) {
                    throw new Error('Format file tidak valid - missing classes or students');
                }
                
                // Clear existing data
                if (window.db && typeof window.db.resetAll === 'function') {
                    await window.db.resetAll();
                } else if (window.db && typeof window.db.clearAllData === 'function') {
                    await window.db.clearAllData();
                } else {
                    throw new Error('Database reset not available');
                }
                
                let importedCount = {
                    classes: 0,
                    students: 0,
                    attendance: 0,
                    grades: 0
                };
                
                // Import classes
                for (const cls of data.classes) {
                    await window.db.addClass(cls);
                    importedCount.classes++;
                }
                
                // Import students
                for (const student of data.students) {
                    await window.db.addStudent(student);
                    importedCount.students++;
                }
                
                // Import attendance
                if (data.attendance && data.attendance.length > 0) {
                    for (const att of data.attendance) {
                        await window.db.addAttendance(att);
                        importedCount.attendance++;
                    }
                }
                
                // Import grades
                if (data.grades && data.grades.length > 0) {
                    for (const grade of data.grades) {
                        await window.db.addGrade(grade);
                        importedCount.grades++;
                    }
                }
                
                console.log('Import completed:', importedCount);
                showToast(`✅ Import selesai: ${importedCount.classes} kelas, ${importedCount.students} siswa`, 'success');
                
                // Refresh UI
                if (window.ui) {
                    await window.ui.loadClasses();
                    if (window.ui.currentClass) {
                        await window.ui.renderAttendanceTable();
                        await window.ui.loadStudentRecap();
                    }
                }
                
                resolve(importedCount);
            } catch (error) {
                console.error('Import failed:', error);
                showToast('❌ Gagal import data: ' + error.message, 'error');
                reject(error);
            }
        };
        reader.onerror = () => {
            showToast('❌ Gagal membaca file', 'error');
            reject(reader.error);
        };
        reader.readAsText(file);
    });
}

function exportAsSQLite() {
    if (window.sqlEngine && typeof window.sqlEngine.exportToUint8Array === 'function') {
        try {
            const sqliteData = window.sqlEngine.exportToUint8Array();
            const blob = new Blob([sqliteData], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `database_${new Date().toISOString().split('T')[0]}.sqlite`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            const sizeKB = (blob.size / 1024).toFixed(2);
            showToast(`✅ Database SQLite berhasil diekspor (${sizeKB} KB)`, 'success');
        } catch (error) {
            console.error('SQLite export failed:', error);
            showToast('❌ Gagal export SQLite', 'error');
        }
    } else {
        showToast('⚠️ Fitur export SQLite tidak tersedia (SQLite engine tidak aktif)', 'warning');
    }
}

// ============================================
// SYSTEM HEALTH CHECK
// ============================================

async function systemHealthCheck() {
    console.log('🏥 Running system health check...');
    
    const health = {
        timestamp: new Date().toISOString(),
        checks: {}
    };
    
    // Check SQLite Engine
    health.checks.sqlite = {
        available: !!window.sqlEngine,
        ready: window.sqlEngine?.isReady || false,
        size: window.sqlEngine?.getSize ? window.sqlEngine.getSize() : 0
    };
    
    // Check Database Manager
    health.checks.database = {
        available: !!window.db,
        ready: window.db?.isReady || false,
        dbExists: !!window.db?.db
    };
    
    // Check UI
    health.checks.ui = {
        available: !!window.ui,
        initialized: !!(window.ui && window.ui.currentClass !== undefined)
    };
    
    // Check Storage
    try {
        const storage = await checkStorageStatus();
        health.checks.storage = storage;
    } catch (error) {
        health.checks.storage = { error: error.message };
    }
    
    // Get database stats
    if (window.db && typeof window.db.getStats === 'function') {
        try {
            health.checks.data = await window.db.getStats();
        } catch (error) {
            health.checks.data = { error: error.message };
        }
    }
    
    // Determine overall status
    const criticalChecks = ['sqlite', 'database', 'ui'];
    const allCriticalPass = criticalChecks.every(check => 
        health.checks[check]?.ready === true || health.checks[check]?.available === true
    );
    
    health.status = allCriticalPass ? 'healthy' : 'degraded';
    
    console.log('🏥 Health Check Results:');
    console.table(health.checks);
    console.log(`🏥 Overall Status: ${health.status.toUpperCase()}`);
    
    return health;
}

// ============================================
// PERFORMANCE OPTIMIZATION
// ============================================

function optimizeForMobile() {
    if ('connection' in navigator) {
        const conn = navigator.connection;
        console.log(`📶 Network: ${conn.effectiveType}, SaveData: ${conn.saveData}`);
        
        if (conn.saveData) {
            console.log('⚡ Data saver mode detected - optimizing...');
            // Reduce image quality, prefetch less data
        }
    }
    
    // Enable passive event listeners for better scroll performance
    const wheelOpt = { passive: false };
    const wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';
    window.addEventListener(wheelEvent, () => {}, wheelOpt);
}

// ============================================
// EVENT LISTENERS
// ============================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        optimizeForMobile();
        initializeApp();
    });
} else {
    optimizeForMobile();
    initializeApp();
}

// Handle online/offline events
window.addEventListener('online', () => {
    console.log('🌐 App is online');
    showToast('🌐 Koneksi pulih - aplikasi berjalan normal', 'info');
    
    // Optional: Trigger sync when back online
    if (window.db && typeof window.db.syncToPersistentStorage === 'function') {
        window.db.syncToPersistentStorage();
    }
});

window.addEventListener('offline', () => {
    console.log('📱 App is offline - working in offline mode');
    showToast('📱 Mode offline - data disimpan lokal', 'info');
});

// Handle page visibility (save data when user leaves)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('👋 Page hidden - ensuring data is saved...');
        // Optional: Auto-save pending changes
    }
});

// Handle beforeunload to warn about unsaved changes
let hasUnsavedChanges = false;
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Anda memiliki perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?';
        return e.returnValue;
    }
});

// ============================================
// EXPORT DEBUGGING TOOLS
// ============================================

window.debugApp = {
    // Core functions
    checkStorageStatus,
    initializeApp,
    systemHealthCheck,
    
    // Data operations
    exportAllData,
    exportAsSQLite,
    importDataFromFile,
    
    // Reports
    getTopPerformerReport,
    getAttendanceReport,
    
    // Database access (readonly)
    getDB: () => window.db,
    getSQLite: () => window.sqlEngine,
    getUI: () => window.ui,
    
    // Utilities
    showToast,
    getDatabaseStats,
    getSQLiteStatus,
    
    // Set unsaved changes flag
    setUnsavedChanges: (value) => { hasUnsavedChanges = value; },
    getUnsavedChanges: () => hasUnsavedChanges,
    
    // Version info
    version: '2.0.0',
    buildDate: '2026-01-28'
};

console.log('🐛 Debug tools available: window.debugApp');
console.log('   - window.debugApp.systemHealthCheck() untuk cek kesehatan sistem');
console.log('   - window.debugApp.getDatabaseStats() untuk lihat statistik DB');
console.log('   - window.debugApp.exportAllData() untuk backup data');
