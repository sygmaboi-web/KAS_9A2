const scriptURL = 'https://script.google.com/macros/s/AKfycbxnylY84K9U0CdybaoWRSpegN9H_dEy9WJDUapk3xycB7k92HhA-ElDG8ZYSu-w2Ag/exec';
const DEFAULT_WEEKLY_FEE = 5000;
const LEGACY_WEEK_OPTIONS = ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'];

const state = {
    pemasukan: [],
    pengeluaran: [],
    hasLoadedOnce: false,
    isFetching: false,
    lastLoadedAt: 0,
    lookup: {
        pemasukan: {},
        pengeluaran: {}
    },
    meta: {
        apiVersion: 0,
        nominalPerMinggu: DEFAULT_WEEKLY_FEE,
        targetTotal: 0,
        weekOptions: []
    },
    supportsCrud: false
};

const refs = {
    apiStatus: document.getElementById('api-status'),
    syncBadge: document.getElementById('sync-badge'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    sections: document.querySelectorAll('.view-section'),
    saldoTotal: document.getElementById('total-kas-kelas'),
    detailSaldo: document.getElementById('detail-saldo'),
    targetLabel: document.getElementById('label-target'),
    summarySiswa: document.getElementById('summary-siswa'),
    summarySiswaNote: document.getElementById('summary-siswa-note'),
    summaryMinggu: document.getElementById('summary-minggu'),
    summaryTargetNote: document.getElementById('summary-target-note'),
    summaryLunas: document.getElementById('summary-lunas'),
    summaryLunasNote: document.getElementById('summary-lunas-note'),
    rekapBody: document.getElementById('data-rekapan'),
    riwayatBody: document.getElementById('data-riwayat'),
    pengeluaranBody: document.getElementById('data-pengeluaran'),
    form: document.getElementById('form-kas'),
    formAction: document.getElementById('form-action'),
    formRow: document.getElementById('form-row'),
    formTipe: document.getElementById('form-tipe'),
    formJudul: document.getElementById('judul-form'),
    inputTanggal: document.getElementById('input-tanggal'),
    inputNama: document.getElementById('input-nama'),
    inputNominal: document.getElementById('input-nominal'),
    labelNama: document.getElementById('label-nama'),
    selectMasuk: document.getElementById('input-keterangan-pemasukan'),
    inputKeluar: document.getElementById('input-keterangan-pengeluaran'),
    groupMasuk: document.getElementById('group-pemasukan'),
    groupKeluar: document.getElementById('group-pengeluaran'),
    submitButton: document.getElementById('tombol-kirim'),
    notif: document.getElementById('pesan-notif')
};

function padNumber(value) {
    return String(value).padStart(2, '0');
}

function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}-${padNumber(now.getDate())}`;
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatRupiah(value) {
    return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function formatSyncTime(date) {
    return new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function setSyncBadge(text) {
    if (!refs.syncBadge) {
        return;
    }
    refs.syncBadge.textContent = text;
}

function toNumber(value) {
    const parsed = parseInt(String(value == null ? '' : value).replace(/[^0-9-]/g, ''), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeName(value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeDateForInput(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) {
        return '';
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }

    const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
        let year = Number(match[3]);
        if (year < 100) {
            year += 2000;
        }
        return `${year}-${padNumber(match[2])}-${padNumber(match[1])}`;
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${padNumber(parsed.getMonth() + 1)}-${padNumber(parsed.getDate())}`;
    }

    return '';
}

function setNotif(type, message) {
    refs.notif.style.display = 'block';
    refs.notif.className = type;
    refs.notif.textContent = message;
}

function clearNotif() {
    refs.notif.style.display = 'none';
    refs.notif.className = '';
    refs.notif.textContent = '';
}

function buildFallbackTarget(rekapMap) {
    let highest = 0;
    Object.keys(rekapMap).forEach((nama) => {
        highest = Math.max(highest, rekapMap[nama]);
    });
    return highest;
}

