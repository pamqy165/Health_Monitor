
/* ================================================================
   ĐỌC patientId TỪ URL — VD: dashboard.html?id=BN002
   ================================================================ */
const params    = new URLSearchParams(window.location.search);
const patientId = params.get('id') || 'BN001';

let patient = { id: patientId, name: 'Đang tải...', age: '--', gender: 'Nam', relation: 'Khác', note: '', status: 'normal' };

// Lắng nghe profile realtime từ Firebase
window.db.ref('patients/' + patientId + '/profile').on('value', function(snap) {
  const profile = snap.val();
  if (!profile || !profile.name) return;
  patient = { id: patientId, ...profile, status: 'normal' };
  renderHeader(patient);

  // Cập nhật lại form thông tin
  document.getElementById('edit-name').value      = profile.name      || '';
  document.getElementById('edit-age').value       = profile.age       || '';
  document.getElementById('edit-gender').value    = profile.gender    || 'Nam';
  document.getElementById('edit-relation').value  = profile.relation  || 'Khác';
  document.getElementById('edit-phone').value     = profile.phone     || '';
  document.getElementById('edit-diagnosis').value = profile.diagnosis || '';
  document.getElementById('edit-note-field').value= profile.note      || '';
  document.getElementById('edit-weight').value   = profile.weight   || '';
  document.getElementById('edit-height').value   = profile.height   || '';
  document.getElementById('edit-history').value  = profile.history  || '';
  document.getElementById('edit-medicine').value = profile.medicine || '';
  document.getElementById('edit-allergy').value  = profile.allergy  || '';
});

/* ================================================================
   RENDER HEADER
   ================================================================ */
function renderHeader(p) {
  document.title = `${p.name} — Dashboard`;
  document.getElementById('bc-name').textContent = p.name;

  const av = document.getElementById('ph-avatar');
  av.textContent = initials(p.name);
  if (p.gender === 'Nữ') av.classList.add('female');

  const svgId   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`;
  const svgClock= `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const svgUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const svgDoc  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

  document.getElementById('ph-name').textContent    = p.name;
  document.getElementById('ph-id').innerHTML        = `${svgId}${p.id}`;
  document.getElementById('ph-age').innerHTML       = `${svgClock}${p.age} tuổi`;
  document.getElementById('ph-gender').innerHTML    = `${svgUser}${p.gender} · ${p.relation}`;
  document.getElementById('ph-note').innerHTML      = `${svgDoc}${p.note || 'Chưa có ghi chú'}`;

  const stEl = document.getElementById('ph-status');
  stEl.className = `ph-status ${p.status === 'warning' ? 'warning' : p.status || 'normal'}`;
  document.getElementById('ph-status-text').textContent = STATUS_LABEL[p.status] || 'Bình thường';

  // Điền sẵn form thông tin
  document.getElementById('edit-name').value      = p.name;
  document.getElementById('edit-id').value        = p.id;
  document.getElementById('edit-age').value       = p.age;
  document.getElementById('edit-gender').value    = p.gender;
  document.getElementById('edit-relation').value  = p.relation;
  document.getElementById('edit-diagnosis').value = p.note || '';
}

/* ================================================================
   TAB SWITCHING
   ================================================================ */
function switchTab(btn, panelId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(panelId).classList.add('active');
  if (panelId === 'tab-analytics' && !analyticsInited) initAnalyticsCharts();
}

/* ================================================================
   UPDATE VITALS
   ================================================================ */
const STATUS_TEXT = {
  bpm:  { normal:'Bình thường', warn:'Nhịp tim cao',              danger:'Nguy hiểm' },
  spo2: { normal:'Tốt',         warn:'Cần theo dõi',              danger:'Nguy hiểm' },
  temp: { normal:'Bình thường', warn:'Sốt nhẹ',                   danger:'Sốt cao / Hạ thân nhiệt' }
};

