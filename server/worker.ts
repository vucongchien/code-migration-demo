/**
 * =============================================================================
 * WORKER SERVER - Node Worker thực thi tasks
 * =============================================================================
 * 
 * Worker node kết nối đến Coordinator và thực thi các tasks được gán.
 * Hỗ trợ cả Weak và Strong Mobility.
 * 
 * Sử dụng: WORKER_NAME="Worker A" WORKER_ID="worker-a" node --loader ts-node/esm server/worker.ts
 */

import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, DEFAULT_CONFIG } from '../lib/constants';
import {
  generateId,
  logInfo,
  logSuccess,
  logError,
  logWarn,
  sleep,
  setLogHandler
} from '../lib/utils';
import { ExecutionRuntime, createExecutionRuntime } from '../lib/runtime/execution-runtime';
import type {
  NodeInfo,
  Task,
  ExecutionCheckpoint,
  CodeBundle,
  LogEntry,
  NodeStats
} from '../lib/types';
import * as os from 'os';

// =============================================================================
// CONFIGURATION
// =============================================================================

const WORKER_ID = process.env.WORKER_ID || `worker-${generateId().slice(0, 8)}`;
const WORKER_NAME = process.env.WORKER_NAME || `Worker ${WORKER_ID.slice(-8)}`;
const COORDINATOR_URL = process.env.COORDINATOR_URL || `http://localhost:${DEFAULT_CONFIG.COORDINATOR_PORT}`;
const WORKER_PORT = parseInt(process.env.WORKER_PORT || String(DEFAULT_CONFIG.WORKER_PORT));

/**
 * Lấy địa chỉ IP thực của máy Worker
 */