function buildWeekOptions() {
    const options = state.meta.weekOptions && state.meta.weekOptions.length
        ? state.meta.weekOptions
        : LEGACY_WEEK_OPTIONS;
    const uniqueOptions = [];
    const seen = {};

    options.forEach((item) => {
        const label = String(item || '').trim();
        if (!label || seen[label]) {
            return;
        }
        seen[label] = true;
        uniqueOptions.push(label);
    });

    return uniqueOptions;
}

function setSelectOptions(selectedValue) {
    const options = buildWeekOptions();
    refs.selectMasuk.innerHTML = '<option value="" disabled>-- Pilih Pekan/Minggu --</option>';

    options.forEach((label) => {
        refs.selectMasuk.insertAdjacentHTML(
            'beforeend',
            `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`
        );
    });

    if (selectedValue && !options.includes(selectedValue)) {
        refs.selectMasuk.insertAdjacentHTML(
            'beforeend',
            `<option value="${escapeHtml(selectedValue)}">${escapeHtml(selectedValue)}</option>`
        );
    }

    refs.selectMasuk.value = selectedValue || '';
}

function updateApiStatus() {
    if (!refs.apiStatus) {
        return;
    }

    if (state.supportsCrud) {
        refs.apiStatus.hidden = true;
        refs.apiStatus.textContent = '';
        return;
    }

    refs.apiStatus.hidden = false;
    refs.apiStatus.textContent = 'Mode aman aktif: update Google Apps Script dulu agar tombol edit dan hapus benar-benar berfungsi.';
}

function updateSummaryCards(urutanNama, rekapMap, targetTotal) {
    if (!refs.summarySiswa || !refs.summaryMinggu || !refs.summaryLunas) {
        return;
    }

    const jumlahSiswa = urutanNama.length;
    const nominalMingguan = toNumber(state.meta.nominalPerMinggu) || DEFAULT_WEEKLY_FEE;
    const mingguAktif = toNumber(state.meta.activeWeekCount) || (nominalMingguan > 0 ? Math.round(targetTotal / nominalMingguan) : 0);
    let lunasCount = 0;

    urutanNama.forEach((nama) => {
        if (targetTotal > 0 && rekapMap[nama] >= targetTotal) {
            lunasCount += 1;
        }
    });

    refs.summarySiswa.textContent = jumlahSiswa;
    refs.summarySiswaNote.textContent = jumlahSiswa
        ? `${jumlahSiswa} siswa sedang dipantau di dashboard kas.`
        : 'Belum ada siswa aktif yang terbaca.';

    refs.summaryMinggu.textContent = mingguAktif;
    refs.summaryTargetNote.textContent = targetTotal > 0
        ? `Target aktif saat ini ${formatRupiah(targetTotal)} per siswa.`
        : 'Target aktif belum tersedia.';

    refs.summaryLunas.textContent = `${lunasCount}/${jumlahSiswa}`;
    refs.summaryLunasNote.textContent = jumlahSiswa
        ? `${Math.round((lunasCount / jumlahSiswa) * 100)}% siswa sudah mencapai target aktif.`
        : 'Belum ada progres pembayaran.';
}

function renderTableSkeleton(tbody, columns, label) {
    const rows = Array.from({ length: 4 }, (_, index) => `
        <tr class="loading-skeleton-row" style="animation-delay:${index * 60}ms">
            ${Array.from({ length: columns }, () => `
                <td><span class="skeleton-line"></span></td>
            `).join('')}
        </tr>
    `).join('');

    tbody.innerHTML = `
        ${rows}
        <tr>
            <td colspan="${columns}" class="loading loading-inline">${label}</td>
        </tr>
    `;
}

function showLoadingState() {
    renderTableSkeleton(refs.riwayatBody, 5, 'Memuat kas masuk...');
    renderTableSkeleton(refs.pengeluaranBody, 5, 'Memuat pengeluaran...');
    renderTableSkeleton(refs.rekapBody, 3, 'Menghitung rekap...');
}

function shouldRefreshSilently() {
    return state.hasLoadedOnce && Date.now() - state.lastLoadedAt > 45000;
}