function updateVitals(bpm, spo2, temp) {
  const setVital = (elId, statusId, type, val) => {
    const el  = document.getElementById(elId);
    const cls = vClass(type, val);
    el.textContent = val ?? '--';
    el.className   = `vc-value${cls === 'warn' ? ' val-warn' : cls === 'danger' ? ' val-danger' : ''}`;
    const st = document.getElementById(statusId);
    st.textContent = STATUS_TEXT[type][cls] || 'Bình thường';
    st.className   = `vc-status st-${cls === 'warn' ? 'warn' : cls === 'danger' ? 'danger' : 'normal'}`;
  };

  setVital('live-bpm',  'bpm-status',  'bpm',  bpm);
  setVital('live-spo2', 'spo2-status', 'spo2', spo2);
  setVital('live-temp', 'temp-status', 'temp', temp);

  const overall = overallStatus(bpm, spo2, temp);
  document.getElementById('ph-status').className           = `ph-status ${overall}`;
  document.getElementById('ph-status-text').textContent    = STATUS_LABEL[overall];
  document.getElementById('last-update-text').textContent  = 'Cập nhật: ' + nowString();
}

/* ================================================================
   UPDATE AI
   ================================================================ */
function updateAI(advice, riskScore, timestamp) {
  document.getElementById('ai-advice').textContent = advice || 'Chưa có nhận xét từ AI.';
  document.getElementById('ai-time').textContent   = timestamp || nowString();

  const pct = Math.round((riskScore || 0) * 100);
  const bar = document.getElementById('risk-bar');
  const pctEl = document.getElementById('risk-pct');

  bar.style.width      = pct + '%';
  bar.style.background = pct >= 70 ? 'var(--red)' : pct >= 40 ? 'var(--yellow)' : 'var(--green)';
  pctEl.textContent    = pct + '%';
  pctEl.style.color    = pct >= 70 ? 'var(--red)' : pct >= 40 ? 'var(--yellow)' : 'var(--green)';
}

/* ================================================================
   TREND CHART (Tab Kết quả)
   ================================================================ */
const trendLabels = [], trendBpm = [], trendSpo2 = [], trendTemp = [];
let trendChart;

function initTrendChart() {
  trendChart = new Chart(document.getElementById('trendChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [
        { label:'BPM',      data: trendBpm,  borderColor:'#2563EB', backgroundColor:'rgba(37,99,235,.08)',  tension:.4, pointRadius:2, borderWidth:2 },
        { label:'SpO₂%',    data: trendSpo2, borderColor:'#10B981', backgroundColor:'rgba(16,185,129,.08)', tension:.4, pointRadius:2, borderWidth:2 },
        { label:'Nhiệt độ', data: trendTemp, borderColor:'#F97316', backgroundColor:'rgba(249,115,22,.08)', tension:.4, pointRadius:2, borderWidth:2 }
      ]
    },
    options: {
      responsive: true,
      animation: { duration: 400 },
      plugins: {
        legend: { display:true, position:'top', labels:{ font:{size:11}, boxWidth:12, usePointStyle:true } }
      },
      scales: {
        x: { grid:{color:'#F1F5F9'}, ticks:{font:{size:10}, color:'#94A3B8', maxTicksLimit:8} },
        y: { grid:{color:'#F1F5F9'}, ticks:{font:{size:10}, color:'#94A3B8'} }
      }
    }
  });
}

/* ================================================================
   ANALYTICS CHARTS (lazy init khi mở tab)
   ================================================================ */
let analyticsInited = false;
let spo2ChartInst, hrChartInst, tempChartInst, dailyChartInst;

function initAnalyticsCharts() {
  analyticsInited = true;

  const baseOpts = {
    responsive: true,
    animation: { duration: 300 },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid:{color:'#F1F5F9'}, ticks:{font:{size:10}, color:'#94A3B8', maxTicksLimit:8} },
      y: { grid:{color:'#F1F5F9'}, ticks:{font:{size:10}, color:'#94A3B8'} }
    }
  };

  const mkLine = (id, color, data, labels) => new Chart(
    document.getElementById(id).getContext('2d'), {
      type: 'line',
      data: {
        labels: [...labels],
        datasets: [{ data:[...data], borderColor:color, backgroundColor:color+'18', tension:.4, pointRadius:1.5, borderWidth:2 }]
      },
      options: baseOpts
    }
  );

  spo2ChartInst = mkLine('spo2Chart', '#10B981', trendSpo2, trendLabels);
  hrChartInst   = mkLine('hrChart',   '#2563EB', trendBpm,  trendLabels);
  tempChartInst = mkLine('tempChart', '#F97316', trendTemp, trendLabels);

  // ĐOẠN MỚI
  dailyChartInst = new Chart(document.getElementById('dailyChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['3 ngày trước', '2 ngày trước', 'Hôm qua', 'Hôm nay'],
      datasets: [
        { label:'TB BPM',   data:[78, 82, 75, parseFloat(document.getElementById('live-bpm').textContent)  || 0], backgroundColor:'rgba(37,99,235,.7)',  borderRadius:6 },
        { label:'TB SpO₂',  data:[97, 96, 98, parseFloat(document.getElementById('live-spo2').textContent) || 0], backgroundColor:'rgba(16,185,129,.7)', borderRadius:6 },
        { label:'TB Nhiệt', data:[36.6, 36.8, 36.5, parseFloat(document.getElementById('live-temp').textContent) || 0], backgroundColor:'rgba(249,115,22,.7)', borderRadius:6 }
      ]
    },
    options: {
      ...baseOpts,
      plugins: {
        legend: { display:true, position:'top', labels:{ font:{size:11}, boxWidth:12, usePointStyle:true } }
      }
    }
  });

  renderTrendComment();
}

