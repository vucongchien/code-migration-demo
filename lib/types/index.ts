/**
 * =============================================================================
 * SHARED TYPES - Định nghĩa các kiểu dữ liệu dùng chung
 * =============================================================================
 * 
 * File này chứa tất cả các interface và type definitions được sử dụng
 * xuyên suốt hệ thống Code Migration Demo.
 */

// =============================================================================
// NODE TYPES - Các loại node trong hệ thống
// =============================================================================

/**
 * Các vai trò của node trong hệ thống phân tán
 */
export type NodeRole = 'coordinator' | 'worker' | 'registry' | 'monitor';

/**
 * Trạng thái hiện tại của một node
 */
export type NodeStatus = 'online' | 'offline' | 'busy' | 'migrating';

/**
 * Thông tin đầy đủ về một node trong hệ thống
 */
export interface NodeInfo {
  /** ID duy nhất của node */
  id: string;
  /** Tên hiển thị của node */
  name: string;
  /** Vai trò của node */
  role: NodeRole;
  /** Trạng thái hiện tại */
  status: NodeStatus;
  /** Địa chỉ IP:Port của node */
  address: string;
  /** Thời điểm node tham gia hệ thống */
  joinedAt: Date;
  /** Thời điểm ping cuối cùng */
  lastPing?: Date;
}

// =============================================================================
// TASK TYPES - Các loại task và trạng thái thực thi
// =============================================================================

/**
 * Trạng thái của một task
 */
export type TaskStatus = 
  | 'pending'      // Đang chờ thực thi
  | 'running'      // Đang thực thi
  | 'paused'       // Tạm dừng (cho migration)
  | 'migrating'    // Đang di trú
  | 'completed'    // Hoàn thành
  | 'failed';      // Thất bại

/**
 * Loại migration được sử dụng
 */
export type MigrationType = 'weak' | 'strong';

/**
 * Định nghĩa một task cần thực thi
 */
export interface Task {
  /** ID duy nhất của task */
  id: string;
  /** Tên task */
  name: string;
  /** Mã code cần thực thi (serialized) */
  code: string;
  /** Custom code từ người dùng (nếu có) */
  customCode?: string;
  /** Trạng thái hiện tại */
  status: TaskStatus;
  /** Loại migration được chỉ định */
  migrationType: MigrationType;
  /** Node đang thực thi task (nếu có) */
  currentNodeId?: string;
  /** Tiến độ thực thi (0-100) */
  progress: number;
  /** Thời điểm tạo task */
  createdAt: Date;
  /** Thời điểm bắt đầu thực thi */
  startedAt?: Date;
  /** Thời điểm hoàn thành */
  completedAt?: Date;
  /** Kết quả thực thi (nếu có) */
  result?: TaskResult;
}

/**
 * Kết quả thực thi của task
 */
export interface TaskResult {
  /** Có thành công hay không */
  success: boolean;
  /** Dữ liệu kết quả */
  data?: unknown;
  /** Thông báo lỗi (nếu có) */
  error?: string;
  /** Thời gian thực thi (ms) */
  executionTime: number;
}

// =============================================================================
// EXECUTION STATE - Trạng thái thực thi cho Strong Mobility
// =============================================================================

/**
 * Checkpoint lưu trạng thái thực thi
 * Đây là core của Strong Mobility - cho phép resume từ điểm dừng
 */
export interface ExecutionCheckpoint {
  /** ID duy nhất của checkpoint */
  id: string;
  /** ID của task liên quan */
  taskId: string;
  /** Bước thực thi hiện tại */
  currentStep: number;
  /** Tổng số bước */
  totalSteps: number;
  /** Các biến và trạng thái cần lưu */
  variables: Record<string, unknown>;
  /** Node đã tạo checkpoint */
  sourceNodeId: string;
  /** Thời điểm tạo checkpoint */
  createdAt: Date;
  /** Dữ liệu bổ sung cho việc khôi phục */
  metadata?: Record<string, unknown>;
}

