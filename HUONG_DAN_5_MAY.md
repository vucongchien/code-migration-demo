# 📖 HƯỚNG DẪN DEMO CHO 5 MÁY (QUA VPN)

## 🌐 Chuẩn bị Chung

### Yêu cầu
- 5 laptop đã cài **VPN** (Hamachi, ZeroTier, Radmin VPN, LogMeIn, etc.)
- Tất cả 5 máy **cùng mạng VPN**
- Node.js 18+ đã cài đặt
- Clone project vào **tất cả 5 máy**

### Cài đặt (thực hiện trên cả 5 máy)
```bash
cd he-thong-phan-tan-di-tru-ma
npm install
```

---

## 🔒 CẤU HÌNH VPN

### IP VPN của Máy 1 (Coordinator)
```
IP: 26.122.184.166
Port: 3001
```

### Bảng IP VPN của các máy
Điền IP VPN của từng máy vào bảng dưới:

| Máy | Vai trò | IP VPN | Trạng thái |
|-----|---------|--------|------------|
| **Máy 1** | Coordinator | `26.122.184.166` | ✅ Đã xác định |
| **Máy 2** | Worker A | `___.___.___.___` | ⬜ Cần điền |
| **Máy 3** | Worker B | `___.___.___.___` | ⬜ Cần điền |
| **Máy 4** | Registry | `___.___.___.___` | ⬜ Cần điền |
| **Máy 5** | Monitor | `___.___.___.___` | ⬜ Cần điền |

### Kiểm tra kết nối VPN
Trước khi demo, test ping từ các máy khác đến Máy 1:
```bash
ping 26.122.184.166
```
Nếu ping được → VPN hoạt động ✅

---

## 🖥️ MÁY 1: COORDINATOR (Điều phối)

### Vai trò
- Là **trung tâm điều phối** của hệ thống
- Quản lý kết nối tất cả nodes
- Điều khiển quá trình migration

### Lệnh chạy
```bash
npm run coordinator
```

### Kết quả mong đợi
```
✅ [Coordinator] =================================
✅ [Coordinator]   Coordinator Server Started!
✅ [Coordinator]   Port: 3001
✅ [Coordinator]   http://localhost:3001
✅ [Coordinator] =================================
```

### Kiểm tra hoạt động
Mở browser: `http://localhost:3001/health`
```json
{"status":"ok","nodes":0}
```

### Script thuyết trình
> "Đây là Coordinator - trung tâm điều phối của hệ thống phân tán. 
> Nó chịu trách nhiệm quản lý tất cả nodes và điều khiển quá trình migration."

---

## 🖥️ MÁY 2: WORKER A (Nguồn Migration)

### Vai trò
- Là **Worker node đầu tiên**
- Thực thi tasks được giao
- Là **nguồn (source)** của migration

### Lệnh chạy (VPN)
```bash
set COORDINATOR_URL=http://26.122.184.166:3001
set WORKER_ID=worker-a
set WORKER_NAME=Worker A - May 2
npx tsx server/worker.ts
```

Hoặc dùng lệnh 1 dòng (Windows CMD):
```cmd
cmd /c "set COORDINATOR_URL=http://26.122.184.166:3001 && set WORKER_ID=worker-a && set WORKER_NAME=Worker A && npx tsx server/worker.ts"
```

Hoặc PowerShell:
```powershell
$env:COORDINATOR_URL="http://26.122.184.166:3001"; $env:WORKER_ID="worker-a"; $env:WORKER_NAME="Worker A"; npx tsx server/worker.ts
```

### Kết quả mong đợi
```
✅ [Worker] =================================
✅ [Worker]   Worker Node Starting...
✅ [Worker]   ID: worker-a
✅ [Worker]   Name: Worker A - May 2
✅ [Worker]   Coordinator: http://26.122.184.166:3001
✅ [Worker] =================================
✅ [Worker] Đã kết nối đến Coordinator! Socket ID: xxx
✅ [Worker] Đã đăng ký thành công
```