function renderTrendComment() {
  const bpm  = parseFloat(document.getElementById('live-bpm').textContent)  || patient.bpm;
  const spo2 = parseFloat(document.getElementById('live-spo2').textContent) || patient.spo2;
  const temp = parseFloat(document.getElementById('live-temp').textContent) || patient.temp;
  const st   = overallStatus(bpm, spo2, temp);

  const comments = {
    normal:  `Tất cả chỉ số của ${patient.name} đang trong ngưỡng bình thường. Nhịp tim ổn định (${bpm} BPM), SpO₂ tốt (${spo2}%), nhiệt độ bình thường (${temp}°C). Tiếp tục theo dõi định kỳ.`,
    warning: `Một số chỉ số của ${patient.name} cần chú ý. Khuyến nghị theo dõi chặt chẽ hơn và liên hệ bác sĩ nếu tình trạng không cải thiện trong 30 phút tới.`,
    danger:  `⚠️ Phát hiện chỉ số nguy hiểm của ${patient.name}! Cần can thiệp y tế ngay lập tức. Vui lòng liên hệ bác sĩ hoặc đưa bệnh nhân đến cơ sở y tế gần nhất.`
  };
  document.getElementById('trend-comment').textContent = comments[st] || comments.normal;
}

/* ================================================================
   HISTORY TABLE
   ================================================================ */
let historyData = [];

function renderHistory(data) {
  const tbody = document.getElementById('historyBody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-table">Chưa có dữ liệu lịch sử</td></tr>`;
    return;
  }
  tbody.innerHTML = [...data].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  ).map(r => {
    const bc = vClass('bpm',  r.heart_rate);
    const sc = vClass('spo2', r.spo2);
    const tc = vClass('temp', r.temperature);
    const ov = overallStatus(r.heart_rate, r.spo2, r.temperature);
    const ts = r.timestamp ? new Date(r.timestamp).toLocaleString('vi-VN') : '--';
    return `<tr>
      <td style="color:var(--text-mid);font-size:12px;">${ts}</td>
      <td><span class="val-chip ${bc}">${r.heart_rate ?? '--'} BPM</span></td>
      <td><span class="val-chip ${sc}">${r.spo2 ?? '--'}%</span></td>
      <td><span class="val-chip ${tc}">${r.temperature ?? '--'}°C</span></td>
      <td><span class="status-dot ${ov}"><span class="dot"></span>${STATUS_LABEL[ov] || 'Bình thường'}</span></td>
      <td style="font-size:12px;color:var(--text-mid);">${r.note || '--'}</td>
    </tr>`;
  }).join('');
}

function computeAverages(data) {
  if (!data.length) return;
  const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
  const bpms  = data.map(d => +d.heart_rate).filter(Boolean);
  const spo2s = data.map(d => +d.spo2).filter(Boolean);
  const temps = data.map(d => +d.temperature).filter(Boolean);
  if (bpms.length)  document.getElementById('avg-bpm').textContent  = avg(bpms);
  if (spo2s.length) document.getElementById('avg-spo2').textContent = avg(spo2s);
  if (temps.length) document.getElementById('avg-temp').textContent = avg(temps);
}

