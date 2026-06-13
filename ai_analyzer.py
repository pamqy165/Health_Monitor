import os
import json
import time
import threading
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, db
from groq import Groq

# ══════════════════════════════════════════════
#  CẤU HÌNH
# ══════════════════════════════════════════════

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

FIREBASE_DATABASE_URL = "https://health-monitoring-system-f81d8-default-rtdb.asia-southeast1.firebasedatabase.app"

GROQ_MODEL  = "llama-3.3-70b-versatile"
NUM_SAMPLES = 10

# ══════════════════════════════════════════════
#  KHỞI TẠO
# ══════════════════════════════════════════════

import os, base64, json

key_b64 = os.environ.get("FIREBASE_KEY_BASE64")
if key_b64:
    key_data = json.loads(base64.b64decode(key_b64))
    cred = credentials.Certificate(key_data)
else:
    cred = credentials.Certificate("serviceAccountKey.json")

firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_DATABASE_URL})

groq_client = Groq(api_key=GROQ_API_KEY)

print("[OK] Firebase + Groq đã khởi tạo")
print(f"[OK] Model: {GROQ_MODEL} | Số mẫu phân tích: {NUM_SAMPLES}")
print("─" * 50)

# ══════════════════════════════════════════════
#  HELPER: Phân loại ngưỡng (giống shared.js)
# ══════════════════════════════════════════════

def classify_bpm(v):
    if v is None: return "unknown"
    if v > 120 or v < 50: return "danger"
    if v > 100 or v < 60: return "warning"
    return "normal"

def classify_spo2(v):
    if v is None: return "unknown"
    if v < 92:  return "danger"
    if v < 96:  return "warning"
    return "normal"

def classify_temp(v):
    if v is None: return "unknown"
    if v >= 39 or v < 35: return "danger"
    if v >= 37.5:          return "warning"
    return "normal"

def overall_status(bpm, spo2, temp):
    classes = [classify_bpm(bpm), classify_spo2(spo2), classify_temp(temp)]
    if "danger"  in classes: return "danger",  2
    if "warning" in classes: return "warning", 1
    return "normal", 0

# ══════════════════════════════════════════════
#  HELPER: Safety Override
#  Dù AI nói gì, nếu vượt ngưỡng cấp cứu → ép risk cao
# ══════════════════════════════════════════════

def safety_override(bpm, spo2, temp, risk_score):
    """Trả về risk_score đã được ép nếu cần."""
    critical = (
        (spo2  is not None and spo2  < 92)  or
        (bpm   is not None and (bpm < 50 or bpm > 130)) or
        (temp  is not None and temp >= 39)
    )
    if critical and risk_score < 0.85:
        print(f"  [SafetyOverride] Ép risk_score từ {risk_score:.2f} → 0.90")
        return 0.90
    return risk_score

# ══════════════════════════════════════════════
#  LẤY DỮ LIỆU BỆNH NHÂN
# ══════════════════════════════════════════════

def get_patient_profile(patient_id):
    snap = db.reference(f"patients/{patient_id}/profile").get()
    return snap or {}

def get_recent_health_data(patient_id, n=NUM_SAMPLES):
    """Lấy n mẫu healthData gần nhất, sắp xếp theo timestamp."""
    snap = db.reference(f"patients/{patient_id}/healthData").get()
    if not snap:
        return []
    records = list(snap.values())
    records.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    return records[:n]

# ══════════════════════════════════════════════
#  GỌI GROQ API
# ══════════════════════════════════════════════

