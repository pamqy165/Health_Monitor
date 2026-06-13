// Đăng nhập
async function handleLogin() {
  const email    = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    showError('Vui lòng nhập đầy đủ email và mật khẩu');
    return;
  }

  // Xóa cache cũ trước khi đăng nhập
  sessionStorage.removeItem('userData');
  
  const btn = document.getElementById('btnLogin');
  btn.disabled     = true;
  btn.textContent  = 'Đang đăng nhập...';

  try {
    await window.loginUser(email, password);
    window.location.href = '../html/overview.html';
  } catch (err) {
    const msg = {
      'auth/user-not-found':   'Email không tồn tại',
      'auth/wrong-password':   'Mật khẩu không đúng',
      'auth/invalid-email':    'Email không hợp lệ',
      'auth/too-many-requests':'Thử lại sau, quá nhiều lần đăng nhập thất bại'
    }[err.code] || 'Đăng nhập thất bại';

    showError(msg);
    btn.disabled    = false;
    btn.textContent = 'Đăng nhập';
  }
}

async function handleForgotPassword() {
  const email = document.getElementById('username').value.trim();

  if (!email) {
    showError('Vui lòng nhập email trước khi đặt lại mật khẩu');
    return;
  }

  const btn = document.getElementById('btnLogin');
  btn.disabled    = true;
  btn.textContent = 'Đang gửi...';

  try {
    await window.auth.sendPasswordResetEmail(email);
    showSuccess(`Đã gửi email đặt lại mật khẩu đến ${email}. Vui lòng kiểm tra hòm thư.`);
  } catch (err) {
    const msg = {
      'auth/user-not-found': 'Email này chưa được đăng ký',
      'auth/invalid-email':  'Email không hợp lệ',
    }[err.code] || 'Gửi email thất bại, thử lại sau';
    showError(msg);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Đăng nhập';
  }
}

function showError(msg) {
  const el = document.getElementById('loginError');
  if (el) {
    el.textContent      = msg;
    el.style.display    = 'block';
    el.style.color      = '#EF4444';
    el.style.background = '#FEF2F2';
    el.style.border     = '1px solid #FECACA';
  }
}

function showSuccess(msg) {
  const el = document.getElementById('loginError');
  if (el) {
    el.textContent      = msg;
    el.style.display    = 'block';
    el.style.color      = '#10B981';
    el.style.background = '#F0FDF4';
    el.style.border     = '1px solid #BBF7D0';
  }
}

// Nếu đã đăng nhập rồi → vào thẳng overview
document.addEventListener('firebaseReady', function() {
  window.auth.onAuthStateChanged(function(user) {
    if (user) window.location.href = '../html/overview.html';
  });
});

// Nhấn Enter để đăng nhập
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') handleLogin();
});