/* ================================================================
   SAVE PATIENT INFO
   ================================================================ */
  function savePatientInfo() {
  const name = document.getElementById('edit-name').value.trim();
  if (!name) { showToast('⚠️ Vui lòng nhập họ và tên', 'error'); return; }

  window.savePatientProfile(patientId, {
    name,
    age:       parseInt(document.getElementById('edit-age').value) || 0,
    gender:    document.getElementById('edit-gender').value,
    relation:  document.getElementById('edit-relation').value,
    phone:     document.getElementById('edit-phone').value.trim(),
    diagnosis: document.getElementById('edit-diagnosis').value.trim(),
    note:      document.getElementById('edit-note-field').value.trim(),
    weight:    parseFloat(document.getElementById('edit-weight').value) || null,
    height:    parseFloat(document.getElementById('edit-height').value) || null,
    history:   document.getElementById('edit-history').value.trim(),
    medicine:  document.getElementById('edit-medicine').value.trim(),
    allergy:   document.getElementById('edit-allergy').value.trim()
  }).then(() => {
    document.getElementById('ph-name').textContent   = name;
    document.getElementById('bc-name').textContent   = name;
    document.getElementById('ph-avatar').textContent = initials(name);
    showToast('✅ Đã lưu thông tin bệnh nhân');
  }).catch(() => showToast('❌ Lưu thất bại', 'error'));
}

/* ================================================================
   AI CHAT BOX
   ================================================================ */
const GROQ_API_KEY_CHAT = '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'; // ← key Groq của bạn
const CHAT_MODEL        = 'llama-3.3-70b-versatile';
const MAX_SAMPLES_CHAT  = 30;

let chatHistory    = []; // lịch sử hội thoại gửi lên Groq
let chatContext    = ''; // context bệnh nhân (load 1 lần)
let chatReady      = false;
let chatInited     = false;