def call_groq(patient_id, profile, samples):
    """Gọi Groq và trả về (advice, risk_score)."""

    name    = profile.get("name",      "Bệnh nhân")
    age     = profile.get("age",       "không rõ")
    gender  = profile.get("gender",    "không rõ")
    disease = profile.get("diagnosis", "không có")
    history  = profile.get("history",  "không có")
    medicine = profile.get("medicine", "không có")
    allergy  = profile.get("allergy",  "không có")
    weight   = profile.get("weight",   None)
    height   = profile.get("height",   None)

    # Tính BMI nếu có
    if weight and height:
        bmi = round(weight / ((height / 100) ** 2), 1)
        if   bmi < 18.5: bmi_note = "Thiếu cân"
        elif bmi < 23:   bmi_note = "Bình thường"
        elif bmi < 27.5: bmi_note = "Thừa cân"
        else:            bmi_note = "Béo phì"
        bmi_line = f"{bmi} kg/m² ({bmi_note}) — nặng {weight}kg, cao {height}cm"
    else:
        bmi_line = "Chưa có dữ liệu"

    # Tóm tắt các mẫu gần nhất
    sample_lines = []
    bpm_list, spo2_list, temp_list = [], [], []

    for i, r in enumerate(samples):
        ts   = r.get("timestamp", "--")[:19].replace("T", " ")
        hr   = r.get("heart_rate")
        sp   = r.get("spo2")
        tmp  = r.get("temperature")
        note = r.get("note", "")

        if hr:  bpm_list.append(hr)
        if sp:  spo2_list.append(sp)
        if tmp: temp_list.append(tmp)

        line = f"  [{i+1}] {ts} | BPM={hr if hr is not None else '--'}, SpO2={sp if sp is not None else '--'}%, Nhiệt độ={tmp if tmp is not None else '--'}°C"
        if note:
            line += f" | Ghi chú: {note}"
        sample_lines.append(line)

    # Tính thống kê xu hướng
    def stats(lst):
        if not lst: return "không có dữ liệu"
        return f"TB={round(sum(lst)/len(lst),1)}, Min={min(lst)}, Max={max(lst)}"

    trend_bpm  = stats(bpm_list)
    trend_spo2 = stats(spo2_list)
    trend_temp = stats(temp_list)

    samples_text = "\n".join(sample_lines) if sample_lines else "  (Chưa có dữ liệu)"

    # Chỉ số mới nhất
    latest = samples[0] if samples else {}
    bpm  = latest.get("heart_rate")
    spo2 = latest.get("spo2")
    temp = latest.get("temperature")

    bpm_class  = classify_bpm(bpm)
    spo2_class = classify_spo2(spo2)
    temp_class = classify_temp(temp)

    prompt = f"""Bạn là bác sĩ AI chuyên phân tích dữ liệu sức khỏe từ xa.
        Nhiệm vụ: phân tích toàn diện và đưa ra cảnh báo/dự báo chính xác, khách quan.
        Trả lời bằng tiếng Việt.

        === HỒ SƠ BỆNH NHÂN ===
        - Tên: {name}
        - Tuổi: {age} | Giới tính: {gender}
        - Chẩn đoán hiện tại: {disease}
        - Tiền sử bệnh: {history}
        - Thuốc đang dùng: {medicine}
        - Dị ứng: {allergy}
        - BMI: {bmi_line}

        === CHỈ SỐ MỚI NHẤT ===
        - Nhịp tim:  {bpm} BPM  → {bpm_class}
        - SpO₂:      {spo2}%    → {spo2_class}
        - Nhiệt độ:  {temp}°C   → {temp_class}

        === THỐNG KÊ {len(samples)} MẪU GẦN NHẤT ===
        - Nhịp tim:  {trend_bpm}
        - SpO₂:      {trend_spo2}
        - Nhiệt độ:  {trend_temp}

        === CHI TIẾT TỪNG MẪU (mới → cũ) ===
        {samples_text}

        === YÊU CẦU PHÂN TÍCH ===
        Dựa vào toàn bộ thông tin trên, hãy:
        1. Đánh giá xu hướng sức khỏe (đang cải thiện / ổn định / xấu dần)
        2. Xét đến tiền sử bệnh, thuốc, BMI để cá nhân hóa nhận xét
        3. Đưa ra lời khuyên cụ thể cho bệnh nhân này

        Trả lời ĐÚNG định dạng JSON sau, không thêm bất kỳ văn bản nào khác:

        {{
        "advice": "<Nhận xét 2-4 câu: xu hướng sức khỏe + lời khuyên cụ thể, đề cập tên bệnh nhân>",
        "risk_score": <số thực 0.0-1.0>
        }}

        Quy tắc risk_score:
        - 0.00-0.39: Tất cả ổn định, xu hướng tốt
        - 0.40-0.69: Có dấu hiệu cần theo dõi hoặc xu hướng xấu dần
        - 0.70-0.84: Nhiều chỉ số bất thường, cần can thiệp sớm
        - 0.85-1.00: Nguy hiểm, cần can thiệp y tế ngay
        """

    response = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=400,
    )

    raw = response.choices[0].message.content.strip()
    print(f"  [Groq] Raw response: {raw[:120]}...")

    # Parse JSON — xử lý nếu model thêm markdown
    clean = raw
    if "```json" in clean:
        clean = clean.split("```json")[1].split("```")[0].strip()
    elif "```" in clean:
        clean = clean.split("```")[1].split("```")[0].strip()

    parsed     = json.loads(clean)
    advice     = parsed.get("advice", "Không có nhận xét.")
    risk_score = float(parsed.get("risk_score", 0.0))
    risk_score = max(0.0, min(1.0, risk_score))   # clamp [0, 1]

    # Safety override
    risk_score = safety_override(bpm, spo2, temp, risk_score)

    return advice, risk_score, bpm, spo2, temp

