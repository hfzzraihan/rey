/* ============================================================
   NASTAR LOGISTICS APP — app.js
   Semua logika: navigasi, validasi, kalkulasi, WhatsApp, QR
   ============================================================ */

/* ══════════════════════════════════════
   STATE — data global aplikasi
══════════════════════════════════════ */
var STATE = {
  screen:      's-login',   // layar yang sedang aktif
  user:        '',          // nama pengguna login
  balance:     150000,      // saldo saat ini (angka)
  selPay:      '',          // metode pembayaran dipilih
  selPayIcon:  '',          // ikon metode pembayaran
  tuAmt:       0,           // nominal top up
  qrTmr:       null,        // interval timer QRIS
  qrSec:       899          // sisa detik QR (14m 59s)
};

/* ══════════════════════════════════════
   NAVIGASI
══════════════════════════════════════ */

/**
 * Pindah ke layar berdasarkan ID elemen
 * @param {string} id - ID elemen layar tujuan
 */
function goTo(id) {
  var cur = document.getElementById(STATE.screen);
  var nxt = document.getElementById(id);
  if (!nxt || STATE.screen === id) return;

  cur.classList.remove('active');
  cur.style.display = 'none';

  nxt.style.display = 'flex';
  nxt.classList.add('active');

  STATE.screen = id;
  window.scrollTo(0, 0);
}

/**
 * Navigasi lewat bottom nav tab
 * @param {string} tab - 'dash' | 'pickup' | 'tracking' | 'topup'
 */
function navTo(tab) {
  var tabMap = {
    dash:     's-dash',
    pickup:   's-pickup',
    tracking: 's-tracking',
    topup:    's-topup'
  };
  var id = tabMap[tab];
  if (!id) return;
  goTo(id);

  // Update active state semua bottom nav di semua layar
  var allScreens = ['s-dash', 's-pickup', 's-tracking', 's-topup'];
  var idxMap = { dash: 0, pickup: 1, tracking: 2, topup: 3 };
  allScreens.forEach(function(sc) {
    var navs = document.querySelectorAll('#' + sc + ' .nav-item');
    navs.forEach(function(n, i) {
      n.classList.toggle('active', i === idxMap[tab]);
    });
  });
}

/* ══════════════════════════════════════
   NOTIFICATION BOTTOM SHEET
══════════════════════════════════════ */

/**
 * Tampilkan notifikasi bottom sheet
 * @param {string} ico   - emoji ikon
 * @param {string} h     - judul
 * @param {string} msg   - pesan
 * @param {string} btn   - teks tombol (default: 'OK')
 * @param {Function} cb  - callback setelah tombol ditekan
 */
function showNotif(ico, h, msg, btn, cb) {
  document.getElementById('n-ico').textContent = ico;
  document.getElementById('n-h').textContent   = h;
  document.getElementById('n-msg').textContent  = msg;
  document.getElementById('n-btn').textContent  = btn || 'OK';
  window._notifCb = cb || null;
  document.getElementById('notif').classList.add('show');
}

/**
 * Tutup notifikasi (dipanggil dari overlay click atau tombol OK)
 * @param {Event} e - event klik (opsional)
 */
function closeNotif(e) {
  // Hanya tutup jika klik langsung pada overlay (bukan sheet)
  if (e && e.target !== document.getElementById('notif')) return;
  _dismissNotif();
}

function _dismissNotif() {
  document.getElementById('notif').classList.remove('show');
  if (window._notifCb) {
    window._notifCb();
    window._notifCb = null;
  }
}

// Tombol OK di dalam sheet
document.getElementById('n-btn').addEventListener('click', function() {
  _dismissNotif();
});

/* ══════════════════════════════════════
   AUTENTIKASI
══════════════════════════════════════ */

/** Login */
function doLogin() {
  var phone = document.getElementById('l-phone').value.trim();
  var pin   = document.getElementById('l-pin').value.trim();

  if (!phone || !pin) {
    showNotif('⚠️', 'Lengkapi Data', 'Nomor HP dan PIN wajib diisi.');
    return;
  }
  if (pin.length < 4) {
    showNotif('⚠️', 'PIN Terlalu Pendek', 'PIN minimal 4 digit angka.');
    return;
  }

  STATE.user = 'Pengguna';
  _updateDashboard();
  goTo('s-dash');
}