function renderActionButtons(row, tipe) {
    if (!state.supportsCrud) {
        return `
            <div class="aksi-buttons">
                <button class="btn-icon edit" type="button" disabled title="Update Apps Script dulu"><i class="bx bx-edit"></i></button>
                <button class="btn-icon delete" type="button" disabled title="Update Apps Script dulu"><i class="bx bx-trash"></i></button>
            </div>
        `;
    }

    return `
        <div class="aksi-buttons">
            <button class="btn-icon edit" type="button" data-aksi="edit" data-row="${row}" data-tipe="${tipe}" title="Edit">
                <i class="bx bx-edit"></i>
            </button>
            <button class="btn-icon delete" type="button" data-aksi="delete" data-row="${row}" data-tipe="${tipe}" title="Hapus">
                <i class="bx bx-trash"></i>
            </button>
        </div>
    `;
}

function bukaTab(namaTab) {
    refs.sections.forEach((section) => {
        section.style.display = 'none';
    });

    refs.tabButtons.forEach((button) => {
        button.classList.remove('active');
    });

    const targetSection = document.getElementById(`${namaTab}-view`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }

    if (namaTab !== 'form') {
        const activeButton = document.querySelector(`.tab-btn[onclick="bukaTab('${namaTab}')"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
        if (!state.hasLoadedOnce) {
            muatData({ force: true, showLoader: true });
        } else if (shouldRefreshSilently()) {
            muatData({ silent: true });
        }
    }
}

function renderRekap(dataPemasukan) {
    const rekapMap = {};
    const urutanNama = [];
    
    dataPemasukan.forEach((item) => {
        const nama = normalizeName(item.nama);
        if (!nama) {
            return;
        }
        if (!(nama in rekapMap)) {
            urutanNama.push(nama);
        }
        rekapMap[nama] = (rekapMap[nama] || 0) + toNumber(item.nominal);
    });

    const targetTotal = toNumber(state.meta.targetTotal) || buildFallbackTarget(rekapMap);
    refs.targetLabel.textContent = formatRupiah(targetTotal);
    updateSummaryCards(urutanNama, rekapMap, targetTotal);

    if (!urutanNama.length) {
        refs.rekapBody.innerHTML = '<tr><td colspan="3" class="empty">Belum ada rekap.</td></tr>';
        return;
    }

    refs.rekapBody.innerHTML = urutanNama.map((nama) => {
        const totalBayar = rekapMap[nama];
        let statusBadge = '<span class="badge">Belum ada target</span>';

        if (targetTotal > 0) {
            const sisa = targetTotal - totalBayar;
            statusBadge = sisa <= 0
                ? `<span class="badge lunas">Lunas${sisa < 0 ? `, lebih ${formatRupiah(Math.abs(sisa))}` : ''}</span>`
                : `<span class="badge kurang">Kurang ${formatRupiah(sisa)}</span>`;
        }

        return `
            <tr>
                <td><strong>${escapeHtml(nama)}</strong></td>
                <td>${formatRupiah(totalBayar)}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

function renderRiwayat(dataPemasukan) {
    state.lookup.pemasukan = {};

    if (!dataPemasukan.length) {
        refs.riwayatBody.innerHTML = '<tr><td colspan="5" class="empty">Belum ada kas masuk.</td></tr>';
        return;
    }

    refs.riwayatBody.innerHTML = dataPemasukan.map((item) => {
        const nominal = toNumber(item.nominal);
        state.lookup.pemasukan[item.row] = item;

        return `
            <tr>
                <td>${escapeHtml(item.tanggal)}</td>
                <td>${escapeHtml(item.nama)}</td>
                <td>${formatRupiah(nominal)}</td>
                <td>${escapeHtml(item.keterangan || '-')}</td>
                <td>${renderActionButtons(item.row, 'pemasukan')}</td>
            </tr>
        `;
    }).join('');
}

function renderPengeluaran(dataPengeluaran) {
    state.lookup.pengeluaran = {};

    if (!dataPengeluaran.length) {
        refs.pengeluaranBody.innerHTML = '<tr><td colspan="5" class="empty">Belum ada pengeluaran.</td></tr>';
        return;
    }

    refs.pengeluaranBody.innerHTML = dataPengeluaran.map((item) => {
        const nominal = toNumber(item.nominal);
        state.lookup.pengeluaran[item.row] = item;

        return `
            <tr>
                <td>${escapeHtml(item.tanggal)}</td>
                <td>${escapeHtml(item.nama)}</td>
                <td>${formatRupiah(nominal)}</td>
                <td>${escapeHtml(item.keterangan || '-')}</td>
                <td>${renderActionButtons(item.row, 'pengeluaran')}</td>
            </tr>
        `;
    }).join('');
}

function renderSaldo(dataPemasukan, dataPengeluaran) {
    const totalPemasukan = dataPemasukan.reduce((sum, item) => sum + toNumber(item.nominal), 0);
    const totalPengeluaran = dataPengeluaran.reduce((sum, item) => sum + toNumber(item.nominal), 0);
    const saldo = totalPemasukan - totalPengeluaran;

    refs.saldoTotal.textContent = formatRupiah(saldo);
    refs.detailSaldo.textContent = `Masuk: ${formatRupiah(totalPemasukan)} | Keluar: ${formatRupiah(totalPengeluaran)}`;
}

function applyApiPayload(payload) {
    state.pemasukan = Array.isArray(payload.pemasukan) ? payload.pemasukan : [];
    state.pengeluaran = Array.isArray(payload.pengeluaran) ? payload.pengeluaran : [];
    state.meta = Object.assign(
        {
            apiVersion: 0,
            nominalPerMinggu: DEFAULT_WEEKLY_FEE,
            targetTotal: 0,
            weekOptions: []
        },
        payload.meta || {}
    );
    state.supportsCrud = Number(state.meta.apiVersion || 0) >= 2;
    state.hasLoadedOnce = true;
    state.lastLoadedAt = Date.now();

    setSyncBadge(`Sinkron ${formatSyncTime(new Date())}`);

    updateApiStatus();
    setSelectOptions('');
    renderSaldo(state.pemasukan, state.pengeluaran);
    renderRiwayat(state.pemasukan);
    renderPengeluaran(state.pengeluaran);
    renderRekap(state.pemasukan);
}

function muatData(options = {}) {
    const {
        force = false,
        silent = false,
        showLoader = false
    } = options;

    if (state.isFetching) {
        return;
    }

    if (!force && state.hasLoadedOnce && !silent) {
        return;
    }

    state.isFetching = true;

    if (showLoader || (!state.hasLoadedOnce && !silent)) {
        showLoadingState();
        setSyncBadge('Memuat data...');
    } else if (silent) {
        setSyncBadge('Menyegarkan...');
    }

    fetch(`${scriptURL}?_=${Date.now()}`, { cache: 'no-store' })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Gagal mengambil data');
            }
            return response.json();
        })
        .then((payload) => {
            applyApiPayload(payload || {});
        })
        .catch((error) => {
            console.error(error);
            setSyncBadge('Sinkron gagal');

            if (!state.hasLoadedOnce) {
                refs.riwayatBody.innerHTML = '<tr><td colspan="5" class="loading" style="color:#ef4444;">Gagal memuat data.</td></tr>';
                refs.pengeluaranBody.innerHTML = '<tr><td colspan="5" class="loading" style="color:#ef4444;">Gagal memuat data.</td></tr>';
                refs.rekapBody.innerHTML = '<tr><td colspan="3" class="loading" style="color:#ef4444;">Gagal memuat data.</td></tr>';
            }
        })
        .finally(() => {
            state.isFetching = false;
        });
}

