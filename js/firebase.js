/* ============================================================
   firebase.js — Khởi tạo Firebase Realtime Database
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA3tjqAkoUT5S002yrvANkXZ1N0Xb5Nlv4",
  authDomain:        "health-monitoring-system-f81d8.firebaseapp.com",
  databaseURL:       "https://health-monitoring-system-f81d8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "health-monitoring-system-f81d8",
  storageBucket:     "health-monitoring-system-f81d8.firebasestorage.app",
  messagingSenderId: "584899209427",
  appId:             "1:584899209427:web:5d4f7647d652b68141cc26"
};

if (!firebase.apps || !firebase.apps.length) { 
  firebase.initializeApp(FIREBASE_CONFIG);
}

window.db = firebase.database();

/* ============================================================
   HELPER FUNCTIONS — dùng chung ở mọi trang
   ============================================================ */

/**
 * Lưu dữ liệu live (ghi đè) — live_data/
 * @param {number} heartRate
 * @param {number} spo2
 * @param {number} temperature
 * @param {string} time  — "HH:MM:SS"
 */
window.saveLiveData = function(heartRate, spo2, temperature, time) {
  return window.db.ref('live_data').set({
    heart_rate:  heartRate,
    spo2:        spo2,
    temperature: temperature,
    time:        time || new Date().toLocaleTimeString('vi-VN')
  });
};

/**
 * Lưu kết quả đo vào healthData của bệnh nhân (push — tạo record mới)
 * @param {string} patientId   — "BN001"
 * @param {number} heartRate
 * @param {number} spo2
 * @param {number} temperature
 * @param {string} time        — thời gian từ RTC
 * @param {string} note        — ghi chú bác sĩ (optional)
 * @returns {Promise<string>}  — trả về measurementId (autoKey)
 */
window.saveHealthData = async function(patientId, heartRate, spo2, temperature, time, note = '') {
  const ref = await window.db
    .ref('patients/' + patientId + '/healthData')
    .push({
      heart_rate:  heartRate,
      spo2:        spo2,
      temperature: temperature,
      time:        time || new Date().toLocaleTimeString('vi-VN'),
      timestamp:   new Date().toISOString(),
      note:        note
    });

  /* Kích hoạt AI phân tích */
  await window.db.ref('trigger_analysis').set({
    patient_id:     patientId,
    measurement_id: ref.key,
    requested_at:   new Date().toISOString(),
    status:         'pending'
  });

  return ref.key; /* trả về measurementId để dùng nếu cần */
};

/**
 * Lắng nghe dữ liệu live realtime
 * @param {function} callback — nhận object { heart_rate, spo2, temperature, time }
 * @returns {function} unsubscribe — gọi để ngừng lắng nghe
 */
window.onLiveData = function(callback) {
  const ref = window.db.ref('live_data');
  ref.on('value', snap => {
    const data = snap.val();
    if (data) callback(data);
  });
  return () => ref.off();
};

/**
 * Lắng nghe healthData của một bệnh nhân realtime
 * @param {string}   patientId
 * @param {function} callback — nhận array các record
 * @returns {function} unsubscribe
 */
window.onHealthData = function(patientId, callback) {
  const ref = window.db.ref('patients/' + patientId + '/healthData');
  ref.on('value', snap => {
    const raw  = snap.val() || {};
    const list = Object.entries(raw).map(([key, val]) => ({ _key: key, ...val }));
    callback(list);
  });
  return () => ref.off();
};

/**
 * Lắng nghe alerts (kết quả AI) của một bệnh nhân realtime
 * @param {string}   patientId
 * @param {function} callback — nhận object alert mới nhất
 * @returns {function} unsubscribe
 */
window.onAlerts = function(patientId, callback) {
  const ref = window.db.ref('patients/' + patientId + '/alerts');
  ref.on('value', snap => {
    const raw = snap.val();
    if (!raw) return;
    /* Lấy alert mới nhất theo key */
    const keys   = Object.keys(raw);
    const latest = raw[keys[keys.length - 1]];
    callback(latest);
  });
  return () => ref.off();
};

