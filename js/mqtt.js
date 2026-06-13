/* ============================================================
   mqtt.js — Kết nối MQTT Broker và nhận dữ liệu từ ESP32
   ============================================================ */

/* ================================================================
   CẤU HÌNH MQTT
   ================================================================ */
const MQTT_HOST = 'wss://c5c491454563470fad86602d8132fcab.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_OPTIONS = {
  username:      'device01',
  password:      'Device2026',
  clientId:      'web_' + Math.random().toString(16).slice(2, 8),
  clean:         true,
  reconnectPeriod: 3000,   // tự reconnect sau 3s nếu mất kết nối
  connectTimeout:  10000
};
const MQTT_TOPIC = 'health/device01/data';

/* ================================================================
   STATE
   ================================================================ */
let mqttClient        = null;
let _onDataCallbacks  = [];   // danh sách callback đăng ký nhận data
let _isConnected      = false;
let _lastPayload      = null; // payload nhận được gần nhất

function parsePayload(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.warn('[MQTT] Không parse được JSON:', raw);
    return null;
  }

  const heartRate   = parseFloat(data.heart_rate ?? data.bpm ?? data.hr ?? data.heartRate);
  const spo2        = parseFloat(data.spo2);
  const temperature = parseFloat(data.temperature ?? data.temp);
  const time        = data.time || data.timestamp || new Date().toLocaleTimeString('vi-VN');
  const patientId   = data.patientId || data.patient_id || null;

  // Bỏ qua nếu thiếu dữ liệu cốt lõi
  if (isNaN(heartRate) && isNaN(spo2) && isNaN(temperature)) return null;

  return { heart_rate: heartRate, spo2, temperature, time, patientId, raw: data };
}

/* ================================================================
   GHI live_data/ LÊN FIREBASE
   ================================================================ */
function writeToFirebase(parsed) {
  if (typeof window.saveLiveData !== 'function') return;
  window.saveLiveData(
    isNaN(parsed.heart_rate)   ? null : parsed.heart_rate,
    isNaN(parsed.spo2)        ? null : parsed.spo2,
    isNaN(parsed.temperature) ? null : parsed.temperature,
    parsed.time
  ).catch(err => console.warn('[MQTT→Firebase] Ghi live_data thất bại:', err));
}

/* ================================================================
   GỌI TẤT CẢ CALLBACK ĐÃ ĐĂNG KÝ
   ================================================================ */
function notifyCallbacks(parsed) {
  _onDataCallbacks.forEach(cb => {
    try { cb(parsed); }
    catch (e) { console.error('[MQTT] Callback lỗi:', e); }
  });
}

/* ================================================================
   KẾT NỐI MQTT
   ================================================================ */
function mqttConnect() {
  if (mqttClient) return; // tránh kết nối nhiều lần

  console.log('[MQTT] Đang kết nối tới broker...');
  mqttClient = mqtt.connect(MQTT_HOST, MQTT_OPTIONS);

  /* ── Kết nối thành công ── */
  mqttClient.on('connect', function () {
    _isConnected = true;
    console.log('[MQTT] ✅ Đã kết nối broker');

    mqttClient.subscribe(MQTT_TOPIC, { qos: 1 }, function (err) {
      if (err) {
        console.error('[MQTT] Subscribe thất bại:', err);
      } else {
        console.log('[MQTT] Đang lắng nghe topic:', MQTT_TOPIC);
        _dispatchStatusEvent('connected');
      }
    });
  });

  /* ── Nhận message ── */
  mqttClient.on('message', function (topic, message) {
    const raw    = message.toString();
    const parsed = parsePayload(raw);

    if (!parsed) {
      console.warn('[MQTT] Payload không hợp lệ, bỏ qua:', raw);
      return;
    }

    _lastPayload = parsed;
    console.log('[MQTT] 📦 Nhận data:', parsed);

    writeToFirebase(parsed);
    notifyCallbacks(parsed);
  });

  /* ── Mất kết nối ── */
  mqttClient.on('offline', function () {
    _isConnected = false;
    console.warn('[MQTT] ⚠️ Mất kết nối, đang thử lại...');
    _dispatchStatusEvent('offline');
  });

  /* ── Lỗi ── */
  mqttClient.on('error', function (err) {
    console.error('[MQTT] Lỗi kết nối:', err.message || err);
    _dispatchStatusEvent('error');
  });

  /* ── Reconnect ── */
  mqttClient.on('reconnect', function () {
    console.log('[MQTT] 🔄 Đang kết nối lại...');
    _dispatchStatusEvent('reconnecting');
  });
}

/* ================================================================
   NGẮT KẾT NỐI
   ================================================================ */
function mqttDisconnect() {
  if (mqttClient) {
    mqttClient.end(true);
    mqttClient    = null;
    _isConnected  = false;
    console.log('[MQTT] Đã ngắt kết nối.');
  }
}

/* ================================================================
   ĐĂNG KÝ CALLBACK NHẬN DATA
   ================================================================ */
function onMqttData(callback) {
  _onDataCallbacks.push(callback);
  // Nếu đã có payload từ trước, gọi ngay để không phải chờ
  if (_lastPayload) {
    try { callback(_lastPayload); } catch(e) {}
  }
  return function unsubscribe() {
    _onDataCallbacks = _onDataCallbacks.filter(cb => cb !== callback);
  };
}

/* ================================================================
   CUSTOM EVENT 
   ================================================================ */
function _dispatchStatusEvent(status) {
  document.dispatchEvent(new CustomEvent('mqttStatus', { detail: { status } }));
}

/* ================================================================
   GETTER TIỆN ÍCH
   ================================================================ */
function isMqttConnected() { return _isConnected; }
function getLastPayload()  { return _lastPayload; }

/* ================================================================
   EXPORT ra window
   ================================================================ */
window.mqttConnect    = mqttConnect;
window.mqttDisconnect = mqttDisconnect;
window.onMqttData     = onMqttData;
window.isMqttConnected = isMqttConnected;
window.getLastPayload  = getLastPayload;

/* ================================================================
   TỰ KHỞI ĐỘNG KHI SCRIPT LOAD
   ================================================================ */
document.addEventListener('DOMContentLoaded', function () {
  if (window.db) {
    mqttConnect();
  } else {
    document.addEventListener('firebaseReady', mqttConnect, { once: true });
  }
});