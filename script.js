// MASUKKAN URL WEB APP GOOGLE SCRIPT DI BAWAH INI
const scriptURL = 'MASUKKAN_URL_WEB_APP_DI_SINI'; 

// Variabel Elemen HTML
const berandaContainer = document.getElementById('beranda-container');
const formContainer = document.getElementById('form-container');
const btnTambah = document.getElementById('btn-tambah');
const btnKembali = document.getElementById('btn-kembali');

const tabelBody = document.getElementById('data-kas');
const form = document.getElementById('form-kas');
const btnKirim = document.getElementById('tombol-kirim');
const pesanNotif = document.getElementById('pesan-notif');

// --- FITUR GANTI HALAMAN ---
btnTambah.addEventListener('click', () => {
    berandaContainer.style.display = 'none';
    formContainer.style.display = 'block';
});

btnKembali.addEventListener('click', () => {
    formContainer.style.display = 'none';
    berandaContainer.style.display = 'block';
    muatData(); // Refresh tabel saat kembali ke beranda
});

// --- FITUR LOAD DATA BERANDA ---
function muatData() {
    tabelBody.innerHTML = '<tr><td colspan="4" class="loading">Memuat data dari server...</td></tr>';
    fetch(scriptURL)
        .then(response => response.json())
        .then(data => {
            tabelBody.innerHTML = '';
            if (data.length === 0) {
                tabelBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada data uang kas.</td></tr>';
                return;
            }
            data.forEach(baris => {
                let tr = document.createElement('tr');
                tr.innerHTML = `<td>${baris.tanggal}</td><td>${baris.nama}</td><td>Rp ${baris.nominal}</td><td>${baris.keterangan}</td>`;
                tabelBody.appendChild(tr);
            });
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            tabelBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Gagal memuat data jaringan.</td></tr>';
        });
}

// Panggil muatData saat website pertama kali dibuka
muatData();

// --- FITUR KIRIM DATA & CEK PASSWORD ---
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
                
                // Pindah otomatis ke beranda setelah sukses (delay 2 detik)
                setTimeout(() => { 
                    pesanNotif.style.display = 'none'; 
                    btnKembali.click(); 
                }, 2000);
            } else {
                pesanNotif.className = 'gagal';
                pesanNotif.textContent = data.pesan; // Bakal muncul "Password Salah!" kalau ga match
            }
        })
        .catch(error => {
            console.error('Error!', error);
            btnKirim.disabled = false;
            btnKirim.textContent = 'Simpan Data';
            pesanNotif.style.display = 'block';
            pesanNotif.className = 'gagal';
            pesanNotif.textContent = 'Terjadi kesalahan sistem/jaringan.';
        });
});
