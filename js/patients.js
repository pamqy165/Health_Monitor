let patientData = [];

/* ===== RENDER PATIENT CARD ===== */
function cardHTML(p) {
  const female = p.gender === 'Nữ';
  const bpm  = p.bpm  !== '--' ? p.bpm       : '--';
  const spo2 = p.spo2 !== '--' ? p.spo2 + '%': '--';
  const temp = p.temp !== '--' ? p.temp + '°': '--';

  return `
  <div class="pcard" data-status="${p.status}" data-name="${p.name.toLowerCase()}"
       onclick="goToPatient('${p.id}','${p.name}')">
    <div class="pcard-strip ${p.status}"></div>
    <div class="pcard-body">
      <div class="pcard-head">
        <div class="pcard-avatar ${female ? 'female' : ''}">
          ${initials(p.name)}
          ${p.hasAlert ? '<span class="alert-badge"></span>' : ''}
        </div>
        <div class="pcard-meta">
          <div class="pcard-name">${p.name}</div>
          <div class="pcard-sub">${p.age} tuổi · ${p.gender} · ${p.relation}</div>
        </div>
        <div class="pcard-status ${p.status}">
          <span class="sdot"></span>${STATUS_LABEL[p.status]}
        </div>
      </div>

      <div class="pcard-vitals">
        <div class="vital-mini">
          <div class="vm-val ${vClass('bpm',  p.bpm)  === 'warn' ? 'warn' : vClass('bpm',  p.bpm)  === 'danger' ? 'danger' : ''}">${bpm}</div>
          <div class="vm-lbl">BPM</div>
        </div>
        <div class="vital-mini">
          <div class="vm-val ${vClass('spo2', p.spo2) === 'warn' ? 'warn' : vClass('spo2', p.spo2) === 'danger' ? 'danger' : ''}">${spo2}</div>
          <div class="vm-lbl">SpO₂</div>
        </div>
        <div class="vital-mini">
          <div class="vm-val ${vClass('temp', p.temp) === 'warn' ? 'warn' : vClass('temp', p.temp) === 'danger' ? 'danger' : ''}">${temp}</div>
          <div class="vm-lbl">Nhiệt độ</div>
        </div>
      </div>

      ${p.note ? `<div class="pcard-note">📋 ${p.note}</div>` : ''}

      <div class="pcard-footer">
        <span class="pcard-time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          ${p.lastUpdate}
        </span>
        <button class="btn-view" onclick="event.stopPropagation(); goToPatient('${p.id}','${p.name}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Xem chi tiết
        </button>
      </div>
    </div>
  </div>`;
}

/* ===== RENDER GRID ===== */
function renderGrid(list) {
  const grid = document.getElementById('patientGrid');
  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <p>Không tìm thấy bệnh nhân phù hợp</p>
      </div>`;
    return;
  }
  grid.innerHTML = list.map(cardHTML).join('');
}

/* ===== FILTER / SEARCH ===== */
function filterPatients() {
  const q      = document.getElementById('searchInput').value.toLowerCase().trim();
  const status = document.getElementById('filterStatus').value;
  const result = patientData.filter(p => {
    const matchText   = p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    const matchStatus = status === 'all' || p.status === status;
    return matchText && matchStatus;
  });
  renderGrid(result);
}

/* ===== MODAL ===== */
function openModal()  { document.getElementById('modalBackdrop').classList.add('open'); }
function closeModal() { document.getElementById('modalBackdrop').classList.remove('open'); }

function handleBackdropClick(e) {
  if (e.target === document.getElementById('modalBackdrop')) closeModal();
}

function addPatient() {
  const name     = document.getElementById('newName').value.trim();
  const age      = parseInt(document.getElementById('newAge').value);
  const gender   = document.getElementById('newGender').value;
  const rawId    = document.getElementById('newId').value.trim();
  const relation = document.getElementById('newRelation').value;
  const note     = document.getElementById('newNote').value.trim();

  if (!name)              { alert('Vui lòng nhập họ và tên.'); return; }
  if (isNaN(age) || age < 1) { alert('Vui lòng nhập tuổi hợp lệ.'); return; }

  const id = rawId || ('BN' + String(patientData.length + 1).padStart(3, '0'));

  // Lưu profile lên Firebase — Firebase listener sẽ tự cập nhật lại grid
  window.savePatientProfile(id, { name, age, gender, relation, note })
    .then(async () => {
      // Gắn BN vào tài khoản user hiện tại
      const user = window.auth.currentUser;
      if (user) await window.addPatientToUser(user.uid, id);
      showToast(`✅ Đã thêm bệnh nhân: ${name}`);
    })
    .catch(err => {
      console.error('[Patients] Lưu Firebase thất bại:', err);
      showToast('❌ Lưu thất bại, kiểm tra kết nối', 'error');
    });

  closeModal();
}

/* ===== NAVIGATE ===== */
function goToPatient(patientId, patientName) {
  window.location.href = `dashboard.html?id=${patientId}`;
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {

  // Bảo vệ trang — chưa login → về login.html
  window.requireAuth(function(user) {

    // Lấy patientIds của user hiện tại
    window.getUserData(user.uid).then(function(userData) {
      const patientIds = userData?.patientIds || [];

      // Lắng nghe realtime nhưng chỉ lấy BN trong patientIds
      window.db.ref('patients').on('value', function(snap) {
        const raw = snap.val() || {};

        patientData = Object.entries(raw)
          .filter(([id]) => patientIds.includes(id)) // ← chỉ lấy BN của user
          .map(([id, val]) => {
            const profile    = val.profile    || {};
            const healthData = val.healthData || {};
            const alerts     = val.alerts     || {};

            const hdList = Object.values(healthData);
            const latest = hdList.length
              ? hdList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
              : null;

            const alList = Object.values(alerts);
            const latestAlert = alList.length
              ? alList.sort((a, b) => new Date(b.timestamp_ai) - new Date(a.timestamp_ai))[0]
              : null;

            const computedStatus = latest
              ? overallStatus(latest.heart_rate, latest.spo2, latest.temperature)
              : 'offline';

            return {
              id,
              name:       profile.name     || id,
              age:        profile.age      || '--',
              gender:     profile.gender   || 'Nam',
              relation:   profile.relation || 'Khác',
              note:       profile.note     || '',
              status:     latestAlert
                            ? (latestAlert.status_code === 2 ? 'danger'
                              : latestAlert.status_code === 1 ? 'warning' : 'normal')
                            : computedStatus,
              bpm:        latest ? latest.heart_rate  : '--',
              spo2:       latest ? latest.spo2        : '--',
              temp:       latest ? latest.temperature : '--',
              lastUpdate: latest ? new Date(latest.timestamp).toLocaleString('vi-VN') : 'Chưa có dữ liệu',
              hasAlert:   latestAlert ? latestAlert.status_code >= 1 : false
            };
          });

        renderGrid(patientData);
      });
    });
  });
});
