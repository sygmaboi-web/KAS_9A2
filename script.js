// --- KONFIGURASI ---
const scriptURL = 'MASUKKAN_URL_WEB_APP_DI_SINI'; 
const TARGET_KAS = 50000; 

document.getElementById('label-target').textContent = 'Rp ' + TARGET_KAS.toLocaleString('id-ID');

function bukaTab(namaTab) {
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(namaTab + '-view').style.display = 'block';
    
    if(namaTab !== 'form') {
        let btnAktiv = document.querySelector(`.tab-btn[onclick="bukaTab('${namaTab}')"]`);
        if(btnAktiv) btnAktiv.classList.add('active');
        muatData(); 
    }
}

function muatData() {
    const tbodyRiwayat = document.getElementById('data-riwayat');
    const tbodyRekapan = document.getElementById('data-rekapan');
    const saldoTotalEl = document.getElementById('total-kas-kelas');

    tbodyRiwayat.innerHTML = '<tr><td colspan="5" class="loading">Memuat data dari server...</td></tr>';
    tbodyRekapan.innerHTML = '<tr><td colspan="3" class="loading">Menghitung rekap...</td></tr>';

    fetch(scriptURL)
        .then(response => response.json())
        .then(data => {
            tbodyRiwayat.innerHTML = '';
            tbodyRekapan.innerHTML = '';
            
            if (data.length === 0) {
                tbodyRiwayat.innerHTML = '<tr><td colspan="5" class="loading">Belum ada riwayat.</td></tr>';
                tbodyRekapan.innerHTML = '<tr><td colspan="3" class="loading">Belum ada data rekapan.</td></tr>';
                saldoTotalEl.textContent = 'Rp 0';
                return;
            }

            let totalKasKelas = 0;
            let rekapSiswa = {};

            data.forEach(baris => {
                let nominalAngka = parseInt(baris.nominal) || 0;
                
                // 1. Tampilkan di Tabel Riwayat + Tombol Edit & Hapus
                let btnAksi = `
                    <div class="aksi-buttons">
                        <button class="btn-icon edit" onclick="editData(${baris.row}, '${baris.tanggal}', '${baris.nama}', ${nominalAngka}, '${baris.keterangan}')"><i class='bx bx-edit'></i></button>
                        <button class="btn-icon delete" onclick="hapusData(${baris.row})"><i class='bx bx-trash'></i></button>
                    </div>
                `;
                tbodyRiwayat.innerHTML += `<tr><td>${baris.tanggal}</td><td>${baris.nama}</td><td>Rp ${nominalAngka.toLocaleString('id-ID')}</td><td>${baris.keterangan}</td><td>${btnAksi}</td></tr>`;

                // 2. Proses Angka untuk Rekapan
                totalKasKelas += nominalAngka; 
                let namaClean = baris.nama.trim().toUpperCase();
                if(!rekapSiswa[namaClean]) { rekapSiswa[namaClean] = 0; }
                rekapSiswa[namaClean] += nominalAngka;
            });

            saldoTotalEl.textContent = 'Rp ' + totalKasKelas.toLocaleString('id-ID');

            for (let namaSiswa in rekapSiswa) {
                let totalBayar = rekapSiswa[namaSiswa];
                let sisa = TARGET_KAS - totalBayar;
                
                let statusBadge = sisa <= 0 
                    ? `<span class="badge lunas">Lunas (Lebih Rp ${Math.abs(sisa).toLocaleString('id-ID')})</span>` 
                    : `<span class="badge kurang">Kurang Rp ${sisa.toLocaleString('id-ID')}</span>`;

                tbodyRekapan.innerHTML += `<tr><td><strong>${namaSiswa}</strong></td><td>Rp ${totalBayar.toLocaleString('id-ID')}</td><td>${statusBadge}</td></tr>`;
            }
        })
        .catch(error => {
            tbodyRiwayat.innerHTML = '<tr><td colspan="5" style="color:red;" class="loading">Gagal memuat jaringan.</td></tr>';
            tbodyRekapan.innerHTML = '<tr><td colspan="3" style="color:red;" class="loading">Gagal memuat jaringan.</td></tr>';
        });
}

muatData();

// --- FITUR FORM INPUT / EDIT ---
const form = document.getElementById('form-kas');
const btnKirim = document.getElementById('tombol-kirim');
const pesanNotif = document.getElementById('pesan-notif');

function siapkanFormTambah() {
    form.reset();
    document.getElementById('form-action').value = 'insert';
    document.getElementById('form-row').value = '';
    document.getElementById('judul-form').textContent = 'Setor Uang Kas Baru';
    document.getElementById('tombol-kirim').textContent = 'Simpan Data';
    bukaTab('form');
}

function editData(row, tanggal, nama, nominal, keterangan) {
    document.getElementById('form-action').value = 'edit';
    document.getElementById('form-row').value = row;
    
    // Konversi format tanggal YYYY-MM-DD biar bisa masuk ke input date
    let dateObj = new Date(tanggal);
    if (!isNaN(dateObj)) {
        document.getElementById('input-tanggal').value = dateObj.toISOString().split('T')[0];
    }
    
    document.getElementById('input-nama').value = nama;
    document.getElementById('input-nominal').value = nominal;
    document.getElementById('input-keterangan').value = keterangan;
    document.getElementById('input-password').value = '';
    
    document.getElementById('judul-form').textContent = 'Edit Data Kas';
    document.getElementById('tombol-kirim').textContent = 'Update Data';
    bukaTab('form');
}

// --- FITUR HAPUS DATA ---
function hapusData(row) {
    let pass = prompt("WARNING: Anda yakin ingin menghapus data ini?\n\nMasukkan Password Admin (SIGMABOY123) untuk konfirmasi:");
    
    if (pass === null || pass === "") return; // Batal jika kosong/cancel

    let tempForm = new FormData();
    tempForm.append('action', 'delete');
    tempForm.append('row', row);
    tempForm.append('password', pass);

    fetch(scriptURL, { method: 'POST', body: tempForm })
        .then(res => res.json())
        .then(data => {
            if(data.status === "sukses") {
                alert("Berhasil: " + data.pesan);
                muatData(); // Refresh langsung
            } else {
                alert("Gagal: " + data.pesan); // Akan muncul jika password salah
            }
        }).catch(err => alert('Error sistem jaringan.'));
}

form.addEventListener('submit', e => {
    e.preventDefault(); 
    let textTombolAsli = btnKirim.textContent;
    btnKirim.disabled = true;
    btnKirim.textContent = 'Memproses...';
    pesanNotif.style.display = 'none';

    fetch(scriptURL, { method: 'POST', body: new FormData(form)})
        .then(response => response.json())
        .then(data => {
            btnKirim.disabled = false;
            btnKirim.textContent = textTombolAsli;
            pesanNotif.style.display = 'block';

            if(data.status === "sukses") {
                pesanNotif.className = 'sukses';
                pesanNotif.textContent = data.pesan;
                setTimeout(() => { 
                    pesanNotif.style.display = 'none'; 
                    bukaTab('riwayat'); 
                }, 1500);
            } else {
                pesanNotif.className = 'gagal';
                pesanNotif.textContent = data.pesan; 
            }
        }).catch(err => {
            btnKirim.disabled = false;
            btnKirim.textContent = textTombolAsli;
            pesanNotif.style.display = 'block';
            pesanNotif.className = 'gagal';
            pesanNotif.textContent = 'Terjadi kesalahan sistem.';
        });
});
