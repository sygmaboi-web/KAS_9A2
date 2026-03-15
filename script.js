// --- KONFIGURASI ---
const scriptURL = 'MASUKKAN_URL_WEB_APP_DI_SINI'; 
const TARGET_KAS = 50000; // UBAH ANGKA INI: Target kas per orang (Misal: 50.000)

// Menampilkan target di UI
document.getElementById('label-target').textContent = 'Rp ' + TARGET_KAS.toLocaleString('id-ID');

// --- FITUR GANTI TAB ---
function bukaTab(namaTab) {
    // Sembunyikan semua view
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    // Hilangkan efek aktif di tombol
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // Tampilkan yang dipilih
    document.getElementById(namaTab + '-view').style.display = 'block';
    
    // Update tombol nav (kecuali form)
    if(namaTab !== 'form') {
        event.currentTarget.classList.add('active');
        muatData(); // Selalu refresh data pas ganti tab
    }
}

// --- FITUR LOAD & HITUNG REKAPAN ---
function muatData() {
    const tbodyRiwayat = document.getElementById('data-riwayat');
    const tbodyRekapan = document.getElementById('data-rekapan');
    const saldoTotalEl = document.getElementById('total-kas-kelas');

    tbodyRiwayat.innerHTML = '<tr><td colspan="4" class="loading">Memuat data dari server...</td></tr>';
    tbodyRekapan.innerHTML = '<tr><td colspan="3" class="loading">Menghitung rekap...</td></tr>';

    fetch(scriptURL)
        .then(response => response.json())
        .then(data => {
            tbodyRiwayat.innerHTML = '';
            tbodyRekapan.innerHTML = '';
            
            if (data.length === 0) {
                tbodyRiwayat.innerHTML = '<tr><td colspan="4" class="loading">Belum ada riwayat.</td></tr>';
                tbodyRekapan.innerHTML = '<tr><td colspan="3" class="loading">Belum ada data rekapan.</td></tr>';
                saldoTotalEl.textContent = 'Rp 0';
                return;
            }

            let totalKasKelas = 0;
            let rekapSiswa = {};

            // LOOPING DATA (Untuk nampilin Riwayat sekaligus ngitung Rekapan)
            data.forEach(baris => {
                // 1. Tampilkan di Tabel Riwayat (History)
                tbodyRiwayat.innerHTML += `<tr><td>${baris.tanggal}</td><td>${baris.nama}</td><td>Rp ${parseInt(baris.nominal).toLocaleString('id-ID')}</td><td>${baris.keterangan}</td></tr>`;

                // 2. Proses Angka untuk Rekapan
                let nominal = parseInt(baris.nominal) || 0;
                totalKasKelas += nominal; // Tambah ke saldo total

                // Normalisasi nama (biar huruf besar/kecil dianggap sama)
                let namaClean = baris.nama.trim().toUpperCase();
                if(!rekapSiswa[namaClean]) { rekapSiswa[namaClean] = 0; }
                rekapSiswa[namaClean] += nominal;
            });

            // UPDATE TAMPILAN SALDO KELAS
            saldoTotalEl.textContent = 'Rp ' + totalKasKelas.toLocaleString('id-ID');

            // UPDATE TAMPILAN TABEL REKAPAN PER SISWA
            for (let namaSiswa in rekapSiswa) {
                let totalBayar = rekapSiswa[namaSiswa];
                let sisa = TARGET_KAS - totalBayar;
                
                let statusBadge = '';
                if (sisa <= 0) {
                    statusBadge = `<span class="badge lunas">Lunas (Lebih Rp ${Math.abs(sisa).toLocaleString('id-ID')})</span>`;
                } else {
                    statusBadge = `<span class="badge kurang">Kurang Rp ${sisa.toLocaleString('id-ID')}</span>`;
                }

                tbodyRekapan.innerHTML += `<tr>
                    <td><strong>${namaSiswa}</strong></td>
                    <td>Rp ${totalBayar.toLocaleString('id-ID')}</td>
                    <td>${statusBadge}</td>
                </tr>`;
            }
        })
        .catch(error => {
            tbodyRiwayat.innerHTML = '<tr><td colspan="4" style="color:red;" class="loading">Gagal memuat.</td></tr>';
            tbodyRekapan.innerHTML = '<tr><td colspan="3" style="color:red;" class="loading">Gagal memuat.</td></tr>';
        });
}

// Load pertama kali
muatData();

// --- FITUR FORM INPUT ---
const form = document.getElementById('form-kas');
const btnKirim = document.getElementById('tombol-kirim');
const pesanNotif = document.getElementById('pesan-notif');

form.addEventListener('submit', e => {
    e.preventDefault(); 
    btnKirim.disabled = true;
    btnKirim.textContent = 'Memverifikasi...';
    pesanNotif.style.display = 'none';

    fetch(scriptURL, { method: 'POST', body: new FormData(form)})
        .then(response => response.json())
        .then(data => {
            btnKirim.disabled = false;
            btnKirim.textContent = 'Simpan Data';
            pesanNotif.style.display = 'block';

            if(data.status === "sukses") {
                pesanNotif.className = 'sukses';
                pesanNotif.textContent = data.pesan;
                form.reset();
                setTimeout(() => { 
                    pesanNotif.style.display = 'none'; 
                    bukaTab('riwayat'); // Balik ke riwayat
                }, 1500);
            } else {
                pesanNotif.className = 'gagal';
                pesanNotif.textContent = data.pesan; 
            }
        }).catch(err => {
            btnKirim.disabled = false;
            btnKirim.textContent = 'Simpan Data';
            pesanNotif.style.display = 'block';
            pesanNotif.className = 'gagal';
            pesanNotif.textContent = 'Terjadi kesalahan sistem.';
        });
});