/** Daftar akun baru */
function doSignup() {
  var name  = document.getElementById('su-name').value.trim();
  var phone = document.getElementById('su-phone').value.trim();
  var pin   = document.getElementById('su-pin').value.trim();
  var pin2  = document.getElementById('su-pin2').value.trim();

  if (!name || !phone || !pin || !pin2) {
    showNotif('⚠️', 'Data Belum Lengkap', 'Semua field wajib diisi.');
    return;
  }
  if (pin.length < 6) {
    showNotif('⚠️', 'PIN Terlalu Pendek', 'PIN harus 6 digit angka.');
    return;
  }
  if (pin !== pin2) {
    showNotif('⚠️', 'PIN Tidak Cocok', 'PIN dan konfirmasi PIN harus sama.');
    return;
  }

  STATE.user = name.split(' ')[0];
  _updateDashboard();

  showNotif(
    '🎉',
    'Akun Berhasil Dibuat!',
    'Selamat datang di Nastar, ' + name + '!\nMulai kirim paket sekarang.',
    'Ayo Mulai!',
    function() { goTo('s-dash'); }
  );
}

/** Lupa PIN — langkah 1: verifikasi nomor HP */
function fpNext() {
  var phone = document.getElementById('fp-phone').value.trim();
  if (!phone) {
    showNotif('⚠️', 'Nomor Kosong', 'Masukkan nomor HP yang terdaftar.');
    return;
  }
  document.getElementById('fp-s1').style.display = 'none';
  document.getElementById('fp-s2').style.display = 'block';
  document.getElementById('fp-d1').classList.remove('on');
  document.getElementById('fp-d2').classList.add('on');
}

