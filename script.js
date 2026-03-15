// --- KONFIGURASI PENTING ---
const scriptURL = 'https://script.google.com/macros/s/AKfycbxnylY84K9U0CdybaoWRSpegN9H_dEy9WJDUapk3xycB7k92HhA-ElDG8ZYSu-w2Ag/exec'; 
const TARGET_KAS = 40000; 

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
    const tbodyPengeluaran = document.getElementById('data-pengeluaran');
    const tbodyRekapan = document.getElementById('data-rekapan');
    const saldoTotalEl = document.getElementById('total-kas-kelas');
    const detailSaldoEl = document.getElementById('detail-saldo');

    tbodyRiwayat.innerHTML = '<tr><td colspan="5" class="loading">Memuat kas masuk...</td></tr>';
    tbodyPengeluaran.innerHTML = '<tr><td colspan="5" class="loading">Memuat pengeluaran...</td></tr>';
    tbodyRekapan.innerHTML = '<tr><td colspan="3" class="loading">Menghitung rekap...</td></tr>';

    fetch(scriptURL)
        .then(response => response.json())
        .then(data => {
            tbodyRiwayat.innerHTML = ''; tbodyPengeluaran.innerHTML = ''; tbodyRekapan.innerHTML = '';
            
            // Perbaikan: Nangkap data dari object { pemasukan: [...], pengeluaran: [...] }
            var dataPemasukan = data.pemasukan || [];
            var dataPengeluaran = data.pengeluaran || [];

            if (dataPemasukan.length === 0) tbodyRiwayat.innerHTML = '<tr><td colspan="5" class="loading">Belum ada kas masuk.</td></tr>';
            if (dataPengeluaran.length === 0) tbodyPengeluaran.innerHTML = '<tr><td colspan="5" class="loading">Belum ada pengeluaran.</td></tr>';

            let totalPemasukan = 0; let totalPengeluaran = 0; let rekapSiswa = {};

            // Render Kas Masuk
            dataPemasukan.forEach(baris => {
                let nominalAngka = parseInt(baris.nominal) || 0;
                let btnAksi = `<div class="aksi-buttons"><button class="btn-icon edit" onclick="editData(${baris.row}, '${baris.tanggal}', '${baris.nama}', ${nominalAngka}, '${baris.keterangan}', 'pemasukan')"><i class='bx bx-edit'></i></button><button class="btn-icon delete" onclick="hapusData(${baris.row}, 'pemasukan')"><i class='bx bx-trash'></i></button></div>`;
                tbodyRiwayat.innerHTML += `<tr><td>${baris.tanggal}</td><td>${baris.nama}</td><td>Rp ${nominalAngka.toLocaleString('id-ID')}</td><td>${baris.keterangan}</td><td>${btnAksi}</td></tr>`;
                
                totalPemasukan += nominalAngka; 
                let namaClean = baris.nama.trim().toUpperCase();
                if(!rekapSiswa[namaClean]) { rekapSiswa[namaClean] = 0; }
                rekapSiswa[namaClean] += nominalAngka;
            });

            // Render Pengeluaran
            dataPengeluaran.forEach(baris => {
                let nominalAngka = parseInt(baris.nominal) || 0;
                let btnAksi = `<div class="aksi-buttons"><button class="btn-icon edit" onclick="editData(${baris.row}, '${baris.tanggal}', '${baris.nama}', ${nominalAngka}, '${baris.keterangan}', 'pengeluaran')"><i class='bx bx-edit'></i></button><button class="btn-icon delete" onclick="hapusData(${baris.row}, 'pengeluaran')"><i class='bx bx-trash'></i></button></div>`;
                tbodyPengeluaran.innerHTML += `<tr><td>${baris.tanggal}</td><td>${baris.nama}</td><td>Rp ${nominalAngka.toLocaleString('id-ID')}</td><td>${baris.keterangan}</td><td>${btnAksi}</td></tr>`;
                totalPengeluaran += nominalAngka;
            });

            // Kalkulasi Dashboard
            let sisaSaldo = totalPemasukan - totalPengeluaran;
            saldoTotalEl.textContent = 'Rp ' + sisaSaldo.toLocaleString('id-ID');
            detailSaldoEl.textContent = `Masuk: Rp ${totalPemasukan.toLocaleString('id-ID')} | Keluar: Rp ${totalPengeluaran.toLocaleString('id-ID')}`;

            // Kalkulasi Target Individu
            for (let namaSiswa in rekapSiswa) {
                let totalBayar = rekapSiswa[namaSiswa];
                let sisa = TARGET_KAS - totalBayar;
                let statusBadge = sisa <= 0 ? `<span class="badge lunas">Lunas (Lebih Rp ${Math.abs(sisa).toLocaleString('id-ID')})</span>` : `<span class="badge kurang">Kurang Rp ${sisa.toLocaleString('id-ID')}</span>`;
                tbodyRekapan.innerHTML += `<tr><td><strong>${namaSiswa}</strong></td><td>Rp ${totalBayar.toLocaleString('id-ID')}</td><td>${statusBadge}</td></tr>`;
            }
            if (Object.keys(rekapSiswa).length === 0) tbodyRekapan.innerHTML = '<tr><td colspan="3" class="loading">Belum ada rekap.</td></tr>';
        }).catch(err => {
            console.error("Error:", err);
            tbodyRiwayat.innerHTML = '<tr><td colspan="5" style="color:red;" class="loading">Gagal jaringan.</td></tr>';
            tbodyPengeluaran.innerHTML = '<tr><td colspan="5" style="color:red;" class="loading">Gagal jaringan.</td></tr>';
            tbodyRekapan.innerHTML = '<tr><td colspan="3" style="color:red;" class="loading">Gagal jaringan.</td></tr>';
        });
}

