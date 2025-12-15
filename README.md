# Demo Code Migration - Hệ thống Phân tán

## 🚀 Giới thiệu

Đây là dự án demo **di trú mã (Code Migration)** sử dụng Next.js 16, minh họa hai khái niệm quan trọng:

- **Weak Mobility**: Di chuyển code giữa các node, task restart từ đầu
- **Strong Mobility**: Di chuyển code + execution state, task tiếp tục từ checkpoint

## 📦 Cài đặt

```bash
npm install
```

## 🖥️ Cấu hình 5 máy Demo

| Máy | Vai trò | Lệnh chạy |
|-----|---------|-----------|
| **Máy 1** | Coordinator | `npm run coordinator` |
| **Máy 2** | Worker A | `npm run worker:a` |
| **Máy 3** | Worker B | `npm run worker:b` |
| **Máy 4** | Registry | (Tích hợp trong Coordinator) |
| **Máy 5** | Monitor Dashboard | `npm run dev` |

### Chạy trên 1 máy (Development)

```bash
# Chạy tất cả các services cùng lúc
npm run demo

# Hoặc chạy từng service riêng (mỗi terminal)
npm run coordinator   # Terminal 1
npm run worker:a      # Terminal 2
npm run worker:b      # Terminal 3
npm run dev           # Terminal 4 (Dashboard)
```

### Chạy trên nhiều máy

1. Đảm bảo tất cả máy trong cùng mạng LAN
2. Trên **Máy 1** (Coordinator):
   ```bash
   npm run coordinator
   ```
3. Trên **Máy 2** và **Máy 3** (Workers), chỉnh `COORDINATOR_URL`:
   ```bash
   COORDINATOR_URL=http://<IP-MAY-1>:3001 npm run worker:a
   ```
4. Trên **Máy 5** (Monitor), mở Dashboard và kết nối đến Coordinator

## 🎮 Hướng dẫn Demo

### Demo 1: Weak Mobility

1. Mở Dashboard tại http://localhost:3000
2. Click **"Start (Weak)"** để bắt đầu task trên Worker A
3. Quan sát task đang chạy (đếm số)
4. Click **"Weak Migration"** để di trú code sang Worker B
5. **Kết quả**: Task restart từ số 1 (không giữ state)

### Demo 2: Strong Mobility

1. Click **"Start (Strong)"** để bắt đầu task với checkpointing
2. Quan sát task đang chạy và checkpoints được tạo
3. Click **"Strong Migration"** để di trú code + state
4. **Kết quả**: Task tiếp tục từ checkpoint (giữ state)

## 📁 Cấu trúc dự án

```
├── app/                    # Next.js App Router
│   ├── page.tsx           # Dashboard chính
│   ├── layout.tsx         # Layout
│   └── globals.css        # Styles
├── lib/                    # Core libraries
│   ├── types/             # TypeScript types
│   ├── constants/         # Constants và config
│   ├── utils/             # Utility functions
│   ├── store/             # Zustand state management
│   ├── runtime/           # Execution runtime
│   ├── migration/         # Migration manager
│   ├── registry/          # Code registry
│   └── socket/            # Socket.io client
├── server/                 # Server-side code
│   ├── coordinator.ts     # Coordinator server
│   └── worker.ts          # Worker client
├── components/ui/          # React components
└── hooks/                  # React hooks
```

## 🔧 Công nghệ sử dụng

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Socket.IO** - Real-time communication
- **Zustand** - State management
- **TailwindCSS** - Styling

## 📊 Ports

| Service | Port |
|---------|------|
| Dashboard (Next.js) | 3000 |
| Coordinator | 3001 |
| Workers | Dynamic |

## 👥 Thành viên nhóm

| Máy | Thành viên | Vai trò |
|-----|------------|---------|
| 1 | | Coordinator |
| 2 | | Worker A |
| 3 | | Worker B |
| 4 | | Registry |
| 5 | | Monitor |

---

**Đồ án Hệ thống Phân tán - Next.js 16 Demo**
