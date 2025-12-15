# Hướng Dẫn: Registry và Cơ Chế Đăng Ký (Registration)

Tài liệu này giải thích chi tiết về khái niệm "Registry" và "Register" trong hệ thống Phân tán Di trú Mã (Distributed Code Migration System), trả lời câu hỏi: **"Register để làm gì?"**.

## 1. Registry (Code Registry) Là Gì?

Trong kiến trúc hệ thống 5 máy của chúng ta, **Registry** (thường là Máy 4) đóng vai trò là **"Kho lưu trữ trung tâm"** và **"Bộ nhớ chung"** của hệ thống. 

### Vai trò chính:
1.  **Lưu trữ Code Bundle:** Chứa các đoạn mã (tasks) có thể thực thi. Để một Task có thể di chuyển từ Worker A sang Worker B, Worker B cần tải "Code Bundle" của task đó về. Registry là nơi cung cấp bundle này.
2.  **Lưu trữ Checkpoint (Quan trọng cho Strong Migration):** Khi thực hiện **Strong Migration** (di trú giữ nguyên trạng thái), hệ thống cần lưu lại trạng thái tức thời (biến số, tiến độ loop) của task vào một nơi an toàn. Registry chính là nơi lưu trữ `ExecutionCheckpoint` này.
    *   *Ví dụ:* Task đang đếm đến 50/100 tại Worker A -> Lưu checkpoint "50" lên Registry -> Worker B tải checkpoint "50" về và chạy tiếp từ 51.

### Tại sao cần Registry?
Nếu không có Registry, Worker A phải gửi trực tiếp dữ liệu cho Worker B. Tuy nhiên, trong mô hình tập trung (Coordinator-based), việc có một Registry độc lập giúp:
*   **Decoupling:** Worker không cần biết nhau, chỉ cần biết Registry.
*   **Reliability:** Nếu Worker A chết (Fault Tolerance), checkpoint vẫn nằm an toàn trên Registry để Worker khác phục hồi.

---

## 2. Quy Trình Register (Đăng Ký Node)

Khái niệm "Register" thứ hai trong hệ thống là hành động **"Node Registration"** (Sự kiện `node:register`).

### Đây là gì?
Khi bạn bật một Worker (Máy 2 hoặc 3) hoặc Monitor (Máy 5) lên, nó cần "báo cáo" sự hiện diện của mình cho Coordinator (Máy 1). Hành động này gọi là **Register**.

### Register để làm gì?
1.  **Để tham gia mạng lưới:** Coordinator quản lý danh sách các node đang hoạt động (`nodes` map). Chỉ những node đã register mới được nhận task.
2.  **Để xác định vai trò:** Khi register, node sẽ gửi thông tin: "Tôi là Worker" hay "Tôi là Monitor".
    *   Coordinator sẽ đưa Worker vào danh sách "Sẵn sàng nhận việc".
    *   Coordinator sẽ cho phép Monitor nhận luồng dữ liệu thống kê (logs, stats).
3.  **Để duy trì kết nối (Heartbeat):** Sau khi register thành công, Coordinator bắt đầu theo dõi "nhịp tim" của node. Nếu node im lặng quá 5 giây -> Coordinator coi là đã chết ("Offline") và kích hoạt quy trình Phục hồi lỗi (Fault Tolerance).

---

## 3. Tóm Tắt Luồng Hoạt Động

### Kịch bản: Chạy Task và Di Trú (Migration)

1.  **Khởi động:** 
    *   Worker A bật lên -> Gửi lệnh `register` -> Coordinator ghi nhận "Worker A online".
2.  **Submit Task:** 
    *   User tạo Task -> Coordinator tìm Worker rảnh (A) -> Gán Task.
    *   *Registry Role:* Worker A tải code từ **Registry** về để chạy.
3.  **Strong Migration (Di chuyển Task):**
    *   User bấm "Migrate" sang Worker B.
    *   Worker A dừng lại, đóng gói trạng thái -> Gửi `checkpoint_save` lên **Registry**.
    *   Coordinator bảo Worker B: "Hãy nhận việc này".
    *   Worker B hỏi **Registry**: "Cho tôi xin checkpoint mới nhất của task này" -> Registry trả về -> Worker B chạy tiếp.
4.  **Fault Tolerance (Node chết):**
    *   Worker A đang chạy thì bị rút dây mạng (chưa kịp gửi trực tiếp cho ai).
    *   Mặc dù A chết, nhưng nếu trước đó A đã định kỳ lưu checkpoint lên **Registry**, thì Worker B có thể khôi phục lại công việc gần nhất từ Registry.

## 4. Kết luận

*   **Code Registry Module:** Là cái "Kho" để chứa code và trạng thái task. Không có nó, không thể làm Strong Migration hay Fault Tolerance hiệu quả.
*   **Node Register Event:** Là "Lời chào" nhập mạng. Không có nó, Coordinator không biết sự tồn tại của Worker để mà giao việc.
