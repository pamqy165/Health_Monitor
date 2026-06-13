# 🏥 Hệ Thống Giám Sát và Cảnh Báo Sức Khỏe Từ Xa
### IoT-Based Remote Health Monitoring & Alert System

<div align="center">

![Platform](https://img.shields.io/badge/Platform-ESP32-blue?style=for-the-badge&logo=espressif)
![Firebase](https://img.shields.io/badge/Firebase-Realtime%20DB-orange?style=for-the-badge&logo=firebase)
![MQTT](https://img.shields.io/badge/MQTT-HiveMQ-purple?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge)

**Môn học:** Cơ sở và Ứng dụng IoTs &nbsp;|&nbsp; **Lớp:** ITFA436064_07 &nbsp;|&nbsp; **Nhóm:** 05  
**GVHD:** Ths. Trịnh Quốc Thanh &nbsp;|&nbsp; **Trường:** ĐH Công nghệ Kỹ thuật TP.HCM (HCMUTE)

[🌐 Xem Demo](https://pamqy165.github.io/health-monitor) &nbsp;·&nbsp; [📋 Báo cáo lỗi](https://github.com/pamqy165/health-monitor/issues)

</div>

---

## 📖 Giới thiệu

Hệ thống giám sát sức khỏe từ xa giúp bác sĩ, y tá và người thân theo dõi liên tục các chỉ số sinh tồn của bệnh nhân — nhịp tim (BPM), nồng độ oxy máu (SpO₂) và nhiệt độ cơ thể — mọi lúc, mọi nơi thông qua trình duyệt web.

Dữ liệu được thu thập từ thiết bị IoT (ESP32 + MAX30102 + DS18B20), truyền lên cloud qua giao thức **MQTT**, lưu trữ trên **Firebase Realtime Database**, và phân tích bởi mô hình **AI/LSTM** để cảnh báo sớm các dấu hiệu bất thường.

---

## ✨ Tính năng nổi bật

| Tính năng | Mô tả |
|-----------|-------|
| 📡 **Theo dõi thời gian thực** | BPM, SpO₂, nhiệt độ cập nhật liên tục mỗi 2 giây qua MQTT |
| 🤖 **Phân tích AI (LSTM)** | Dự báo xu hướng sức khỏe 5 phút tiếp theo, phát hiện bất thường |
| 🚨 **Cảnh báo thông minh** | Ngưỡng an toàn cá nhân hóa theo tuổi và giới tính |
| 👥 **Quản lý nhiều bệnh nhân** | Theo dõi đồng thời, hồ sơ độc lập cho từng bệnh nhân |
| 📊 **Biểu đồ lịch sử** | Chart.js hiển thị xu hướng SpO₂, nhịp tim, nhiệt độ |
| ☁️ **Lưu trữ đám mây** | Firebase Realtime Database đồng bộ tức thì |
| 🔐 **Phân quyền người dùng** | Vai trò Bác sĩ/Y tá và Người nhà với quyền khác nhau |

---

## 🛠️ Công nghệ sử dụng

### Phần cứng
| Thiết bị | Chức năng |
|----------|-----------|
| **ESP32** | Vi điều khiển trung tâm, WiFi tích hợp, dual-core |
| **MAX30102** | Đo nhịp tim (BPM) & SpO₂ bằng phương pháp PPG quang học |
| **DS18B20** | Cảm biến nhiệt độ số, giao tiếp 1-Wire, độ chính xác ±0.5°C |
| **DS3231** | Module RTC thời gian thực, độ chính xác ±2 phút/năm |
| **LCD1602** | Màn hình hiển thị cục bộ qua giao tiếp I2C |
| **MT3608** | Module tăng áp 3.7V → 5V, hiệu suất 93–96% |

### Phần mềm & Cloud
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Database:** Firebase Realtime Database
- **Messaging:** MQTT over WebSocket (HiveMQ Cloud)
- **Charts:** Chart.js 4.4
- **AI/ML:** LSTM model cho dự báo xu hướng
- **Hosting:** GitHub Pages

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────┐     MQTT/WSS      ┌─────────────────┐
│   ESP32 Device  │ ─────────────────▶│  HiveMQ Broker  │
│  MAX30102       │                   │   (Cloud)        │
│  DS18B20        │                   └────────┬────────┘
│  DS3231         │                            │
└─────────────────┘                            │ Subscribe
                                               ▼
                                    ┌─────────────────────┐
                                    │    Web Dashboard     │
                                    │   (GitHub Pages)     │
                                    │                      │
                                    │  ┌───────────────┐   │
                                    │  │  Firebase RT  │   │
                                    │  │   Database    │   │
                                    │  └───────────────┘   │
                                    │  ┌───────────────┐   │
                                    │  │   AI/LSTM     │   │
                                    │  │   Analysis    │   │
                                    │  └───────────────┘   │
                                    └─────────────────────┘
```

---

## 📁 Cấu trúc dự án

```
health-monitor/
├── html/
│   ├── login.html          # Trang đăng nhập
│   ├── overview.html       # Tổng quan hệ thống
│   ├── patients.html       # Danh sách bệnh nhân
│   ├── dashboard.html      # Dashboard chi tiết bệnh nhân
│   ├── save_result.html    # Lưu kết quả đo
│   └── guide.html          # Hướng dẫn sử dụng
├── css/
│   ├── shared.css          # Style dùng chung
│   ├── login.css
│   ├── overview.css
│   ├── patients.css
│   ├── dashboard.css
│   ├── save_result.css
│   └── guide.css
├── js/
│   ├── shared.js           # Hàm tiện ích dùng chung
│   ├── firebase.js         # Khởi tạo & helper Firebase
│   ├── mqtt.js             # Kết nối MQTT Broker
│   ├── login.js
│   ├── patients.js
│   ├── dashboard.js
│   ├── save_result.js
│   ├── guide.js
│   └── fake_data.js        # Giả lập dữ liệu (dev only)
├── images/
│   └── ...
└── index.html              # Redirect về login
```

---

## 🚀 Hướng dẫn cài đặt & chạy

### Xem Demo trực tuyến
Truy cập ngay tại: **[https://pamqy165.github.io/health-monitor](https://pamqy165.github.io/health-monitor)**

### Chạy local
```bash
# Clone repo
git clone https://github.com/pamqy165/health-monitor.git
cd health-monitor

# Mở bằng Live Server (VS Code extension) hoặc bất kỳ HTTP server nào
# KHÔNG mở trực tiếp file HTML (sẽ lỗi CORS với Firebase/MQTT)
npx serve .
```

### Cấu hình thiết bị ESP32
1. Nạp firmware vào ESP32 với thông tin WiFi và MQTT Broker
2. Kết nối các cảm biến MAX30102, DS18B20, DS3231, LCD1602
3. Cấp nguồn qua pin 18650 + module MT3608
4. Theo dõi LCD — khi hiển thị thời gian thực = đã kết nối thành công

---

## 📊 Ngưỡng cảnh báo

| Chỉ số | 🟢 Bình thường | 🟡 Cần theo dõi | 🔴 Nguy hiểm |
|--------|---------------|-----------------|--------------|
| **Nhịp tim (BPM)** | 60 – 100 | 50–59 hoặc 101–120 | < 50 hoặc > 120 |
| **SpO₂ (%)** | ≥ 96% | 92 – 95% | < 92% |
| **Nhiệt độ (°C)** | 35 – 37.4°C | 37.5 – 38.9°C | < 35°C hoặc ≥ 39°C |

---

## 👥 Thành viên nhóm 05

| Họ và tên | MSSV | Vai trò |
|-----------|------|---------|
| **Võ Gia Triết** | 23161345 | Nhóm trưởng |
| **Phan Ngọc Như Quỳnh** | 23161319 | Thành viên |
| **Phạm Ngọc Quý** | 23161320 | Thành viên |
| **Bùi Ngô Anh Luân** | 23161291 | Thành viên |
| **Nguyễn Nhựt Thành** | 23131329 | Thành viên |

**Giảng viên hướng dẫn:** Ths. Trịnh Quốc Thanh — Khoa Điện – Điện Tử, HCMUTE

---

## 📄 License

Dự án được phát triển cho mục đích học thuật tại HCMUTE © 2026 — Nhóm 05.

---

<div align="center">
  <sub>Made with ❤️ by Nhóm 05 · HCMUTE · 2026</sub>
</div>