/* ── Load context khi mở tab lần đầu ── */
async function initChatContext() {
  if (chatInited) return;
  chatInited = true;

  // Lấy profile
  const profileSnap = await window.db.ref('patients/' + patientId + '/profile').once('value');
  const profile = profileSnap.val() || {};

  // Lấy tối đa 30 mẫu healthData gần nhất
  const hdSnap = await window.db.ref('patients/' + patientId + '/healthData').once('value');
  const raw    = hdSnap.val() || {};
  const allSamples = Object.values(raw)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, MAX_SAMPLES_CHAT);

  // Tóm tắt samples
  const sampleLines = allSamples.map((r, i) => {
    const ts  = r.timestamp ? r.timestamp.slice(0, 19).replace('T', ' ') : '--';
    return `  [${i+1}] ${ts} | BPM=${r.heart_rate ?? '--'}, SpO2=${r.spo2 ?? '--'}%, Nhiệt độ=${r.temperature ?? '--'}°C${r.note ? ' | Ghi chú: ' + r.note : ''}`;
  }).join('\n');

  // Tính BMI nếu có
  const bmiLine = (profile.weight && profile.height)
    ? `- BMI: ${(profile.weight / ((profile.height / 100) ** 2)).toFixed(1)} (nặng ${profile.weight}kg, cao ${profile.height}cm)`
    : '- BMI: Chưa có dữ liệu cân nặng/chiều cao';

  // Xây dựng context
  // Tính thống kê tổng hợp
  const bpms  = allSamples.map(r => r.heart_rate).filter(Boolean);
  const spo2s = allSamples.map(r => r.spo2).filter(Boolean);
  const temps = allSamples.map(r => r.temperature).filter(Boolean);
  const avg   = arr => arr.length ? (arr.reduce((a,b) => a+b, 0) / arr.length).toFixed(1) : '--';
  const latest = allSamples[0] || {};

  // Lấy kết quả phân tích AI gần nhất từ alerts/
  const alertSnap = await window.db.ref('patients/' + patientId + '/alerts')
    .orderByChild('timestamp_ai').limitToLast(1).once('value');
  let lastAiAdvice = 'Chưa có';
  let lastRisk     = 'Chưa có';
  alertSnap.forEach(child => {
    const a      = child.val();
    lastAiAdvice = a.advice     || 'Chưa có';
    lastRisk     = a.risk_score != null
      ? (a.risk_score * 100).toFixed(0) + '%'
      : 'Chưa có';
  });

  chatContext = `Bạn là trợ lý bác sĩ AI trong hệ thống giám sát sức khỏe từ xa.
  Nhiệm vụ: Hỗ trợ bác sĩ và người thân hiểu tình trạng bệnh nhân, giải thích chỉ số, cảnh báo nguy hiểm, đề xuất hành động cụ thể.

  NGUYÊN TẮC:
  - Trả lời bằng tiếng Việt, rõ ràng, có cấu trúc
  - Luôn dựa vào dữ liệu thực tế bên dưới, không đoán mò
  - Nếu chỉ số nguy hiểm → cảnh báo rõ và đề xuất liên hệ bác sĩ ngay
  - Giải thích thuật ngữ y tế bằng ngôn ngữ dễ hiểu khi được hỏi
  - Không tự chẩn đoán bệnh, chỉ nhận xét dựa trên số liệu đo được

  NGƯỠNG THAM CHIẾU:
  - Nhịp tim:  Bình thường 60-100 BPM   | Cảnh báo <60 hoặc >100  | Nguy hiểm <50 hoặc >120
  - SpO₂:      Bình thường ≥96%         | Cảnh báo 92-95%         | Nguy hiểm <92%
  - Nhiệt độ:  Bình thường 36.1-37.2°C  | Cảnh báo 37.3-38.9°C    | Nguy hiểm <35°C hoặc ≥39°C

  === HỒ SƠ BỆNH NHÂN ===
  - Họ tên:          ${profile.name       || 'Chưa có'}
  - Tuổi / Giới:     ${profile.age        || '--'} tuổi / ${profile.gender || 'Chưa có'}
  - Chẩn đoán:       ${profile.diagnosis  || 'Chưa có'}
  - Tiền sử bệnh:    ${profile.history    || 'Chưa có'}
  - Thuốc đang dùng: ${profile.medicine   || 'Chưa có'}
  - Dị ứng:          ${profile.allergy    || 'Không có'}
  - ${bmiLine}

  === CHỈ SỐ MỚI NHẤT ===
  - Thời điểm đo: ${latest.timestamp ? new Date(latest.timestamp).toLocaleString('vi-VN') : 'Chưa có'}
  - Nhịp tim:     ${latest.heart_rate  ?? '--'} BPM
  - SpO₂:         ${latest.spo2        ?? '--'} %
  - Nhiệt độ:     ${latest.temperature ?? '--'} °C
  ${latest.note ? '- Ghi chú: ' + latest.note : ''}

  === THỐNG KÊ ${allSamples.length} MẪU GẦN NHẤT ===
  - Nhịp tim:  TB=${avg(bpms)}  | Min=${bpms.length  ? Math.min(...bpms)  : '--'} | Max=${bpms.length  ? Math.max(...bpms)  : '--'} BPM
  - SpO₂:      TB=${avg(spo2s)} | Min=${spo2s.length ? Math.min(...spo2s) : '--'} | Max=${spo2s.length ? Math.max(...spo2s) : '--'} %
  - Nhiệt độ:  TB=${avg(temps)} | Min=${temps.length ? Math.min(...temps) : '--'} | Max=${temps.length ? Math.max(...temps) : '--'} °C

  === ĐÁNH GIÁ TỪ AI GẦN NHẤT ===
  - Nhận xét:   ${lastAiAdvice}
  - Mức rủi ro: ${lastRisk}

  === CHI TIẾT TỪNG MẪU (mới → cũ) ===
  ${sampleLines || '  (Chưa có dữ liệu)'}`;

  // Cập nhật UI
  const name = profile.name || 'Bệnh nhân';
  document.getElementById('chat-title').textContent = `Trợ lý AI — ${name}`;
  document.getElementById('chat-sub').textContent   = `Đã tải ${allSamples.length} mẫu dữ liệu · Sẵn sàng tư vấn`;

  // Tin nhắn chào
  chatHistory = [];
  const greeting = `Xin chào! Tôi đã có đầy đủ thông tin của ${name} bao gồm hồ sơ cá nhân và ${allSamples.length} mẫu dữ liệu sức khỏe gần nhất. Bạn muốn hỏi gì về tình trạng của bệnh nhân?`;
  appendMessage('ai', greeting);
  chatReady = true;
}

