/* ===== STATE ===== */
let selectedPatientId   = null;
let selectedPatientName = null;
let currentData = { bpm: null, spo2: null, temp: null, time: '--:--:--' };

let saveHistory = [];

function initSaveHistory(patientIds) {
  if (window.onSaveHistory) {
    window.onSaveHistory(patientIds, function(list) {
      saveHistory = list;
      renderSavesTable();
    });
  } else {
    setTimeout(() => initSaveHistory(patientIds), 300);
  }
}

let patients = []; // sẽ được Firebase điền vào

// Lắng nghe danh sách BN — chỉ load BN của user hiện tại
function loadPatients(user) {
  window.getUserData(user.uid).then(function(userData) {
    const patientIds = userData?.patientIds || [];

    // Gọi initSaveHistory ở đây để có patientIds
    initSaveHistory(patientIds);

    window.db.ref('patients').on('value', function(snap) {
      const raw = snap.val() || {};
      patients = Object.entries(raw)
        .filter(([id]) => patientIds.includes(id))
        .map(([id, val]) => {
          const p = val.profile || {};
          return {
            id,
            name:     p.name     || id,
            age:      p.age      || '--',
            gender:   p.gender   || 'Nam',
            relation: p.relation || 'Khác'
          };
        });
      renderPselect();
    });
  });
}

