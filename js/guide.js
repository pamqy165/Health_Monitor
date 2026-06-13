/* ============================================================
   guide.js — Logic riêng cho trang guide.html
   ============================================================ */

/* ── ACCORDION ── */
function toggle(header) {
  const body    = header.nextElementSibling;
  const chevron = header.querySelector('.gs-chevron');
  const isOpen  = body.classList.contains('open');

  // Đóng tất cả trước
  document.querySelectorAll('.gs-body').forEach(b => b.classList.remove('open'));
  document.querySelectorAll('.gs-header').forEach(h => h.classList.remove('open'));
  document.querySelectorAll('.gs-chevron').forEach(c => c.classList.remove('open'));

  // Nếu chưa mở thì mở
  if (!isOpen) {
    body.classList.add('open');
    header.classList.add('open');
    chevron.classList.add('open');
  }
}

/* ── FAQ TOGGLE ── */
function toggleFaq(el) {
  const ans = el.nextElementSibling;
  ans.classList.toggle('open');
}

/* ── SMOOTH SCROLL + AUTO OPEN khi nhấn mục lục ── */
function initTocScroll() {
  document.querySelectorAll('.toc-item').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;

      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Tự mở accordion của mục tương ứng
      const header = target.querySelector('.gs-header');
      if (header) {
        const body    = header.nextElementSibling;
        const chevron = header.querySelector('.gs-chevron');
        if (!body.classList.contains('open')) {
          document.querySelectorAll('.gs-body').forEach(b => b.classList.remove('open'));
          document.querySelectorAll('.gs-header').forEach(h => h.classList.remove('open'));
          document.querySelectorAll('.gs-chevron').forEach(c => c.classList.remove('open'));
          body.classList.add('open');
          header.classList.add('open');
          chevron.classList.add('open');
        }
      }
    });
  });
}

/* ── TOAST ── */
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  // Bảo vệ trang — chưa login → về login.html
  window.requireAuth(function(user) {
    console.log('[Auth] User đang login:', user.email);
  });

  // Mở mục đầu tiên mặc định
  const first = document.querySelector('.gs-header');
  if (first) toggle(first);

  // Kích hoạt scroll từ mục lục
  initTocScroll();

  // Nút đăng xuất
  const logoutBtn = document.querySelector('.btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.location.href = '../html/login.html';
    });
  }
});