# ══════════════════════════════════════════════
#  GHI KẾT QUẢ VÀO FIREBASE
# ══════════════════════════════════════════════

def write_alert(patient_id, advice, risk_score, bpm, spo2, temp):
    _, status_code = overall_status(bpm, spo2, temp)

    alert = {
        "advice":       advice,
        "risk_score":   round(risk_score, 3),
        "status_code":  status_code,          # 0=normal, 1=warning, 2=danger
        "timestamp_ai": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "model":        GROQ_MODEL,
        "bpm":          bpm,
        "spo2":         spo2,
        "temperature":  temp,
    }

    db.reference(f"patients/{patient_id}/alerts").push(alert)
    print(f"  [Firebase] ✅ Đã ghi alerts/ cho {patient_id}")
    print(f"  → risk={risk_score:.2f} | status_code={status_code} | advice={advice[:60]}...")

# ══════════════════════════════════════════════
#  XỬ LÝ MỘT TRIGGER
# ══════════════════════════════════════════════

_processing_lock = threading.Lock()

def process_trigger(trigger_data):
    """Xử lý một lần trigger: lấy data → gọi Groq → ghi alert."""

    patient_id     = trigger_data.get("patient_id")
    measurement_id = trigger_data.get("measurement_id")
    status         = trigger_data.get("status", "")

    if not patient_id:
        print("  [Skip] Không có patient_id")
        return
    if status == "done":
        print(f"  [Skip] Trigger đã xử lý (status=done)")
        return

    print(f"\n{'═'*50}")
    print(f"[Trigger] patient={patient_id} | measurement={measurement_id}")

    # Đánh dấu đang xử lý để tránh chạy lại
    db.reference("trigger_analysis").update({"status": "processing"})

    try:
        profile = get_patient_profile(patient_id)
        samples = get_recent_health_data(patient_id, NUM_SAMPLES)

        print(f"  [Data] Profile: {profile.get('name','?')} | Samples: {len(samples)}")

        if not samples:
            print("  [Skip] Không có healthData")
            db.reference("trigger_analysis").update({"status": "done"})
            return

        advice, risk_score, bpm, spo2, temp = call_groq(patient_id, profile, samples)
        write_alert(patient_id, advice, risk_score, bpm, spo2, temp)

        # Đánh dấu hoàn thành
        db.reference("trigger_analysis").update({"status": "done"})

    except json.JSONDecodeError as e:
        print(f"  [Error] Parse JSON Groq thất bại: {e}")
        db.reference("trigger_analysis").update({"status": "error"})
    except Exception as e:
        print(f"  [Error] {e}")
        db.reference("trigger_analysis").update({"status": "error"})

# ══════════════════════════════════════════════
#  LẮNG NGHE FIREBASE REALTIME
# ══════════════════════════════════════════════

last_trigger_key = None   # tránh xử lý trùng

def on_trigger_change(event):
    global last_trigger_key

    data = event.data
    if not isinstance(data, dict):
        return

    # Tạo key duy nhất từ patient_id + requested_at
    key = f"{data.get('patient_id')}_{data.get('requested_at')}"
    if key == last_trigger_key:
        return   # đã xử lý rồi

    if data.get("status") not in ("pending", None):
        return   # chỉ xử lý khi pending

    last_trigger_key = key

    # Chạy trong thread riêng để không block listener
    t = threading.Thread(target=process_trigger, args=(data,), daemon=True)
    t.start()

def main():
    print("[Start] Đang lắng nghe Firebase trigger_analysis/ ...")
    print("[Info]  Nhấn Ctrl+C để dừng\n")

    ref = db.reference("trigger_analysis")
    ref.listen(on_trigger_change)

    # Giữ main thread sống
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Stop] Đã dừng AI analyzer.")

if __name__ == "__main__":
    main()