### Script thuyết trình
> "Worker A là node thực thi - nơi code sẽ chạy ban đầu.
> Khi demo migration, Worker A sẽ là nguồn gốc của quá trình di trú."

---

## 🖥️ MÁY 3: WORKER B (Đích Migration)

### Vai trò
- Là **Worker node thứ hai**
- Nhận code/state từ Worker A
- Là **đích (target)** của migration

### Lệnh chạy (VPN)
```bash
set COORDINATOR_URL=http://26.122.184.166:3001
set WORKER_ID=worker-b
set WORKER_NAME=Worker B - May 3
npx tsx server/worker.ts
```

Hoặc PowerShell:
```powershell
$env:COORDINATOR_URL="http://26.122.184.166:3001"; $env:WORKER_ID="worker-b"; $env:WORKER_NAME="Worker B"; npx tsx server/worker.ts
```

### Kết quả mong đợi
```
✅ [Worker] =================================
✅ [Worker]   Worker Node Starting...
✅ [Worker]   ID: worker-b
✅ [Worker]   Name: Worker B - May 3
✅ [Worker]   Coordinator: http://26.122.184.166:3001
✅ [Worker] =================================
✅ [Worker] Đã kết nối đến Coordinator!
✅ [Worker] Đã đăng ký thành công
```

### Script thuyết trình
> "Worker B là đích của migration.
> Trong Weak Mobility, nó sẽ chạy lại code từ đầu.
> Trong Strong Mobility, nó sẽ tiếp tục từ checkpoint."

---

## 🖥️ MÁY 4: REGISTRY (Lưu trữ)

### Vai trò
- Lưu trữ **code bundles** và **checkpoints**
- Trong demo này, Registry đã **tích hợp trong Coordinator**
- Máy 4 có thể **hỗ trợ thuyết trình** hoặc làm backup

### Lệnh chạy (tùy chọn - VPN)
Máy 4 có thể chạy thêm một Worker để demo với nhiều nodes:

**PowerShell (1 dòng):**
```powershell
$env:COORDINATOR_URL="http://26.122.184.166:3001"; $env:WORKER_ID="worker-c"; $env:WORKER_NAME="Worker C"; npx tsx server/worker.ts
```

**Hoặc CMD:**
```cmd
set COORDINATOR_URL=http://26.122.184.166:3001 && set WORKER_ID=worker-c && set WORKER_NAME=Worker C && npx tsx server/worker.ts
```

### Script thuyết trình
> "Registry lưu trữ code và checkpoints.
> Trong kiến trúc này, Registry được tích hợp trong Coordinator để đơn giản hóa."

---

## 🖥️ MÁY 5: MONITOR DASHBOARD (Hiển thị)

### Vai trò
- Hiển thị **Dashboard giám sát real-time**
- Nơi **điều khiển demo** (Start Task, Trigger Migration)
- Màn hình chính cho **người xem**

### Lệnh chạy
```bash
npm run dev
```

### Kết quả mong đợi
```
▲ Next.js 16.0.10
- Local:        http://localhost:3000
- Ready in 2.5s
```

### Mở Dashboard
**Mở browser:** `http://localhost:3000`

### ⚠️ Kết nối đến Coordinator qua VPN

**Cách 1: Sửa file hooks/use-demo.ts** (Khuyến nghị)