function aturFormUI(tipe) {
    refs.formTipe.value = tipe;
    clearNotif();

    if (tipe === 'pengeluaran') {
        refs.labelNama.textContent = 'Barang / Keperluan';
        refs.formJudul.textContent = refs.formAction.value === 'edit' ? 'Edit Pengeluaran' : 'Catat Pengeluaran';
        refs.groupMasuk.style.display = 'none';
        refs.selectMasuk.disabled = true;
        refs.groupKeluar.style.display = 'block';
        refs.inputKeluar.disabled = false;
        refs.submitButton.style.backgroundColor = '#ef4444';
        return;
    }

    refs.labelNama.textContent = 'Nama Siswa';
    refs.formJudul.textContent = refs.formAction.value === 'edit' ? 'Edit Pemasukan' : 'Setor Uang Kas';
    refs.groupMasuk.style.display = 'block';
    refs.selectMasuk.disabled = false;
    refs.groupKeluar.style.display = 'none';
    refs.inputKeluar.disabled = true;
    refs.submitButton.style.backgroundColor = '';
    setSelectOptions('');
}

function siapkanFormTambah(tipe) {
    refs.form.reset();
    refs.formAction.value = 'insert';
    refs.formRow.value = '';
    refs.inputTanggal.value = todayIso();
    refs.inputNominal.value = toNumber(state.meta.nominalPerMinggu) || DEFAULT_WEEKLY_FEE;
    setSelectOptions('');
    aturFormUI(tipe);
    refs.submitButton.textContent = 'Simpan Data';
    bukaTab('form');
}