/**
 * Cấu hình cho checkpointing
 */
export interface CheckpointConfig {
  /** Bật/tắt checkpointing */
  enabled: boolean;
  /** Khoảng cách giữa các checkpoint (số steps) */
  intervalSteps: number;
  /** Lưu checkpoint tự động khi pause */
  saveOnPause: boolean;
}

// =============================================================================
// CODE BUNDLE - Đóng gói code để transfer
// =============================================================================

/**
 * Bundle chứa code có thể di trú
 */
export interface CodeBundle {
  /** ID duy nhất của bundle */
  id: string;
  /** Tên bundle */
  name: string;
  /** Mô tả ngắn gọn */
  description: string;
  /** Code đã serialize */
  code: string;
  /** Phiên bản */
  version: string;
  /** Checksum để verify tính toàn vẹn */
  checksum: string;
  /** Thời điểm tạo */
  createdAt: Date;
  /** Metadata bổ sung */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// MIGRATION EVENTS - Các sự kiện trong quá trình migration
// =============================================================================

/**
 * Các loại sự kiện migration
 */
export type MigrationEventType =
  | 'migration_requested'   // Yêu cầu migration
  | 'migration_started'     // Bắt đầu migration
  | 'checkpoint_saved'      // Đã lưu checkpoint (Strong)
  | 'code_transferred'      // Code đã được transfer
  | 'state_transferred'     // State đã được transfer (Strong)
  | 'migration_completed'   // Migration hoàn thành
  | 'migration_failed'      // Migration thất bại
  | 'execution_resumed'     // Đã resume thực thi
  | 'node_failure_detected' // Phát hiện lỗi node (Fault Tolerance)
  | 'task_recovered';       // Task đã được phục hồi (Fault Tolerance)

/**
 * Sự kiện migration để tracking và logging
 */
export interface MigrationEvent {
  /** ID duy nhất của event */
  id: string;
  /** ID của task liên quan */
  taskId: string;
  /** Loại sự kiện */
  type: MigrationEventType;
  /** Node nguồn */
  sourceNodeId: string;
  /** Node đích */
  targetNodeId: string;
  /** Loại migration */
  migrationType: MigrationType;
  /** Thời điểm xảy ra */
  timestamp: Date;
  /** Dữ liệu bổ sung */
  data?: Record<string, unknown>;
  /** Thông điệp mô tả */
  message: string;
}

// =============================================================================
// PROTOCOL MESSAGES - Các message trong giao thức WebSocket
// =============================================================================

/**
 * Các loại message trong protocol
 */
export type MessageType =
  // Node management
  | 'node_register'         // Node đăng ký với coordinator
  | 'node_heartbeat'        // Heartbeat để duy trì kết nối
  | 'node_status_update'    // Cập nhật trạng thái node
  
  // Task management
  | 'task_submit'           // Submit task mới
  | 'task_assign'           // Gán task cho worker
  | 'task_start'            // Bắt đầu thực thi task
  | 'task_progress'         // Cập nhật tiến độ
  | 'task_complete'         // Task hoàn thành
  | 'task_pause'            // Tạm dừng task
  
  // Migration
  | 'migration_request'     // Yêu cầu migration
  | 'migration_prepare'     // Chuẩn bị cho migration
  | 'migration_execute'     // Thực hiện migration
  | 'migration_complete'    // Migration hoàn thành
  
  // Checkpoint (Strong Mobility)
  | 'checkpoint_save'       // Lưu checkpoint
  | 'checkpoint_load'       // Load checkpoint
  | 'checkpoint_saved'      // Xác nhận đã lưu
  
