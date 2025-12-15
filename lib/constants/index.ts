/**
 * =============================================================================
 * CONSTANTS - Các hằng số dùng chung trong hệ thống
 * =============================================================================
 */

// =============================================================================
// SOCKET EVENTS - Tên các sự kiện WebSocket
// =============================================================================

export const SOCKET_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Node management
  NODE_REGISTER: 'node:register',
  NODE_REGISTERED: 'node:registered',
  NODE_HEARTBEAT: 'node:heartbeat',
  NODE_STATUS_UPDATE: 'node:status:update',
  NODE_LIST_UPDATE: 'node:list:update',

  // Task management
  TASK_SUBMIT: 'task:submit',
  TASK_SUBMITTED: 'task:submitted',
  TASK_ASSIGN: 'task:assign',
  TASK_START: 'task:start',
  TASK_PROGRESS: 'task:progress',
  TASK_COMPLETE: 'task:complete',
  TASK_PAUSE: 'task:pause',
  TASK_ERROR: 'task:error',

  // Migration
  MIGRATION_REQUEST: 'migration:request',
  MIGRATION_PREPARE: 'migration:prepare',
  MIGRATION_READY: 'migration:ready',
  MIGRATION_EXECUTE: 'migration:execute',
  MIGRATION_COMPLETE: 'migration:complete',
  MIGRATION_FAILED: 'migration:failed',

  // Checkpoint (Strong Mobility)
  CHECKPOINT_SAVE: 'checkpoint:save',
  CHECKPOINT_SAVED: 'checkpoint:saved',
  CHECKPOINT_LOAD: 'checkpoint:load',
  CHECKPOINT_LOADED: 'checkpoint:loaded',

  // Broadcast
  BROADCAST_EVENT: 'broadcast:event',
  SYSTEM_UPDATE: 'system:update',
} as const;

// Export type cho event names
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

// =============================================================================
// DEFAULT CONFIGURATIONS - Cấu hình mặc định
// =============================================================================

export const DEFAULT_CONFIG = {
  // Coordinator defaults
  COORDINATOR_PORT: 3001,
  HEARTBEAT_TIMEOUT: 5000,        // 5 giây (Giảm để test nhanh hơn)
  CHECK_INTERVAL: 2000,           // 2 giây

  // Worker defaults
  WORKER_PORT: 3002,
  HEARTBEAT_INTERVAL: 3000,       // 3 giây

  // Registry defaults
  REGISTRY_PORT: 3003,

  // Checkpoint defaults
  CHECKPOINT_INTERVAL_STEPS: 10,  // Mỗi 10 steps tạo 1 checkpoint

  // Demo task defaults
  DEMO_TASK_TOTAL_STEPS: 100,     // Demo đếm từ 1 đến 100
  DEMO_STEP_DELAY_MS: 500,        // Delay 500ms giữa mỗi step
} as const;

// =============================================================================
// NODE COLORS - Màu sắc cho UI
// =============================================================================

export const NODE_COLORS = {
  coordinator: {
    primary: '#3B82F6',    // Blue
    secondary: '#60A5FA',
    bg: '#EFF6FF',
  },
  worker: {
    primary: '#10B981',    // Green
    secondary: '#34D399',
    bg: '#ECFDF5',
  },
  registry: {
    primary: '#F59E0B',    // Yellow/Orange
    secondary: '#FBBF24',
    bg: '#FFFBEB',
  },
  monitor: {
    primary: '#8B5CF6',    // Purple
    secondary: '#A78BFA',
    bg: '#F5F3FF',
  },
} as const;

// =============================================================================
// STATUS COLORS - Màu cho trạng thái
// =============================================================================

export const STATUS_COLORS = {
  online: '#10B981',       // Green
  offline: '#EF4444',      // Red
  busy: '#F59E0B',         // Yellow
  migrating: '#3B82F6',    // Blue
  pending: '#6B7280',      // Gray
  running: '#10B981',      // Green
  paused: '#F59E0B',       // Yellow
  completed: '#10B981',    // Green
  failed: '#EF4444',       // Red
} as const;