Mở file `hooks/use-demo.ts`, tìm dòng:
```typescript
const serverUrl = options.serverUrl || `http://localhost:${DEFAULT_CONFIG.COORDINATOR_PORT}`;
```

Đổi thành:
```typescript
const serverUrl = options.serverUrl || `http://26.122.184.166:3001`;
```

**Cách 2: Dùng Mock Mode**

Nếu không muốn sửa code, bật **Mock Mode** trên Dashboard để demo giao diện.

### Script thuyết trình
> "Đây là Dashboard Monitor - nơi chúng ta giám sát toàn bộ hệ thống
> và điều khiển quá trình demo."

---

## 🎬 KỊCH BẢN DEMO

### Bước 0: Khởi động (2 phút)

| Thứ tự | Máy | Hành động |
|--------|-----|-----------|
| 1 | Máy 1 | Chạy `npm run coordinator` |
| 2 | Máy 2 | Chạy Worker A (kết nối đến Máy 1) |
| 3 | Máy 3 | Chạy Worker B (kết nối đến Máy 1) |
| 4 | Máy 5 | Chạy `npm run dev`, mở Dashboard |
| 5 | Tất cả | Verify: Dashboard hiển thị 4 nodes online |

---

### Demo 1: WEAK MOBILITY (3 phút)

| Bước | Máy | Người thực hiện | Hành động | Lời thuyết trình |
|------|-----|-----------------|-----------|------------------|
| 1 | 5 | Thành viên 5 | Click **"Start (Weak)"** | "Chúng ta submit một task đếm số 1→100" |
| 2 | 2 | Thành viên 2 | Show log terminal | "Worker A đang thực thi, đang ở số 35..." |
| 3 | 5 | Thành viên 5 | Đợi đến ~step 40 | "Task đang chạy, giờ trigger migration" |
| 4 | 5 | Thành viên 5 | Click **"Weak Migration"** | "Di trú code từ Worker A sang Worker B" |
| 5 | 2 | Thành viên 2 | Show log dừng | "Worker A dừng thực thi" |
| 6 | 3 | Thành viên 3 | Show log restart | "Worker B bắt đầu **TỪ SỐ 1**" |
| 7 | 5 | Thành viên 5 | Highlight kết quả | "Đây là Weak Mobility - code move, **state không move**" |

---

### Demo 2: STRONG MOBILITY (5 phút)

| Bước | Máy | Người thực hiện | Hành động | Lời thuyết trình |
|------|-----|-----------------|-----------|------------------|
| 1 | 5 | Thành viên 5 | Click **"Start (Strong)"** | "Submit task với checkpointing enabled" |
| 2 | 2 | Thành viên 2 | Show checkpoint logs | "Mỗi 10 bước tạo 1 checkpoint" |
| 3 | 5 | Thành viên 5 | Đợi đến ~step 55 | "Đã có 5 checkpoints, trigger migration" |
| 4 | 5 | Thành viên 5 | Click **"Strong Migration"** | "Di trú code + STATE" |
| 5 | 2 | Thành viên 2 | Show save state log | "Worker A lưu state cuối: step 55" |
| 6 | 3 | Thành viên 3 | Show resume log | "Worker B **TIẾP TỤC TỪ STEP 56**" |
| 7 | 5 | Thành viên 5 | So sánh 2 demo | "Strong Mobility = code + state move together" |

---

### Kết luận (2 phút)

**Thành viên 5 tổng kết:**
> "Qua demo này, chúng ta đã thấy sự khác biệt giữa:
> - **Weak Mobility**: Code di chuyển, task restart từ đầu
> - **Strong Mobility**: Code + State di chuyển, task tiếp tục từ điểm dừng
>
> Strong Mobility sử dụng kỹ thuật checkpointing để lưu trạng thái thực thi."

---

## ⚠️ XỬ LÝ SỰ CỐ

### Worker không kết nối được
```
❌ [Worker] Lỗi kết nối: connect ECONNREFUSED
```
**Giải pháp:**
1. Kiểm tra Coordinator đang chạy
2. Kiểm tra IP chính xác
3. Kiểm tra firewall: `netsh advfirewall firewall add rule name="Node 3001" dir=in action=allow protocol=TCP localport=3001`

### Dashboard không load
**Giải pháp:**
1. Bật Mock Mode (checkbox trên Dashboard)
2. Kiểm tra `npm run dev` đang chạy

### Migration không hoạt động
**Giải pháp:**
1. Đảm bảo có ít nhất 2 Workers online
2. Đảm bảo có task đang running
3. Refresh Dashboard và thử lại

---

## 📞 LIÊN HỆ HỖ TRỢ

Nếu gặp vấn đề khi demo, liên hệ:
- [Điền thông tin nhóm]