  // Broadcasting
  | 'broadcast_event';      // Broadcast sự kiện đến tất cả node

/**
 * Cấu trúc base của một message
 */
export interface BaseMessage<T extends MessageType, P = unknown> {
  /** Loại message */
  type: T;
  /** ID của message */
  messageId: string;
  /** ID của node gửi */
  senderId: string;
  /** Timestamp */
  timestamp: Date;
  /** Payload data */
  payload: P;
}

// =============================================================================
// SPECIFIC MESSAGE PAYLOADS - Payload cụ thể cho từng loại message
// =============================================================================

/**
 * Payload cho việc đăng ký node
 */
export interface NodeRegisterPayload {
  nodeInfo: Omit<NodeInfo, 'joinedAt' | 'lastPing'>;
}

/**
 * Payload cho việc gán task
 */
export interface TaskAssignPayload {
  task: Task;
  codeBundle: CodeBundle;
  checkpoint?: ExecutionCheckpoint;  // Có nếu là Strong migration resume
}

/**
 * Payload cho việc báo cáo tiến độ
 */
export interface TaskProgressPayload {
  taskId: string;
  progress: number;
  currentStep: number;
  totalSteps: number;
  message?: string;
}

/**
 * Payload cho yêu cầu migration
 */
export interface MigrationRequestPayload {
  taskId: string;
  sourceNodeId: string;
  targetNodeId: string;
  migrationType: MigrationType;
  reason?: string;
}

/**
 * Payload cho việc lưu checkpoint
 */
export interface CheckpointPayload {
  checkpoint: ExecutionCheckpoint;
}

// =============================================================================
// UI STATE - Trạng thái cho Dashboard
// =============================================================================

/**
 * Trạng thái tổng quan của hệ thống
 */
export interface SystemOverview {
  /** Danh sách tất cả nodes */
  nodes: NodeInfo[];
  /** Danh sách tất cả tasks */
  tasks: Task[];
  /** Các sự kiện migration gần đây */
  recentEvents: MigrationEvent[];
  /** Thống kê */
  stats: SystemStats;
}

/**
 * Thống kê hệ thống
 */
export interface SystemStats {
  /** Tổng số nodes online */
  onlineNodes: number;
  /** Tổng số tasks */
  totalTasks: number;
  /** Số tasks đang chạy */
  runningTasks: number;
  /** Số migrations hoàn thành */
  completedMigrations: number;
  /** Số migrations thất bại */
  failedMigrations: number;
}

// =============================================================================
// CONFIGURATION - Cấu hình hệ thống
// =============================================================================

/**
 * Cấu hình cho một node
 */
export interface NodeConfig {
  /** ID node (tự động sinh nếu không có) */
  nodeId?: string;
  /** Tên hiển thị */
  name: string;
  /** Vai trò */
  role: NodeRole;
  /** Port để listen */
  port: number;
  /** Địa chỉ coordinator (cho worker nodes) */
  coordinatorAddress?: string;
  /** Cấu hình checkpoint */
  checkpoint?: CheckpointConfig;
}

/**
 * Cấu hình cho Coordinator
 */
export interface CoordinatorConfig extends NodeConfig {
  role: 'coordinator';
  /** Thời gian timeout cho heartbeat (ms) */
  heartbeatTimeout: number;
  /** Thời gian interval kiểm tra nodes (ms) */
  checkInterval: number;
}

/**
 * Cấu hình cho Worker
 */
export interface WorkerConfig extends NodeConfig {
  role: 'worker';
  /** Địa chỉ coordinator */
  coordinatorAddress: string;
  /** Khoảng thời gian gửi heartbeat (ms) */
  heartbeatInterval: number;
}

// =============================================================================
// LOGGING & STATS - Logging tập trung và thống kê
// =============================================================================

/**
 * Một dòng log từ hệ thống
 */
export interface LogEntry {
  id: string;
  timestamp: Date;
  nodeId: string;
  nodeName: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'success';
  context: string;
  message: string;
  data?: unknown;
}

/**
 * Thống kê tài nguyên của Node
 */
export interface NodeStats {
  nodeId: string;
  timestamp: Date;
  cpuUsage: number;    // % usage
  memoryUsage: {
    used: number;      // MB
    total: number;     // MB
    percentage: number; // %
  };
}