// =============================================================================
// DEMO CODE TEMPLATES - Code mẫu cho demo
// =============================================================================

export const DEMO_CODE_TEMPLATES = {
  /**
   * Demo đếm số đơn giản
   * Phù hợp để demo cả Weak và Strong mobility
   */
  COUNTING_TASK: `
// Demo Task: Đếm số từ 1 đến N
async function countingTask(context) {
  const { startFrom = 1, endAt = 100, stepDelay = 500 } = context.params;
  let current = context.checkpoint?.currentStep || startFrom;
  
  while (current <= endAt) {
    // Báo cáo tiến độ
    context.reportProgress({
      currentStep: current,
      totalSteps: endAt,
      message: \`Đang đếm: \${current}\`
    });
    
    // Lưu checkpoint cho Strong Mobility
    if (context.shouldCheckpoint()) {
      await context.saveCheckpoint({
        currentStep: current,
        variables: { current }
      });
    }
    
    // Chờ giữa các steps (để dễ quan sát)
    await context.sleep(stepDelay);
    
    // Kiểm tra có bị pause không
    if (context.isPaused()) {
      return { paused: true, at: current };
    }
    
    current++;
  }
  
  return { success: true, finalCount: current - 1 };
}
`,

  /**
   * Demo tính tổng (có thể resume)
   */
  SUM_TASK: `
// Demo Task: Tính tổng từ 1 đến N
async function sumTask(context) {
  const { endAt = 50, stepDelay = 300 } = context.params;
  let current = context.checkpoint?.currentStep || 1;
  let sum = context.checkpoint?.variables?.sum || 0;
  
  while (current <= endAt) {
    sum += current;
    
    context.reportProgress({
      currentStep: current,
      totalSteps: endAt,
      message: \`Bước \${current}: Tổng hiện tại = \${sum}\`
    });
    
    if (context.shouldCheckpoint()) {
      await context.saveCheckpoint({
        currentStep: current,
        variables: { current, sum }
      });
    }
    
    await context.sleep(stepDelay);
    
    if (context.isPaused()) {
      return { paused: true, at: current, currentSum: sum };
    }
    
    current++;
  }
  
  return { success: true, finalSum: sum };
}
`,
} as const;

// =============================================================================
// MIGRATION STATUS MESSAGES - Thông báo trạng thái migration
// =============================================================================

export const MIGRATION_MESSAGES = {
  WEAK: {
    REQUESTED: 'Yêu cầu Weak Migration...',
    STOPPING_SOURCE: 'Đang dừng task trên node nguồn...',
    TRANSFERRING_CODE: 'Đang transfer code...',
    STARTING_TARGET: 'Đang khởi động task trên node đích (từ đầu)...',
    COMPLETED: 'Weak Migration hoàn thành! Task đã restart từ đầu.',
  },
  STRONG: {
    REQUESTED: 'Yêu cầu Strong Migration...',
    SAVING_CHECKPOINT: 'Đang lưu checkpoint...',
    STOPPING_SOURCE: 'Đang dừng task và capture state...',
    TRANSFERRING_CODE: 'Đang transfer code...',
    TRANSFERRING_STATE: 'Đang transfer execution state...',
    RESTORING_STATE: 'Đang khôi phục state trên node đích...',
    CONTINUING: 'Task tiếp tục từ checkpoint...',
    COMPLETED: 'Strong Migration hoàn thành! Task đã resume từ điểm dừng.',
  },
  RECOVERY: {
    NODE_FAILED: '⚠️ Phát hiện lỗi node: ',
    STARTING: '🔄 Đang thực hiện phục hồi task...',
    WEAK_RECOVERY: '🔵 Weak Recovery: Restart task trên node mới',
    STRONG_RECOVERY: '🟣 Strong Recovery: Resume từ checkpoint cuối cùng',
    SUCCESS: '✅ Phục hồi task thành công',
    FAILED: '❌ Phục hồi task thất bại',
    NO_NODES: '⚠️ Không có node khả dụng để phục hồi',
  }
} as const;
