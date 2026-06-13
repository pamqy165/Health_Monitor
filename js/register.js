/* ============================================================
   register.js — Đăng ký tài khoản mới bằng invite code
   ============================================================ */

function showMsg(msg, type) {
  const el = document.getElementById('registerMsg');
  el.textContent   = msg;
  el.className     = `alert-msg ${type}`;
  el.style.display = 'block';
}

async function handleRegister() {
  const displayName     = document.getElementById('displayName').value.trim();
  const email           = document.getElementById('email').value.trim();
  const password        = document.getElementById('password').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();
  const inviteCode      = document.getElementById('inviteCode').value.trim().toUpperCase();

  // Validate
  if (!displayName || !email || !password || !confirmPassword || !inviteCode) {
    showMsg('Vui lòng điền đầy đủ thông tin', 'error'); return;
  }
  if (password.length < 6) {
    showMsg('Mật khẩu tối thiểu 6 ký tự', 'error'); return;
  }
  if (password !== confirmPassword) {
    showMsg('Mật khẩu nhập lại không khớp', 'error'); return;
  }

  const btn = document.getElementById('btnRegister');
  btn.disabled    = true;
  btn.textContent = 'Đang xử lý...';

  try {
    await window.registerUser(email, password, displayName, inviteCode);
    showMsg('Đăng ký thành công! Đang chuyển về trang đăng nhập...', 'success');
    setTimeout(() => {
      window.location.href = '../html/login.html';
    }, 2000);

  } catch (err) {
    const msg = {
      'auth/email-already-in-use': 'Email này đã được đăng ký',
      'auth/invalid-email':        'Email không hợp lệ',
      'auth/weak-password':        'Mật khẩu quá yếu'
    }[err.code] || err.message || 'Đăng ký thất bại';

    showMsg(msg, 'error');
    btn.disabled    = false;
    btn.textContent = 'Đăng ký';
  }
}

// Nhấn Enter để đăng ký
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleRegister();
});

// Nếu đã đăng nhập → vào thẳng overview
document.addEventListener('firebaseReady', function() {
  window.auth.onAuthStateChanged(function(user) {
    if (user) window.location.href = '../html/overview.html';
  });
});