// File: js/tab-handler.js
// Fungsionalitas untuk menangani perpindahan tab pada halaman dashboard

document.addEventListener('DOMContentLoaded', function() {
    // Inisialisasi semua fungsionalitas tab
    initTabNavigation();
});

/**
 * Inisialisasi navigasi tab
 * Memastikan perpindahan antar tab berjalan dengan lancar
 */
function initTabNavigation() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = {
        'input': document.getElementById('inputTab'),
        'recap': document.getElementById('recapTab'),
        'grades': document.getElementById('gradesTab')
    };
    
    // Jika tidak ada tab atau konten tab, hentikan
    if (!tabs.length || !tabContents.input || !tabContents.recap || !tabContents.grades) {
        console.warn('Elemen tab tidak ditemukan');
        return;
    }
    
    // Fungsi untuk menampilkan tab tertentu
    function showTab(tabId) {
        // Sembunyikan semua konten tab
        Object.values(tabContents).forEach(content => {
            if (content) content.style.display = 'none';
        });
        
        // Tampilkan konten tab yang dipilih
        if (tabContents[tabId]) {
            tabContents[tabId].style.display = 'block';
        }
        
        // Update active class pada tombol tab
        tabs.forEach(tab => {
            const tabValue = tab.getAttribute('data-tab');
            if (tabValue === tabId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Trigger event khusus ketika tab berubah
        const tabChangeEvent = new CustomEvent('tabChanged', { detail: { tabId: tabId } });
        document.dispatchEvent(tabChangeEvent);
    }
    
    // Tambahkan event listener ke setiap tab
    tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-tab');
            if (tabId && tabContents[tabId]) {
                showTab(tabId);
            }
        });
    });
    
    // Tampilkan tab yang aktif saat ini berdasarkan class active pada tab
    let activeTabFound = false;
    tabs.forEach(tab => {
        if (tab.classList.contains('active')) {
            const tabId = tab.getAttribute('data-tab');
            if (tabId && tabContents[tabId]) {
                showTab(tabId);
                activeTabFound = true;
            }
        }
    });
    
    // Jika tidak ada tab yang aktif, tampilkan tab pertama (biasanya input/kehadiran)
    if (!activeTabFound && tabs.length > 0) {
        const firstTabId = tabs[0].getAttribute('data-tab');
        if (firstTabId && tabContents[firstTabId]) {
            showTab(firstTabId);
        }
    }
}

/**
 * Fungsi untuk berpindah ke tab tertentu secara programatis
 * Bisa dipanggil dari kode lain jika diperlukan
 * @param {string} tabId - ID tab yang akan ditampilkan ('input', 'recap', atau 'grades')
 */
function switchToTab(tabId) {
    const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
    if (tab) {
        tab.click();
    } else {
        console.warn(`Tab dengan data-tab="${tabId}" tidak ditemukan`);
    }
}

// Ekspos fungsi ke global scope agar bisa dipanggil dari file lain (app.js, dll)
window.switchToTab = switchToTab;