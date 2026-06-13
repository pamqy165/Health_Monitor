// Điền sidebar NGAY khi DOM sẵn sàng
(function() {
  const cached = sessionStorage.getItem('userData');
  if (!cached) return;
  
  const data = JSON.parse(cached);

  function tryFill() {
    const avatar  = document.querySelector('.user-avatar');
    const nameEl  = document.querySelector('.user-info span');
    const emailEl = document.querySelector('.user-info small');

    if (!avatar || !nameEl || !emailEl) {
      // DOM chưa sẵn sàng, thử lại
      requestAnimationFrame(tryFill);
      return;
    }

    const parts = data.displayName.trim().split(' ');
    const abbr  = parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();

    avatar.textContent  = abbr;
    nameEl.textContent  = data.displayName;
    emailEl.textContent = data.email;
  }

  tryFill();
})();

/* ===== TOAST ===== */
function showToast(msg, type = 'success') {
  const t  = document.getElementById('toast');
  const tm = document.getElementById('toast-msg');
  if (!t) return;
  t.className = `toast ${type}`;
  if (tm) tm.textContent = msg;
  else t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ===== THỜI GIAN ===== */
function nowString() {
  return new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

/* ===== INITIALS từ tên đầy đủ ===== */
function initials(name) {
  const p = name.trim().split(' ');
  return p.length === 1
    ? p[0][0].toUpperCase()
    : (p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase();
}

/* ===== PHÂN LOẠI MÀU CHỈ SỐ ===== */
// Trả về: 'normal' | 'warn' | 'danger'
function vClass(type, v) {
  if (v == null || v === '--') return 'normal';
  if (type === 'bpm')  return v > 120 || v < 50 ? 'danger' : v > 100 || v < 60 ? 'warn' : 'normal';
  if (type === 'spo2') return v < 92  ? 'danger' : v < 96  ? 'warn' : 'normal';
  if (type === 'temp') return v >= 39 || v < 35  ? 'danger' : v >= 37.5 ? 'warn' : 'normal';
  return 'normal';
}

/* ===== TRẠNG THÁI TỔNG THỂ ===== */
// Trả về: 'normal' | 'warning' | 'danger'
function overallStatus(bpm, spo2, temp) {
  const classes = [vClass('bpm', bpm), vClass('spo2', spo2), vClass('temp', temp)];
  if (classes.includes('danger')) return 'danger';
  if (classes.includes('warn'))   return 'warning';
  return 'normal';
}

/* ===== NHÃN TRẠNG THÁI ===== */
const STATUS_LABEL = {
  normal:  'Bình thường',
  warning: 'Cần theo dõi',
  danger:  'Nguy hiểm',
  offline: 'Offline'
};

/* ===== ĐĂNG XUẤT ===== */
document.addEventListener('DOMContentLoaded', () => {

  // Nút đăng xuất
  const logoutBtn = document.querySelector('.btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      sessionStorage.removeItem('userData'); // Xóa cache khi logout
      try {
        await window.auth.signOut();
      } catch(e) {}
      window.location.href = '../html/login.html';
    });
  }

});

// Cập nhật sidebar 
window.auth.onAuthStateChanged(function(user) {
  if (!user) return;

  function updateSidebarUI(displayName, email) {
    const parts = displayName.trim().split(' ');
    const abbr  = parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();

    const avatar  = document.querySelector('.user-avatar');
    const nameEl  = document.querySelector('.user-info span');
    const emailEl = document.querySelector('.user-info small');

    if (avatar)  avatar.textContent  = abbr;
    if (nameEl)  nameEl.textContent  = displayName;
    if (emailEl) emailEl.textContent = email;
  }

  // ── Bước 1: Điền ngay từ sessionStorage nếu có ──
  const cached = sessionStorage.getItem('userData');
  if (cached) {
    updateSidebarUI(...Object.values(JSON.parse(cached)));
    return; // Không cần gọi Firebase nữa
  }

  // ── Bước 2: Lần đầu chưa có cache → gọi Firebase rồi lưu lại ──
  window.getUserData(user.uid).then(function(userData) {
    const displayName = userData?.displayName || user.email;
    const email       = user.email;
    sessionStorage.setItem('userData', JSON.stringify({ displayName, email }));
    updateSidebarUI(displayName, email);
  });
});