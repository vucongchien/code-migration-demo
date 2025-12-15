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
  
  // Logging & Stats
  LOG_MESSAGE: 'log:message',
  NODE_STATS: 'node:stats',
} as const;

// Export type cho event names
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

// =============================================================================
// DEFAULT CONFIGURATIONS - Cấu hình mặc định
// =============================================================================

export const DEFAULT_CONFIG = {
  // Coordinator defaults
  COORDINATOR_PORT: 3001,
  HEARTBEAT_TIMEOUT: 4000,        // 4 giây (Timeout cho heartbeat 1s)
  CHECK_INTERVAL: 2000,           // 2 giây

  // Worker defaults
  WORKER_PORT: 3002,
  HEARTBEAT_INTERVAL: 1000,       // 1 giây (Tăng tần suất để check CPU chính xác hơn)

  // Registry defaults
  REGISTRY_PORT: 3003,

  // Checkpoint defaults
  CHECKPOINT_INTERVAL_STEPS: 10,  // Mỗi 10 steps tạo 1 checkpoint

  // Auto Migration defaults
  AUTO_MIGRATION_CPU_THRESHOLD: 90, // % CPU
  AUTO_MIGRATION_DURATION_MS: 5000, // 5 giây liên tục

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

  /**
   * Demo tìm kiếm thời tiết (Giả lập I/O bound & API Latency)
   * Minh họa: Checkpoint lưu danh sách kết quả đã có, Resume bỏ qua cái đã xong.
   */
  WEATHER_SEARCH_TASK: `
// Demo Task: Tìm kiếm thời tiết các thành phố
// Mô phỏng I/O bound task với network latency
async function main(context) {
  const cities = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế', 'Nha Trang', 'Đà Lạt'];
  const { stepDelay = 1500 } = context.params;
  
  // Khôi phục state từ checkpoint (nếu có)
  // results: danh sách các thành phố đã lấy xong dữ liệu
  let results = context.checkpoint?.variables?.results || [];
  let processedCount = results.length;
  
  context.reportProgress({
    currentStep: processedCount,
    totalSteps: cities.length,
    message: processedCount > 0 
      ? \`Khôi phục: Đã có dữ liệu của \${processedCount} thành phố. Tiếp tục...\`
      : 'Bắt đầu tìm kiếm thời tiết...'
  });
  
  if (processedCount > 0) {
    await context.sleep(1000); // Delay để người dùng kịp đọc thông báo khôi phục
  }

  // Chỉ xử lý các thành phố chưa có trong results
  for (let i = processedCount; i < cities.length; i++) {
    const city = cities[i];
    
    // 1. Báo cáo đang xử lý
    context.reportProgress({
      currentStep: i,
      totalSteps: cities.length,
      message: \`Đang lấy dữ liệu thời tiết tại: \${city}...\`
    });
    
    // 2. Mock API Call (Giả lập latency mạng)
    await context.sleep(stepDelay); // Giả lập mạng chậm
    
    // Mock dữ liệu trả về logic ngẫu nhiên
    const temp = Math.floor(Math.random() * (35 - 20) + 20);
    const humidity = Math.floor(Math.random() * (90 - 60) + 60);
    const condition = ['Nắng', 'Mưa', 'Nhiều mây', 'Có giông'][Math.floor(Math.random() * 4)];
    
    const weatherData = { city, temp, humidity, condition, timestamp: Date.now() };
    results.push(weatherData);
    
    // 3. Quan trọng: Save Checkpoint ngay sau khi xong 1 unit of work (1 thành phố)
    // Lưu ý: Với task dạng này, ta nên save checkpoint SAU MỖI ITEM thành công
    // để đảm bảo không bao giờ phải gọi API lại cho item đó.
    await context.saveCheckpoint({
      currentStep: i + 1, // Đánh dấu là đã xong step này
      variables: { results } // Lưu toàn bộ mảng kết quả
    });
    
    context.reportProgress({
      currentStep: i + 1,
      totalSteps: cities.length,
      message: \`✅ Đã xong \${city}: \${temp}°C, \${condition}\`
    });

    // 4. Kiểm tra Pause
    if (context.isPaused()) {
      return { paused: true, at: city, currentResults: results.length };
    }
  }
  
  return { success: true, totalProcessed: results.length, data: results };
}
`,

  /**
   * Demo tính toán nặng (Prime Check) - CÓ Checkpoint
   * Minh họa: CPU bound task + Correct Checkpoint implementation
   */
  COMPLEX_COUNTING_TASK: `
// Demo Task: Tìm số nguyên tố (CPU Bound) - CÓ CHECKPOINT
// Minh họa Best Practice: Luôn check và save checkpoint trong vòng lặp nặng
async function main(context) {
  const { startFrom = 1, endAt = 500, stepDelay = 100 } = context.params;
  
  // Khôi phục state
  let current = context.checkpoint?.variables?.current || startFrom;
  let primesFound = context.checkpoint?.variables?.primesFound || [];
  
  function isPrime(num) {
    if (num <= 1) return false;
    if (num <= 3) return true;
    if (num % 2 === 0 || num % 3 === 0) return false;
    for (let i = 5; i * i <= num; i += 6) {
      if (num % i === 0 || num % (i + 2) === 0) return false;
    }
    return true;
  }

  while (current <= endAt) {
    // Logic tính toán
    const prime = isPrime(current);
    if (prime) {
      primesFound.push(current);
    }
    
    // Report UI
    context.reportProgress({
      currentStep: current,
      totalSteps: endAt,
      message: \`Checking \${current}... (Tìm thấy \${primesFound.length} số NT)\`
    });
    
    // --- CHECKPOINT SECTION ---
    // Vì đây là task nặng, ta nên check shouldCheckpoint thường xuyên
    if (context.shouldCheckpoint()) {
      await context.saveCheckpoint({
        currentStep: current,
        variables: { current, primesFound }
      });
    }
    // --------------------------
    
    await context.sleep(stepDelay); // Giúp dễ quan sát
    
    if (context.isPaused()) {
      return { paused: true, at: current, primesCount: primesFound.length };
    }
    
    current++;
  }
  
  return { success: true, totalPrimes: primesFound.length };
}
`,

  /**
   * Demo tính toán nặng - KHÔNG CÓ Checkpoint (Bad Practice)
   * Minh họa: Khi Developer quên implement checkpoint, Strong Migration sẽ fail (về logic) 
   * và hệ thống sẽ phải chạy lại từ đầu (như Weak Migration) khi sang node mới.
   */
  NO_CHECKPOINT_TASK: `
// Demo Task: Tìm số nguyên tố (CPU Bound) - KHÔNG CHECKPOINT
// Minh họa Bad Practice: Code không hỗ trợ lưu state
async function main(context) {
  const { startFrom = 1, endAt = 500, stepDelay = 100 } = context.params;
  
  // LỖI 1: Không check context.checkpoint để khôi phục
  // Khi resume ở node mới, nó sẽ luôn bắt đầu lại từ startFrom (1)
  let current = startFrom; 
  let primesFound = [];
  
  // Hàm check giống hệt bên trên
  function isPrime(num) {
    if (num <= 1) return false;
    if (num <= 3) return true;
    for (let i = 5; i * i <= num; i += 6) {
        if (num % i === 0 || num % (i + 2) === 0) return false;
    }
    return true;
  }

  while (current <= endAt) {
    if (isPrime(current)) primesFound.push(current);
    
    context.reportProgress({
      currentStep: current,
      totalSteps: endAt,
      message: \`Checking \${current}... (Tìm thấy \${primesFound.length} số NT)\`
    });
    
    // LỖI 2: Không gọi context.saveCheckpoint()
    // Hệ thống sẽ không bao giờ lưu được tiến độ trung gian.
    
    await context.sleep(stepDelay);
    
    if (context.isPaused()) {
      return { paused: true, at: current };
    }
    
    current++;
  }
  
  return { success: true, totalPrimes: primesFound.length };
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
