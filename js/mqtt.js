/* ============================================================
   mqtt.js — Nhận dữ liệu ESP32 và gửi ACK phục vụ đo RTT/2
   ============================================================ */

/* ======================== CẤU HÌNH MQTT ======================== */
const MQTT_HOST = 'wss://c5c491454563470fad86602d8132fcab.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_OPTIONS = {
  username: 'device01',
  password: 'Device2026',
  clientId: 'web_' + Math.random().toString(16).slice(2, 8),
  clean: true,
  reconnectPeriod: 3000,
  connectTimeout: 10000
};

const MQTT_TOPIC = 'health/device01/data';
const MQTT_ACK_TOPIC = 'health/device01/ack';

/* ============================ STATE ============================ */
let mqttClient = null;
let _onDataCallbacks = [];
let _isConnected = false;
let _lastPayload = null;

/* ======================= CHUẨN HÓA PAYLOAD ===================== */
function parsePayload(raw) {
  let data;

  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (error) {
    console.warn('[MQTT] Không parse được JSON:', raw);
    return null;
  }

  const heartRate = parseFloat(
    data.heart_rate ?? data.bpm ?? data.hr ?? data.heartRate
  );
  const spo2 = parseFloat(data.spo2);
  const temperature = parseFloat(data.temperature ?? data.temp);
  const time = data.time || data.timestamp || new Date().toLocaleTimeString('vi-VN');
  const patientId = data.patientId || data.patient_id || null;
  const packetId = Number(data.packet_id ?? 0);

  if (isNaN(heartRate) && isNaN(spo2) && isNaN(temperature)) {
    return null;
  }

  return {
    heart_rate: heartRate,
    spo2,
    temperature,
    time,
    patientId,
    packetId,
    raw: data
  };
}

/* ====================== GHI LÊN FIREBASE ======================= */
async function writeToFirebase(parsed) {
  if (typeof window.saveLiveData !== 'function') return;

  await window.saveLiveData(
    isNaN(parsed.heart_rate) ? null : parsed.heart_rate,
    isNaN(parsed.spo2) ? null : parsed.spo2,
    isNaN(parsed.temperature) ? null : parsed.temperature,
    parsed.time
  );
}

/* ======================= GỬI ACK VỀ ESP32 ====================== */
function sendAck(packetId) {
  if (!mqttClient || !_isConnected || packetId <= 0) return;

  mqttClient.publish(
    MQTT_ACK_TOPIC,
    String(packetId),
    { qos: 1, retain: false },
    function (error) {
      if (error) {
        console.warn('[MQTT] Gửi ACK thất bại:', error);
      }
    }
  );
}

/* ====================== GỌI CALLBACK DỮ LIỆU =================== */
function notifyCallbacks(parsed) {
  _onDataCallbacks.forEach(function (callback) {
    try {
      callback(parsed);
    } catch (error) {
      console.error('[MQTT] Callback lỗi:', error);
    }
  });
}

/* ========================== KẾT NỐI ============================ */
function mqttConnect() {
  if (mqttClient) return;

  console.log('[MQTT] Đang kết nối tới broker...');
  mqttClient = mqtt.connect(MQTT_HOST, MQTT_OPTIONS);

  mqttClient.on('connect', function () {
    _isConnected = true;
    console.log('[MQTT] ✅ Đã kết nối broker');

    mqttClient.subscribe(MQTT_TOPIC, { qos: 1 }, function (error) {
      if (error) {
        console.error('[MQTT] Subscribe thất bại:', error);
        return;
      }

      console.log('[MQTT] Đang lắng nghe topic:', MQTT_TOPIC);
      dispatchStatusEvent('connected');
    });
  });

  mqttClient.on('message', function (topic, message) {
    if (topic !== MQTT_TOPIC) return;

    const raw = message.toString();
    const parsed = parsePayload(raw);

    if (!parsed) {
      console.warn('[MQTT] Payload không hợp lệ, bỏ qua:', raw);
      return;
    }

    // ACK được gửi ngay sau khi Web nhận và đọc được packet_id.
    // Web không tính hoặc in delay. ESP32 tính RTT/2 trên Serial Monitor.
    sendAck(parsed.packetId);

    _lastPayload = parsed;

    writeToFirebase(parsed).catch(function (error) {
      console.warn('[MQTT→Firebase] Ghi live_data thất bại:', error);
    });

    notifyCallbacks(parsed);
  });

  mqttClient.on('offline', function () {
    _isConnected = false;
    console.warn('[MQTT] ⚠️ Mất kết nối, đang thử lại...');
    dispatchStatusEvent('offline');
  });

  mqttClient.on('error', function (error) {
    console.error('[MQTT] Lỗi kết nối:', error.message || error);
    dispatchStatusEvent('error');
  });

  mqttClient.on('reconnect', function () {
    console.log('[MQTT] 🔄 Đang kết nối lại...');
    dispatchStatusEvent('reconnecting');
  });
}

/* ========================= NGẮT KẾT NỐI ======================== */
function mqttDisconnect() {
  if (!mqttClient) return;

  mqttClient.end(true);
  mqttClient = null;
  _isConnected = false;
  console.log('[MQTT] Đã ngắt kết nối.');
}

/* ===================== ĐĂNG KÝ CALLBACK DATA =================== */
function onMqttData(callback) {
  _onDataCallbacks.push(callback);

  if (_lastPayload) {
    try {
      callback(_lastPayload);
    } catch (error) {
      console.error('[MQTT] Callback lỗi:', error);
    }
  }

  return function unsubscribe() {
    _onDataCallbacks = _onDataCallbacks.filter(function (item) {
      return item !== callback;
    });
  };
}

/* ============================ TIỆN ÍCH ========================== */
function dispatchStatusEvent(status) {
  document.dispatchEvent(
    new CustomEvent('mqttStatus', { detail: { status } })
  );
}

function isMqttConnected() {
  return _isConnected;
}

function getLastPayload() {
  return _lastPayload;
}

/* ========================== EXPORT ============================== */
window.mqttConnect = mqttConnect;
window.mqttDisconnect = mqttDisconnect;
window.onMqttData = onMqttData;
window.isMqttConnected = isMqttConnected;
window.getLastPayload = getLastPayload;

/* MQTT kết nối độc lập, không chờ Firebase. */
document.addEventListener('DOMContentLoaded', function () {
  mqttConnect();
});