function getLocalIPAddress(): string {
  const networkInterfaces = os.networkInterfaces();

  for (const interfaceName of Object.keys(networkInterfaces)) {
    const interfaces = networkInterfaces[interfaceName];
    if (!interfaces) continue;

    for (const iface of interfaces) {
      // Bỏ qua IPv6 và loopback (127.0.0.1)
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return 'localhost'; // Fallback nếu không tìm thấy
}

const LOCAL_IP = getLocalIPAddress();

// =============================================================================
// WORKER CLIENT CLASS
// =============================================================================

class WorkerClient {
  private socket: Socket;
  private nodeInfo: NodeInfo;
  private currentRuntime: ExecutionRuntime | null = null;
  private currentTask: Task | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.nodeInfo = {
      id: WORKER_ID,
      name: WORKER_NAME,
      role: 'worker',
      status: 'offline',
      address: `${LOCAL_IP}:${WORKER_PORT}`,
      joinedAt: new Date(),
    };

    // Kết nối đến Coordinator
    this.socket = io(COORDINATOR_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 3000,
    });

    // Setup logging handler
    setLogHandler((level, context, message, data) => {
// Chỉ gửi log nếu đã kết nối
      if (this.socket.connected) {
        const logEntry: LogEntry = {
          id: generateId(),
          timestamp: new Date(),
          nodeId: this.nodeInfo.id,
          nodeName: this.nodeInfo.name,
          level,
          context,
          message,
          data
        };
        this.socket.emit(SOCKET_EVENTS.LOG_MESSAGE, logEntry);
      }
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Connection events
    this.socket.on('connect', () => {
      this.nodeInfo.status = 'online';
      logSuccess('Worker', `Đã kết nối đến Coordinator! Socket ID: ${this.socket.id}`);

      // Đăng ký với Coordinator
      this.registerWithCoordinator();

      // Bắt đầu heartbeat
      this.startHeartbeat();
    });

    this.socket.on('disconnect', (reason) => {
      this.nodeInfo.status = 'offline';
      logWarn('Worker', `Mất kết nối: ${reason}`);
      this.stopHeartbeat();
    });

    this.socket.on('connect_error', (error) => {
      logError('Worker', `Lỗi kết nối: ${error.message}`);
    });

    // Node events
    this.socket.on(SOCKET_EVENTS.NODE_REGISTERED, (data) => {
      logSuccess('Worker', `Đã đăng ký thành công với ID: ${data.nodeId}`);
    });

    // Task events
    this.socket.on(SOCKET_EVENTS.TASK_ASSIGN, async (data: {
      task: Task;
      codeBundle: CodeBundle;
      checkpoint?: ExecutionCheckpoint
    }) => {
      await this.handleTaskAssignment(data.task, data.codeBundle, data.checkpoint);
    });

    this.socket.on(SOCKET_EVENTS.TASK_PAUSE, async (data: { taskId: string; requireSnapshot?: boolean }) => {
      await this.handleTaskPause(data);
    });

    // Checkpoint events
    this.socket.on(SOCKET_EVENTS.CHECKPOINT_SAVE, (data: { taskId: string }) => {
      this.handleCheckpointRequest(data.taskId);
    });
  }

  /**
   * Đăng ký với Coordinator
   */
  private registerWithCoordinator(): void {
    logInfo('Worker', `Đăng ký: ${this.nodeInfo.name} (${this.nodeInfo.role})`);
    this.socket.emit(SOCKET_EVENTS.NODE_REGISTER, { nodeInfo: this.nodeInfo });
  }

  /**
   * Bắt đầu heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.socket.emit(SOCKET_EVENTS.NODE_HEARTBEAT, {
        nodeId: this.nodeInfo.id,
        timestamp: new Date(),
      });

      this.sendStats();
    }, DEFAULT_CONFIG.HEARTBEAT_INTERVAL);
  }

  /**
   * Gửi thống kê tài nguyên (CPU/RAM)
   */
  private sendStats(): void {
    const totalMem = os.totalmem() / (1024 * 1024); // MB
    const freeMem = os.freemem() / (1024 * 1024);   // MB
    const usedMem = totalMem - freeMem;

    // CPU Load (approximate)
    const cpus = os.cpus();
    const cpuUsage = 0; // Simplified for now, getting real CPU usage requires measuring over time

    const stats: NodeStats = {
      nodeId: this.nodeInfo.id,
timestamp: new Date(),
      cpuUsage: Math.random() * 100, // Mock CPU usage for demo as real calc is complex in one-shot
      memoryUsage: {
        used: Math.round(usedMem),
        total: Math.round(totalMem),
        percentage: Math.round((usedMem / totalMem) * 100),
      }
    };

    this.socket.emit(SOCKET_EVENTS.NODE_STATS, stats);
  }

  /**
   * Dừng heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ===========================================================================
  // TASK HANDLING
  // ===========================================================================

  private async handleTaskAssignment(
    task: Task,
    codeBundle: CodeBundle,
    checkpoint?: ExecutionCheckpoint
  ): Promise<void> {
    logInfo('Worker', `=== NHẬN TASK MỚI ===`);
    logInfo('Worker', `Task: ${task.name} (${task.id})`);
    logInfo('Worker', `Migration type: ${task.migrationType}`);

    if (checkpoint) {
      logInfo('Worker', `Resume từ checkpoint: step ${checkpoint.currentStep}`);
    } else {
      logInfo('Worker', `Bắt đầu từ đầu`);
    }

    // Cập nhật status
    this.nodeInfo.status = 'busy';
    this.socket.emit(SOCKET_EVENTS.NODE_STATUS_UPDATE, {
      nodeId: this.nodeInfo.id,
      status: 'busy',
    });

    this.currentTask = task;

    // Tạo runtime
    this.currentRuntime = createExecutionRuntime(task.id, this.nodeInfo.id, {
      checkpointConfig: {
        enabled: task.migrationType === 'strong',
        intervalSteps: DEFAULT_CONFIG.CHECKPOINT_INTERVAL_STEPS,
        saveOnPause: true,
      },
      callbacks: {
        onProgress: (progress) => {
          this.socket.emit(SOCKET_EVENTS.TASK_PROGRESS, {
            taskId: task.id,
            progress: Math.round((progress.currentStep / progress.totalSteps) * 100),
            currentStep: progress.currentStep,
            totalSteps: progress.totalSteps,
            message: progress.message,
          });
        },
        onCheckpoint: (cp) => {
          logInfo('Worker', `Checkpoint tạo: step ${cp.currentStep}`);
          this.socket.emit(SOCKET_EVENTS.CHECKPOINT_SAVED, { checkpoint: cp });
        },
        onComplete: (result) => {
          if (!result.data || !(result.data as { paused?: boolean }).paused) {
            logSuccess('Worker', `Task hoàn thành!`);
            this.socket.emit(SOCKET_EVENTS.TASK_COMPLETE, {
              taskId: task.id,
              result: result.data,
            });

            // Reset status
            this.nodeInfo.status = 'online';
            this.currentTask = null;
            this.currentRuntime = null;

            this.socket.emit(SOCKET_EVENTS.NODE_STATUS_UPDATE, {
              nodeId: this.nodeInfo.id,
              status: 'online',
            });
          }
        },
        onError: (error) => {
logError('Worker', `Task error: ${error.message}`);
          this.socket.emit(SOCKET_EVENTS.TASK_ERROR, {
            taskId: task.id,
            error: error.message,
          });
        },
      },
    });

    // Thực thi code
    try {
      const params = {
        startFrom: checkpoint?.currentStep ? checkpoint.currentStep + 1 : 1,
        endAt: DEFAULT_CONFIG.DEMO_TASK_TOTAL_STEPS,
        stepDelay: DEFAULT_CONFIG.DEMO_STEP_DELAY_MS,
      };

      await this.currentRuntime.execute(codeBundle.code, params, checkpoint);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError('Worker', `Execution error: ${err.message}`);
    }
  }

  private async handleTaskPause(data: { taskId: string; requireSnapshot?: boolean }): Promise<void> {
    logInfo('Worker', `=== PAUSE TASK ===`);
    logInfo('Worker', `Task ID: ${data.taskId}`);
    if (data.requireSnapshot) logInfo('Worker', `📸 Requesting Real-time Snapshot...`);

    if (!this.currentRuntime || !this.currentTask) {
      logWarn('Worker', 'Không có task đang chạy');
      return;
    }

    if (this.currentTask.id !== data.taskId) {
      logWarn('Worker', `Task ID không khớp: expected ${this.currentTask.id}`);
      return;
    }

    // Pause runtime (Runtime sẽ tự động tạo checkpoint nếu được config saveOnPause=true)
    // Nhưng để chắc chắn cho migration, ta sẽ force tạo checkpoint mới nhất
    const checkpoint = await this.currentRuntime.pause();

    this.nodeInfo.status = 'migrating';
    this.socket.emit(SOCKET_EVENTS.NODE_STATUS_UPDATE, {
      nodeId: this.nodeInfo.id,
      status: 'migrating',
    });

    logInfo('Worker', `Task paused, checkpoint: ${checkpoint?.id || 'none'}`);

    // Nếu migration yêu cầu snapshot tức thì (Strong Migration)
    if (data.requireSnapshot && checkpoint) {
      logInfo('Worker', `Sending snapshot for migration (Step: ${checkpoint.currentStep})`);
      this.socket.emit(SOCKET_EVENTS.CHECKPOINT_SAVED, { checkpoint });
    }
  }

  private handleCheckpointRequest(taskId: string): void {
    logInfo('Worker', `Yêu cầu lưu checkpoint: ${taskId}`);

    if (!this.currentRuntime || !this.currentTask) {
      logWarn('Worker', 'Không có task đang chạy');
      return;
    }

    const checkpoint = this.currentRuntime.getLatestCheckpoint();
    if (checkpoint) {
      this.socket.emit(SOCKET_EVENTS.CHECKPOINT_SAVED, { checkpoint });
    }
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  connect(): void {
    logInfo('Worker', `Đang kết nối đến Coordinator: ${COORDINATOR_URL}`);
    this.socket.connect();
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.socket.disconnect();
    logInfo('Worker', 'Đã ngắt kết nối');
  }

  getNodeInfo(): NodeInfo {
return { ...this.nodeInfo };
  }
}

// =============================================================================
// MAIN - Chạy worker
// =============================================================================

const worker = new WorkerClient();

logSuccess('Worker', `=================================`);
logSuccess('Worker', `  Worker Node Starting...`);
logSuccess('Worker', `  ID: ${WORKER_ID}`);
logSuccess('Worker', `  Name: ${WORKER_NAME}`);
logSuccess('Worker', `  Coordinator: ${COORDINATOR_URL}`);
logSuccess('Worker', `=================================`);

worker.connect();

// Graceful shutdown
process.on('SIGINT', () => {
  logInfo('Worker', 'Shutting down...');
  worker.disconnect();
  process.exit(0);
});