/** Lupa PIN — langkah 2: simpan PIN baru */
function fpSave() {
  var p1 = document.getElementById('fp-new').value.trim();
  var p2 = document.getElementById('fp-new2').value.trim();

  if (!p1 || !p2) {
    showNotif('⚠️', 'Data Kosong', 'Masukkan PIN baru dan konfirmasinya.');
    return;
  }
  if (p1 !== p2) {
    showNotif('⚠️', 'PIN Tidak Cocok', 'PIN baru dan konfirmasi harus sama.');
    return;
  }
  if (p1.length < 6) {
    showNotif('⚠️', 'PIN Terlalu Pendek', 'PIN minimal 6 digit.');
    return;
  }

  // Reset state formulir
  ['fp-phone', 'fp-new', 'fp-new2'].forEach(function(id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('fp-s1').style.display = 'block';
  document.getElementById('fp-s2').style.display = 'none';
  document.getElementById('fp-d1').classList.add('on');
  document.getElementById('fp-d2').classList.remove('on');

  showNotif(
    '🔑',
    'PIN Berhasil Direset!',
    'PIN baru Anda sudah aktif.\nSilakan login dengan PIN baru.',
    'Ke Halaman Login',
    function() { goTo('s-login'); }
  );
}

/** Logout */
function doLogout() {
  showNotif(
    '👋',
    'Sampai Jumpa!',
    'Anda telah keluar dari akun Nastar.\nTerima kasih telah menggunakan layanan kami!',
    'OK',
    function() { goTo('s-login'); }
  );
}

/** Update tampilan dashboard dengan data user */
function _updateDashboard() {
  document.getElementById('gr-name').textContent  = STATE.user;
  document.getElementById('bal-disp').textContent = 'Rp ' + STATE.balance.toLocaleString('id-ID');
}

/* ══════════════════════════════════════
   KIRIM PAKET — KALKULASI ONGKIR
══════════════════════════════════════ */

/**
 * Hitung otomatis ongkir berdasarkan berat x tarif region
 * Dipanggil dari oninput/onchange field berat & region
 */
function calcOngkir() {
  var weight = parseFloat(document.getElementById('pk-weight').value) || 0;
  var rate   = parseInt(document.getElementById('pk-region').value) || 0;
  var box    = document.getElementById('ongkir-box');

  if (weight > 0 && rate > 0) {
    var total = weight * rate;
    box.style.display = 'block';
    document.getElementById('pr-w').textContent = weight + ' kg';
    document.getElementById('pr-r').textContent = 'Rp ' + rate.toLocaleString('id-ID') + '/kg';
    document.getElementById('pr-t').textContent = 'Rp ' + total.toLocaleString('id-ID');
  } else {
    box.style.display = 'none';
  }
}

/**
 * Validasi & kirim order via WhatsApp
 * Tarif: Dalam Kota 7rb/kg | Luar Kota 15rb/kg | Luar Pulau 45rb/kg
 */
function doPickup() {
  var sender   = document.getElementById('pk-sender').value.trim();
  var from     = document.getElementById('pk-from').value.trim();
  var receiver = document.getElementById('pk-receiver').value.trim();
  var to       = document.getElementById('pk-to').value.trim();
  var recvPh   = document.getElementById('pk-recvphone').value.trim();
  var weight   = document.getElementById('pk-weight').value.trim();
  var regEl    = document.getElementById('pk-region');
  var regText  = regEl.options[regEl.selectedIndex] ? regEl.options[regEl.selectedIndex].text : '';
  var regRate  = parseInt(regEl.value) || 0;
  var type     = document.getElementById('pk-type').value;
  var note     = document.getElementById('pk-note').value.trim();

  // Validasi field wajib
  if (!sender || !from || !receiver || !to || !weight || !regRate) {
    showNotif('⚠️', 'Data Belum Lengkap', 'Harap isi semua field yang bertanda wajib (*).');
    return;
  }

  var total = (parseFloat(weight) * regRate).toLocaleString('id-ID');

  // Susun pesan WhatsApp
  var msg  = 'Halo Nastar! 🚚 Saya ingin melakukan pengiriman paket.\n\n';
  msg += '━━━━━━━━━━━━━━━━━\n';
  msg += '📦 *DETAIL PENGIRIMAN*\n';
  msg += '━━━━━━━━━━━━━━━━━\n';
  msg += '👤 Pengirim    : ' + sender + '\n';
  msg += '📍 Dari         : ' + from + '\n\n';
  msg += '👤 Penerima  : ' + receiver + '\n';
  msg += '📞 HP Penerima : ' + recvPh + '\n';
  msg += '🎯 Tujuan       : ' + to + '\n\n';
  msg += '📦 Jenis Paket  : ' + type + '\n';
  msg += '⚖️ Berat          : ' + weight + ' kg\n';
  msg += '🗺️ Pengiriman : ' + regText.split('(')[0].trim() + '\n';
  msg += '💰 Total Ongkir : Rp ' + total + '\n';
  if (note) msg += '📝 Catatan       : ' + note + '\n';
  msg += '\nMohon konfirmasi ketersediaan kurir. Terima kasih! 🙏';

  openWA(msg);
}

/* ══════════════════════════════════════
   LACAK PAKET
══════════════════════════════════════ */

/** Tampilkan hasil tracking berdasarkan nomor resi input */
function doTrack() {
  var resi = document.getElementById('tr-resi').value.trim();
  if (!resi) {
    showNotif('⚠️', 'Resi Kosong', 'Masukkan nomor resi terlebih dahulu.');
    return;
  }

  document.getElementById('tr-resi-show').textContent = resi.toUpperCase();

  var result = document.getElementById('tr-result');
  result.style.display = 'block';

  // Re-trigger animasi
  result.classList.remove('fade-in');
  void result.offsetWidth; // force reflow
  result.classList.add('fade-in');

  setTimeout(function() {
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/* ══════════════════════════════════════
   TOP UP — PILIH NOMINAL & METODE
══════════════════════════════════════ */

/**
 * Pilih nominal top up dari chip
 * @param {number} amt  - jumlah dalam rupiah
 * @param {Element} el  - elemen chip yang diklik
 */
function pickAmt(amt, el) {
  document.querySelectorAll('.amt-chip').forEach(function(c) {
    c.classList.remove('sel');
  });
  el.classList.add('sel');
  STATE.tuAmt = amt;
  document.getElementById('tu-amt').value = amt;
}

/**
 * Pilih metode pembayaran
 * @param {string}  name - nama metode (e.g. 'BCA', 'QRIS')
 * @param {string}  icon - emoji ikon
 * @param {Element} el   - elemen yang diklik
 */
function pickPay(name, icon, el) {
  document.querySelectorAll('.pay-opt').forEach(function(p) {
    p.classList.remove('sel');
  });
  el.classList.add('sel');
  STATE.selPay     = name;
  STATE.selPayIcon = icon;
}

/**
 * Proses konfirmasi top up:
 * - QRIS → tampilkan layar QR
 * - Lainnya → kirim pesan WhatsApp
 */
function doTopup() {
  var amt = parseInt(document.getElementById('tu-amt').value) || STATE.tuAmt;

  if (!amt || amt < 10000) {
    showNotif('⚠️', 'Nominal Tidak Valid', 'Minimal top up adalah Rp 10.000.');
    return;
  }
  if (!STATE.selPay) {
    showNotif('⚠️', 'Belum Pilih Metode', 'Pilih metode pembayaran terlebih dahulu.');
    return;
  }

  STATE.tuAmt = amt;

  if (STATE.selPay === 'QRIS') {
    document.getElementById('qr-amt').textContent = 'Rp ' + amt.toLocaleString('id-ID');
    startQR();
    goTo('s-qris');
  } else {
    var fmtAmt = 'Rp ' + amt.toLocaleString('id-ID');
    var msg = 'Halo Nastar, saya ingin Top Up saldo via ' + STATE.selPay +
              ' sebesar ' + fmtAmt + '.\n\n' +
              'Mohon kirimkan detail rekening/instruksi pembayaran. Terima kasih! 🙏';
    openWA(msg);
  }
}

/* ══════════════════════════════════════
   QRIS — COUNTDOWN TIMER
══════════════════════════════════════ */

/** Mulai/restart timer QR 15 menit */
function startQR() {
  stopQR();
  STATE.qrSec = 899; // 14 menit 59 detik
  _renderQRTimer();

  STATE.qrTmr = setInterval(function() {
    STATE.qrSec--;

    if (STATE.qrSec <= 0) {
      stopQR();
      document.getElementById('qr-cd').textContent = '00:00';
      document.getElementById('qr-cd').classList.add('expiring');
      return;
    }

    _renderQRTimer();

    // Warna merah + animasi pulse di 60 detik terakhir
    if (STATE.qrSec <= 60) {
      document.getElementById('qr-cd').classList.add('expiring');
    }
  }, 1000);
}

/** Hentikan timer QR */
function stopQR() {
  if (STATE.qrTmr) {
    clearInterval(STATE.qrTmr);
    STATE.qrTmr = null;
  }
}

/** Update tampilan countdown */
function _renderQRTimer() {
  var m = Math.floor(STATE.qrSec / 60).toString().padStart(2, '0');
  var s = (STATE.qrSec % 60).toString().padStart(2, '0');
  document.getElementById('qr-cd').textContent = m + ':' + s;
}

/** Simulasi simpan QR ke galeri */
function saveQR() {
  showNotif('💾', 'QR Berhasil Disimpan!', 'Kode QRIS telah disimpan ke galeri Anda.\nGunakan sebelum timer habis.');
}

/** Konfirmasi pembayaran QRIS via WhatsApp */
function confirmQRIS() {
  var amt = 'Rp ' + STATE.tuAmt.toLocaleString('id-ID');
  var msg = 'Halo Nastar, saya ingin Top Up saldo via QRIS sebesar ' + amt + '.\n\n' +
            'Saya sudah melakukan pembayaran. Mohon konfirmasi penambahan saldo. Terima kasih! 🙏';
  openWA(msg);
}

/* ══════════════════════════════════════
   WHATSAPP INTEGRATION
══════════════════════════════════════ */

/**
 * Buka WhatsApp dengan pesan terformat
 * Nomor CS Nastar: 08960426120
 * @param {string} msg - teks pesan
 */
function openWA(msg) {
  var url = 'https://wa.me/6289604261202?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}