function editData(record, tipe) {
    refs.form.reset();
    refs.formAction.value = 'edit';
    refs.formRow.value = record.row;
    refs.submitButton.textContent = 'Update Data';
    aturFormUI(tipe);

    refs.inputTanggal.value = normalizeDateForInput(record.tanggal);
    refs.inputNama.value = record.nama || '';
    refs.inputNominal.value = toNumber(record.nominal);

    if (tipe === 'pengeluaran') {
        refs.inputKeluar.value = record.keterangan || '';
    } else {
        setSelectOptions(record.keterangan || '');
    }

    bukaTab('form');
}

function hapusData(row, tipe) {
    const password = window.prompt('Masukkan password admin untuk menghapus data:');
    if (!password) {
        return;
    }

    const formData = new FormData();
    formData.append('action', 'delete');
    formData.append('row', row);
    formData.append('tipe', tipe);
    formData.append('password', password);

    fetch(scriptURL, {
        method: 'POST',
        body: formData
    })
        .then((response) => response.json())
        .then((payload) => {
            if (payload.status === 'sukses') {
                window.alert(payload.pesan);
                muatData({ force: true, silent: true });
                return;
            }
            window.alert(payload.pesan || 'Gagal menghapus data.');
        })
        .catch((error) => {
            console.error(error);
            window.alert('Terjadi kesalahan jaringan.');
        });
}

function handleTableAction(event) {
    const button = event.target.closest('button[data-aksi]');
    if (!button) {
        return;
    }

    const row = Number(button.dataset.row);
    const tipe = button.dataset.tipe;
    const source = tipe === 'pengeluaran' ? state.lookup.pengeluaran : state.lookup.pemasukan;
    const record = source[row];

    if (!record) {
        return;
    }

    if (button.dataset.aksi === 'edit') {
        editData(record, tipe);
        return;
    }

    if (button.dataset.aksi === 'delete') {
        hapusData(row, tipe);
    }
}

refs.riwayatBody.addEventListener('click', handleTableAction);
refs.pengeluaranBody.addEventListener('click', handleTableAction);

refs.form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearNotif();

    const originalText = refs.submitButton.textContent;
    refs.submitButton.disabled = true;
    refs.submitButton.textContent = 'Memproses...';

    fetch(scriptURL, {
        method: 'POST',
        body: new FormData(refs.form)
    })
        .then((response) => response.json())
        .then((payload) => {
            refs.submitButton.disabled = false;
            refs.submitButton.textContent = originalText;

            if (payload.status === 'sukses') {
                setNotif('sukses', payload.pesan || 'Berhasil menyimpan data.');
                const tujuanTab = refs.formTipe.value === 'pengeluaran' ? 'pengeluaran' : 'riwayat';
                muatData({ force: true, silent: true });
                setTimeout(() => {
                    clearNotif();
                    bukaTab(tujuanTab);
                }, 1200);
                return;
            }

            setNotif('gagal', payload.pesan || 'Gagal menyimpan data.');
        })
        .catch((error) => {
            console.error(error);
            refs.submitButton.disabled = false;
            refs.submitButton.textContent = originalText;
            setNotif('gagal', 'Terjadi kesalahan sistem.');
        });
});

window.bukaTab = bukaTab;
window.siapkanFormTambah = siapkanFormTambah;

muatData({ force: true, showLoader: true });