/* ── Gửi tin nhắn ── */
async function sendChat() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text || !chatReady) return;

  input.value = '';
  input.style.height = 'auto';

  appendMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  const btn = document.getElementById('btnSend');
  btn.disabled = true;
  const typingEl = appendMessage('ai', 'Đang phân tích...', true);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY_CHAT
      },
      body: JSON.stringify({
        model:       CHAT_MODEL,
        temperature: 0.4,
        max_tokens:  600,
        messages: [
          { role: 'system', content: chatContext },
          ...chatHistory
        ]
      })
    });

    const data   = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'Xin lỗi, tôi không thể trả lời lúc này.';

    typingEl.textContent = answer;
    typingEl.classList.remove('typing');
    chatHistory.push({ role: 'assistant', content: answer });

    // Giới hạn lịch sử 20 lượt để tránh vượt token
    if (chatHistory.length > 40) chatHistory = chatHistory.slice(-40);

  } catch (e) {
    typingEl.textContent = 'Lỗi kết nối, vui lòng thử lại.';
    typingEl.classList.remove('typing');
    chatHistory.pop();
  }

  btn.disabled = false;
  input.focus();
}

/* ── Append message lên UI ── */
function appendMessage(role, text, isTyping = false) {
  const box    = document.getElementById('chatMessages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble' + (isTyping ? ' typing' : '');
  bubble.innerHTML = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

  msgDiv.appendChild(bubble);
  box.appendChild(msgDiv);
  box.scrollTop = box.scrollHeight;
  return bubble;
}

/* ── Xoá hội thoại ── */
function clearChat() {
  chatHistory = [];
  const box   = document.getElementById('chatMessages');
  box.innerHTML = '';
  const name  = document.getElementById('chat-title').textContent.replace('Trợ lý AI — ', '');
  appendMessage('ai', `Hội thoại đã được xoá. Tôi vẫn giữ đầy đủ thông tin của ${name}. Bạn muốn hỏi gì?`);
}

/* ── Enter gửi, Shift+Enter xuống dòng ── */
function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
}

/* ── Kích hoạt khi mở tab ── */
const _origSwitchTab = switchTab;
window.switchTab = function(btn, panelId) {
  _origSwitchTab(btn, panelId);
  if (panelId === 'tab-ai') initChatContext();
};

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Bảo vệ trang — chưa login → về login.html
  window.requireAuth(function(user) {
    console.log('[Auth] User đang login:', user.email);
  });

  renderHeader(patient);
  initTrendChart();

  // 1. Lắng nghe healthData từ Firebase
  window.onHealthData(patientId, function(list) {
    historyData = list;
    renderHistory(historyData);
    computeAverages(historyData);

    // Cập nhật tab Kết quả bằng lần đo mới nhất
    if (list.length > 0) {
        const sorted = [...list].sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        const latest = sorted[sorted.length - 1];
        updateVitals(latest.heart_rate, latest.spo2, latest.temperature);

        // Fill trendLabels để biểu đồ Phân tích có data
        const recent = sorted.slice(-30); // 30 mẫu gần nhất
        trendLabels.length = 0;
        trendBpm.length    = 0;
        trendSpo2.length   = 0;
        trendTemp.length   = 0;

        recent.forEach(r => {
            trendLabels.push(r.timestamp
                ? new Date(r.timestamp).toLocaleTimeString('vi-VN')
                : '--'
            );
            trendBpm.push(r.heart_rate   || 0);
            trendSpo2.push(r.spo2        || 0);
            trendTemp.push(r.temperature || 0);
        });

        // Cập nhật trend chart tab Kết quả
        trendChart.update();

        // Cập nhật analytics nếu đang mở
        if (analyticsInited) {
            spo2ChartInst.data.labels           = [...trendLabels];
            spo2ChartInst.data.datasets[0].data = [...trendSpo2];
            spo2ChartInst.update();

            hrChartInst.data.labels             = [...trendLabels];
            hrChartInst.data.datasets[0].data   = [...trendBpm];
            hrChartInst.update();

            tempChartInst.data.labels           = [...trendLabels];
            tempChartInst.data.datasets[0].data = [...trendTemp];
            tempChartInst.update();

            renderTrendComment();
        }
    }
  }); 

  // 2. Lắng nghe alerts (kết quả AI) từ Firebase
  window.onAlerts(patientId, function(alert) {
    updateAI(alert.advice, alert.risk_score, alert.timestamp_ai);
  });
});
