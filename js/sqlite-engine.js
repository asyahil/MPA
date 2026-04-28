// ============================================
// sqlite-engine.js - SQL.js ENGINE (Fast Query)
// FIXED: Better loading with proper initialization
// ============================================

class SQLiteEngine {
    constructor() {
        this.db = null;
        this.isReady = false;
        this.initPromise = null;
        this.SQL = null; // Store SQL.js reference
    }

    async init() {
        // Prevent multiple initialization
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = (async () => {
            console.log('⚡ Initializing SQLite Engine...');
            
            try {
                // Load SQL.js with proper initialization
                await this.loadSQLJS();
                
                // Create or initialize database
                if (this.db === null && this.SQL) {
                    this.db = new this.SQL.Database();
                    this.createTables();
                    this.isReady = true;
                    console.log('✅ SQLite Engine ready');
                } else if (this.db === null) {
                    throw new Error('SQL.js not properly initialized');
                }
                
                return true;
            } catch (error) {
                console.error('❌ SQLite Engine initialization failed:', error);
                this.isReady = false;
                throw error;
            }
        })();
        
        return this.initPromise;
    }

    loadSQLJS() {
        return new Promise((resolve, reject) => {
            // Check if already loaded globally
            if (typeof window.SQL !== 'undefined' && window.SQL.Database) {
                console.log('SQL.js already loaded globally');
                this.SQL = window.SQL;
                resolve();
                return;
            }
            
            // Try multiple CDN sources with proper WASM loading
            const cdnConfigs = [
                {
                    url: 'https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.js',
                    wasm: 'https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.wasm'
                },
                {
                    url: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js',
                    wasm: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm'
                },
                {
                    url: 'https://unpkg.com/sql.js@1.8.0/dist/sql-wasm.js',
                    wasm: 'https://unpkg.com/sql.js@1.8.0/dist/sql-wasm.wasm'
                }
            ];
            
            let currentIndex = 0;
            
            const tryLoad = () => {
                if (currentIndex >= cdnConfigs.length) {
                    reject(new Error('Failed to load SQL.js from all CDNs'));
                    return;
                }
                
                const config = cdnConfigs[currentIndex];
                console.log(`Attempting to load SQL.js from ${config.url}`);
                
                // Set up the locateFile function before loading the script
                window.SQL = {
                    locateFile: function(file) {
                        if (file === 'sql-wasm.wasm') {
                            return config.wasm;
                        }
                        return config.url.replace('sql-wasm.js', file);
                    }
                };
                
                const script = document.createElement('script');
                script.src = config.url;
                script.onload = () => {
                    // Wait for SQL to be initialized
                    const checkSQL = setInterval(() => {
                        if (typeof window.SQL !== 'undefined' && window.SQL.Database) {
                            clearInterval(checkSQL);
                            console.log(`✅ SQL.js loaded successfully from ${config.url}`);
                            this.SQL = window.SQL;
                            resolve();
                        } else if (window.initSqlJs) {
                            // Alternative initialization method
                            clearInterval(checkSQL);
                            window.initSqlJs({
                                locateFile: function(file) {
                                    return config.wasm;
                                }
                            }).then(function(SQL) {
                                console.log(`✅ SQL.js initialized via initSqlJs from ${config.url}`);
                                window.SQL = SQL;
                                this.SQL = SQL;
                                resolve();
                            }.bind(this)).catch(reject);
                        }
                    }, 100);
                    
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        clearInterval(checkSQL);
                        if (!this.SQL) {
                            console.warn(`Timeout loading SQL.js from ${config.url}`);
                            currentIndex++;
                            tryLoad();
                        }
                    }, 5000);
                };
                script.onerror = () => {
                    console.warn(`Failed to load from ${config.url}`);
                    currentIndex++;
                    tryLoad();
                };
                document.head.appendChild(script);
            };
            
            tryLoad();
        });
    }

    createTables() {
        if (!this.db) {
            console.error('Database not initialized');
            return;
        }
        
        try {
            // Classes table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS classes (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    createdAt TEXT NOT NULL
                )
            `);

            // Students table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS students (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    classId TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    FOREIGN KEY (classId) REFERENCES classes(id) ON DELETE CASCADE
                )
            `);

            // Attendance table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS attendance (
                    id INTEGER PRIMARY KEY,
                    classId TEXT NOT NULL,
                    studentId INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    status TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT,
                    FOREIGN KEY (classId) REFERENCES classes(id) ON DELETE CASCADE,
                    FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
                    UNIQUE(classId, studentId, date)
                )
            `);

            // Grades table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS grades (
                    id INTEGER PRIMARY KEY,
                    classId TEXT NOT NULL,
                    studentId INTEGER NOT NULL,
                    assessmentType TEXT NOT NULL,
                    score REAL,
                    date TEXT NOT NULL,
                    scope TEXT DEFAULT 'daily',
                    notes TEXT,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT,
                    FOREIGN KEY (classId) REFERENCES classes(id) ON DELETE CASCADE,
                    FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
                )
            `);

            // Create indexes for performance
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_students_classId ON students(classId)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_classId_date ON attendance(classId, date)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_studentId ON attendance(studentId)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_grades_classId ON grades(classId)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_grades_studentId ON grades(studentId)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_grades_assessment ON grades(assessmentType)`);
            
            console.log('✅ SQLite tables created');
        } catch (error) {
            console.error('Failed to create tables:', error);
            throw error;
        }
    }

    // ==================== QUERY METHODS ====================
    
    getAll(sql, params = []) {
        if (!this.isReady || !this.db) {
            console.warn('SQLite Engine not ready, returning empty array');
            return [];
        }
        
        try {
            const stmt = this.db.prepare(sql);
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        } catch (error) {
            console.error('SQL Error:', sql, error);
            return [];
        }
    }

    getFirst(sql, params = []) {
        const results = this.getAll(sql, params);
        return results[0] || null;
    }

    run(sql, params = []) {
        if (!this.isReady || !this.db) {
            throw new Error('SQLite Engine not ready');
        }
        
        try {
            this.db.run(sql, params);
            return { 
                changes: this.db.getRowsModified(), 
                lastInsertRowid: this.getLastInsertRowId()
            };
        } catch (error) {
            console.error('SQL Error:', sql, error);
            throw error;
        }
    }
    
    getLastInsertRowId() {
        try {
            const result = this.db.exec("SELECT last_insert_rowid()");
            if (result && result[0] && result[0].values && result[0].values[0]) {
                return result[0].values[0][0];
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    // ==================== DATA IMPORT/EXPORT ====================
    
    exportToUint8Array() {
        if (!this.db) return new Uint8Array(0);
        return this.db.export();
    }

    importFromUint8Array(data) {
        if (!this.SQL) {
            console.error('SQL.js not loaded');
            return;
        }
        this.db = new this.SQL.Database(data);
        this.isReady = true;
        console.log('✅ Data imported to SQLite Engine');
    }

    clear() {
        if (!this.SQL) {
            console.error('SQL.js not loaded');
            return;
        }
        this.db = new this.SQL.Database();
        this.createTables();
        this.isReady = true;
        console.log('✅ SQLite Engine cleared');
    }
    
    clearTable(tableName) {
        if (!this.isReady || !this.db) return;
        this.db.run(`DELETE FROM ${tableName}`);
        console.log(`✅ Table ${tableName} cleared`);
    }

    getSize() {
        if (!this.db) return 0;
        const exported = this.db.export();
        return exported.byteLength;
    }
    
    isInitialized() {
        return this.isReady && this.db !== null;
    }
}

// Create global instance
window.sqlEngine = new SQLiteEngine();