/* ===== RENDER PATIENT SELECTOR ===== */
function renderPselect() {
  const grid = document.getElementById('pselectGrid');
  grid.innerHTML = patients.map(p => {
    const female   = p.gender === 'Nữ';
    const isActive = p.id === selectedPatientId;
    return `
      <div class="pselect-item ${isActive ? 'selected' : ''}" onclick="selectPatient('${p.id}')">
        <div class="pselect-avatar ${female ? 'female' : ''}">
          ${initials(p.name)}
          ${isActive ? `<span class="sel-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg></span>` : ''}
        </div>
        <div class="pselect-name">${p.name.split(' ').slice(-1)[0]}</div>
        <div class="pselect-rel">${p.relation}</div>
      </div>`;
  }).join('');
}

function selectPatient(id) {
  selectedPatientId = id;
  const p = patients.find(x => x.id === id);
  selectedPatientName = p.name;
  renderPselect();

  const preview = document.getElementById('selectedPreview');
  preview.classList.add('visible');
  const av = document.getElementById('sp-avatar');
  av.textContent = initials(p.name);
  av.style.background = p.gender === 'Nữ'
    ? 'linear-gradient(135deg,#EC4899,#F472B6)'
    : 'linear-gradient(135deg,var(--primary),var(--accent))';

  document.getElementById('sp-name').textContent = p.name;
  document.getElementById('sp-sub').textContent  = `${p.age} tuổi · ${p.gender} · ${p.relation} · ${id}`;
  document.getElementById('sp-id').textContent   = id;

  updateSaveBtn();
}

/* ===== UPDATE LIVE UI ===== */
function updateLiveUI(bpm, spo2, temp, time) {
  currentData = { bpm, spo2, temp, time };

  document.getElementById('live-bpm').textContent  = bpm  ?? '--';
  document.getElementById('live-spo2').textContent = spo2 ?? '--';
  document.getElementById('live-temp').textContent = temp ?? '--';

  // Color classes
  const bEl = document.getElementById('live-bpm');
  const sEl = document.getElementById('live-spo2');
  const tEl = document.getElementById('live-temp');

  const setColor = (el, cls) => {
    el.className = 'lv-val' + (cls === 'warn' ? ' warn' : cls === 'danger' ? ' danger' : '');
  };

  setColor(bEl, vClass('bpm',  bpm));
  setColor(sEl, vClass('spo2', spo2));
  setColor(tEl, vClass('temp', temp));

  document.getElementById('live-time').textContent = time || nowString();

  const st   = overallStatus(bpm, spo2, temp);
  const stEl = document.getElementById('live-status-text');
  const stMap = {
    normal:  { color:'var(--green)',  icon:'✓', text:'Tất cả chỉ số trong ngưỡng bình thường' },
    warning: { color:'var(--yellow)', icon:'⚠', text:'Một số chỉ số cần theo dõi' },
    danger:  { color:'var(--red)',    icon:'✕', text:'Phát hiện chỉ số nguy hiểm — cần xử lý ngay' }
  };
  const info = stMap[st];
  stEl.style.color = info.color;
  stEl.innerHTML   = `<span>${info.icon}</span> ${info.text}`;

  updateSaveBtn();
}

/* ===== SAVE BUTTON STATE ===== */
function updateSaveBtn() {
  const hasPatient = !!selectedPatientId;
  const hasData    = currentData.bpm != null && currentData.spo2 != null && currentData.temp != null;
  document.getElementById('btnSave').disabled = !(hasPatient && hasData);

  const hint = document.querySelector('.save-hint');
  if (hasPatient && hasData) {
    hint.innerHTML   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      Sẵn sàng lưu cho <strong>${selectedPatientName}</strong>`;
    hint.style.color = 'var(--green)';
  } else {
    hint.innerHTML   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
      ${!hasPatient ? 'Chọn bệnh nhân và có dữ liệu đo để lưu' : 'Đang chờ dữ liệu từ thiết bị...'}`;
    hint.style.color = 'var(--text-light)';
  }
}

/* ===== SAVE RESULT ===== */
function saveResult() {
  if (!selectedPatientId || currentData.bpm == null) return;

  const record = {
    patientId:   selectedPatientId,
    patientName: selectedPatientName,
    bpm:         currentData.bpm,
    spo2:        currentData.spo2,
    temp:        currentData.temp,
    note:        document.getElementById('saveNote').value.trim(),
    timestamp:   new Date().toISOString(),
    timeDisplay: nowString(),
    status:      overallStatus(currentData.bpm, currentData.spo2, currentData.temp)
  };

  // Lưu lên Firebase + trigger AI
  window.saveHealthData(
    selectedPatientId,
    record.bpm,
    record.spo2,
    record.temp,
    currentData.time,
    record.note
  ).catch(err => console.error('[Save] Lưu Firebase thất bại:', err));

  // Lưu save_history — listener onSaveHistory tự cập nhật bảng
  window.addSaveHistory(record)
    .catch(err => console.error('[SaveHistory] Lưu thất bại:', err));

  document.getElementById('saveNote').value = '';
  showToast(`✅ Đã lưu kết quả cho ${selectedPatientName}`);
}

/* ===== RENDER SAVES TABLE ===== */
function renderSavesTable() {
  const tbody = document.getElementById('savesTableBody');
  if (!saveHistory.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-table">Chưa có kết quả nào được lưu trong phiên này</td></tr>`;
    return;
  }

  tbody.innerHTML = saveHistory.map(r => {
    const p      = patients.find(x => x.id === r.patientId);
    const female = p?.gender === 'Nữ';
    const bClass = vClass('bpm',  r.bpm);
    const sClass = vClass('spo2', r.spo2);
    const tClass = vClass('temp', r.temp);

    return `
      <tr>
        <td>
          <div class="td-patient">
            <div class="td-avatar" style="${female ? 'background:linear-gradient(135deg,#EC4899,#F472B6)' : ''}">${initials(r.patientName)}</div>
            <div>
              <div class="td-name">${r.patientName}</div>
              <div class="td-sub">${r.patientId}</div>
            </div>
          </div>
        </td>
        <td><span class="vital-chip ${bClass}">${r.bpm} BPM</span></td>
        <td><span class="vital-chip ${sClass}">${r.spo2}%</span></td>
        <td><span class="vital-chip ${tClass}">${r.temp}°C</span></td>
        <td>
          <div class="status-dot-row ${r.status}">
            <span class="dot"></span>${STATUS_LABEL[r.status] || 'Bình thường'}
          </div>
        </td>
        <td style="color:var(--text-light);font-size:12px;">${r.timeDisplay}</td>
        <td>
          <button class="btn-row-view" onclick="viewPatient('${r.patientId}','${r.patientName}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            Xem
          </button>
        </td>
      </tr>`;
  }).join('');
}

function viewPatient(id, name) {
  window.location.href = `dashboard.html?id=${id}`;
}

/* ===== UPDATE AI UI ===== */
function updateAiUI(advice, riskScore, timestamp) {
  console.log('[AI]', advice, riskScore, timestamp);
}
/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  // Bảo vệ trang — chưa login → về login.html
  window.requireAuth(function(user) {
    loadPatients(user);
  });

  renderPselect();
  renderSavesTable();
  updateSaveBtn();

  // Lắng nghe MQTT — nhận live data từ ESP32
  window.onMqttData(function(parsed) {
    updateLiveUI(parsed.heart_rate, parsed.spo2, parsed.temperature, parsed.time);
  });

  // Lắng nghe AI alerts (hiển thị nhận xét mới nhất, không phân biệt bệnh nhân)
  window.db.ref('trigger_analysis').on('value', function(snap) {
    const trigger = snap.val();
    if (!trigger || !trigger.patient_id) return;
    window.onAlerts(trigger.patient_id, function(alert) {
      updateAiUI(alert.advice, alert.risk_score, alert.timestamp_ai);
    });
  });
});