/**
 * Lấy profile bệnh nhân một lần
 * @param {string}   patientId
 * @param {function} callback — nhận object profile
 */
window.getPatientProfile = function(patientId, callback) {
  window.db.ref('patients/' + patientId + '/profile')
    .once('value', snap => callback(snap.val() || {}));
};

/**
 * Lưu profile bệnh nhân
 * @param {string} patientId
 * @param {object} profile — { name, age, gender, relation, phone, diagnosis, note }
 */
window.savePatientProfile = function(patientId, profile) {
  return window.db.ref('patients/' + patientId + '/profile').set(profile);
};
/**
 * Lưu 1 bản ghi vào save_history/
 */
window.addSaveHistory = function(record) {
  return window.db.ref('save_history').push(record);
};

/**
 * Lắng nghe save_history realtime
 * @param {function} callback — nhận array, mới nhất lên đầu
 */
window.onSaveHistory = function(patientIds, callback) {
  const ref = window.db.ref('save_history')
    .orderByChild('timestamp')
    .limitToLast(50);
  ref.on('value', snap => {
    const raw  = snap.val() || {};
    const list = Object.entries(raw)
      .map(([key, val]) => ({ _key: key, ...val }))
      .filter(r => patientIds.includes(r.patientId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
    callback(list);
  });
  return () => ref.off();
};

/* ============================================================
   FIREBASE AUTH — Helper functions
   ============================================================ */

window.auth = firebase.auth();

/**
 * Đăng ký tài khoản mới
 */
window.registerUser = async function(email, password, displayName, inviteCode) {

  // 1. Kiểm tra invite code
  const codesSnap = await window.db.ref('invite_codes')
    .orderByChild('code')
    .equalTo(inviteCode)
    .once('value');

  if (!codesSnap.exists()) {
    throw new Error('Mã mời không hợp lệ');
  }

  // Lấy key và data của code
  let codeKey  = null;
  let codeData = null;
  codesSnap.forEach(child => {
    codeKey  = child.key;
    codeData = child.val();
  });

  if (codeData.used) {
    throw new Error('Mã mời đã được sử dụng');
  }

  // 2. Tạo tài khoản Firebase Auth
  const userCred = await window.auth.createUserWithEmailAndPassword(email, password);
  const uid      = userCred.user.uid;

  // 3. Lưu thông tin user vào users/{uid}
  await window.db.ref('users/' + uid).set({
    email:       email,
    displayName: displayName,
    role:        'family',
    patientIds:  [],
    createdAt:   new Date().toISOString()
  });

  // 4. Đánh dấu code đã dùng
  await window.db.ref('invite_codes/' + codeKey).update({
    used:   true,
    usedBy: uid,
    usedAt: new Date().toISOString()
  });

  return userCred.user;
};

/**
 * Đăng nhập
 */
window.loginUser = async function(email, password) {
  const userCred = await window.auth.signInWithEmailAndPassword(email, password);
  return userCred.user;
};

/**
 * Đăng xuất
 */
window.logoutUser = async function() {
  await window.auth.signOut();
  window.location.href = '../html/login.html';
};

/**
 * Lấy thông tin user hiện tại từ Realtime Database
 */
window.getUserData = async function(uid) {
  const snap = await window.db.ref('users/' + uid).once('value');
  return snap.val();
};

/**
 * Thêm patientId vào danh sách của user
 */
window.addPatientToUser = async function(uid, patientId) {
  const userData = await window.getUserData(uid);
  const ids      = userData?.patientIds || [];

  if (!ids.includes(patientId)) {
    ids.push(patientId);
    await window.db.ref('users/' + uid + '/patientIds').set(ids);
  }
};

/**
 * Bảo vệ trang — chuyển về login nếu chưa đăng nhập
 */
window.requireAuth = function(callback) {
  window.auth.onAuthStateChanged(function(user) {
    if (!user) {
      window.location.href = '../html/login.html';
    } else {
      if (callback) callback(user);
    }
  });
};

console.log('[Firebase] Đã khởi tạo thành công — db:', window.db.app.options.projectId);
document.dispatchEvent(new CustomEvent('firebaseReady'));