muatData();

// --- PENGATURAN FORM ---
const form = document.getElementById('form-kas');
const btnKirim = document.getElementById('tombol-kirim');
const pesanNotif = document.getElementById('pesan-notif');

function aturFormUI(tipe) {
    document.getElementById('form-tipe').value = tipe;
    if (tipe === 'pengeluaran') {
        document.getElementById('label-nama').textContent = 'Barang / Keperluan';
        document.getElementById('group-pemasukan').style.display = 'none';
        document.getElementById('input-keterangan-pemasukan').disabled = true; 
        
        document.getElementById('group-pengeluaran').style.display = 'block';
        document.getElementById('input-keterangan-pengeluaran').disabled = false;
        
        document.getElementById('judul-form').textContent = 'Catat Pengeluaran';
        document.getElementById('tombol-kirim').style.backgroundColor = '#ef4444'; 
    } else {
        document.getElementById('label-nama').textContent = 'Nama Siswa';
        document.getElementById('group-pemasukan').style.display = 'block';
        document.getElementById('input-keterangan-pemasukan').disabled = false;
        
        document.getElementById('group-pengeluaran').style.display = 'none';
        document.getElementById('input-keterangan-pengeluaran').disabled = true;
        
        document.getElementById('judul-form').textContent = 'Setor Uang Kas';
        document.getElementById('tombol-kirim').style.backgroundColor = '#3b82f6'; 
    }
}

function siapkanFormTambah(tipe) {
    form.reset();
    document.getElementById('form-action').value = 'insert';
    document.getElementById('form-row').value = '';
    aturFormUI(tipe);
    document.getElementById('tombol-kirim').textContent = 'Simpan Data';
    bukaTab('form');
}

function editData(row, tanggal, nama, nominal, keterangan, tipe) {
    form.reset();
    document.getElementById('form-action').value = 'edit';
    document.getElementById('form-row').value = row;
    aturFormUI(tipe);
    
    let dateObj = new Date(tanggal);
    if (!isNaN(dateObj)) document.getElementById('input-tanggal').value = dateObj.toISOString().split('T')[0];
    
    document.getElementById('input-nama').value = nama;
    document.getElementById('input-nominal').value = nominal;
    
    if (tipe === 'pengeluaran') {
        document.getElementById('input-keterangan-pengeluaran').value = keterangan;
    } else {
        document.getElementById('input-keterangan-pemasukan').value = keterangan;
    }
    document.getElementById('tombol-kirim').textContent = 'Update Data';
    bukaTab('form');
}

function hapusData(row, tipe) {
    let pass = prompt("WARNING: Anda yakin ingin menghapus data ini?\n\nMasukkan sandi Admin (SIGMABOY123):");
    if (!pass) return; 

    let tempForm = new FormData();
    tempForm.append('action', 'delete');
    tempForm.append('row', row);
    tempForm.append('tipe', tipe);
    tempForm.append('password', pass);

    fetch(scriptURL, { method: 'POST', body: tempForm })
        .then(res => res.json())
        .then(data => {
            if(data.status === "sukses") { alert("Berhasil: " + data.pesan); muatData(); } 
            else { alert("Gagal: " + data.pesan); }
        }).catch(err => alert('Error sistem jaringan.'));
}

form.addEventListener('submit', e => {
    e.preventDefault(); 
    let textTombolAsli = btnKirim.textContent;
    btnKirim.disabled = true;
    btnKirim.textContent = 'Memproses...';
    pesanNotif.style.display = 'none';

    fetch(scriptURL, { method: 'POST', body: new FormData(form)})
        .then(res => res.json())
        .then(data => {
            btnKirim.disabled = false; btnKirim.textContent = textTombolAsli;
            pesanNotif.style.display = 'block';

            if(data.status === "sukses") {
                pesanNotif.className = 'sukses'; pesanNotif.textContent = data.pesan;
                let tipe = document.getElementById('form-tipe').value;
                setTimeout(() => { pesanNotif.style.display = 'none'; bukaTab(tipe === 'pengeluaran' ? 'pengeluaran' : 'riwayat'); }, 1500);
            } else {
                pesanNotif.className = 'gagal'; pesanNotif.textContent = data.pesan; 
            }
        }).catch(err => {
            btnKirim.disabled = false; btnKirim.textContent = textTombolAsli;
            pesanNotif.style.display = 'block'; pesanNotif.className = 'gagal';
            pesanNotif.textContent = 'Terjadi kesalahan sistem.';
        });
});
