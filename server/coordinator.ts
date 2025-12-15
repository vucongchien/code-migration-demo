/**
 * =============================================================================
 * COORDINATOR SERVER - Socket.io Server cho Node Coordinator
 * =============================================================================
 * 
 * Server này chạy như một Node.js server riêng biệt (không phải Next.js API route)
 * vì Next.js không hỗ trợ WebSocket long-running connections trong API routes.
 * 
 * Sử dụng: node --loader ts-node/esm server/coordinator.ts
 * Hoặc:   npx ts-node server/coordinator.ts
 */

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, DEFAULT_CONFIG, MIGRATION_MESSAGES } from '../lib/constants';
import { generateId, logInfo, logSuccess, logError, logWarn, setLogHandler, createMigrationEvent } from '../lib/utils';
import { getRegistry } from '../lib/registry/code-registry';
import { MigrationManager } from '../lib/migration/migration-manager';
import type { 
  NodeInfo,
  Task, 
  MigrationEvent,
  ExecutionCheckpoint,
  CodeBundle,
  LogEntry,
  NodeStats
} from '../lib/types';
import { TaskRecoveryManager } from '../lib/recovery/task-recovery-manager';

// =============================================================================
// TYPES
// =============================================================================

interface ConnectedNode {
  socket: Socket;
  info: NodeInfo;
  lastPing: Date;
}

// =============================================================================
// COORDINATOR SERVER CLASS
// =============================================================================

class CoordinatorServer {
  private httpServer: ReturnType<typeof createServer>;
  private io: Server;
  private nodes: Map<string, ConnectedNode> = new Map();
  private tasks: Map<string, Task> = new Map();
  private nodeStatsHistory: Map<string, NodeStats[]> = new Map();
  private registry = getRegistry();
  private migrationManager: MigrationManager;
  private recoveryManager: TaskRecoveryManager;
  private port: number;

  constructor(port: number = DEFAULT_CONFIG.COORDINATOR_PORT) {
    this.port = port;
    
    // Tạo HTTP server
    this.httpServer = createServer((req, res) => {
      // Simple health check endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', nodes: this.nodes.size }));
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
    });

    // Tạo Socket.io server
    this.io = new Server(this.httpServer, {
      cors: {
        origin: '*', // Cho phép tất cả origins (dev mode)
        methods: ['GET', 'POST'],
      },
    });

    // Tạo migration manager với callbacks
    this.migrationManager = new MigrationManager({
      onEvent: (event) => this.broadcastEvent(event),
      onComplete: (result) => {
        logInfo('Coordinator', `Migration hoàn thành: ${result.success ? 'thành công' : 'thất bại'}`);
      },
    });

    // Tạo recovery manager
    this.recoveryManager = new TaskRecoveryManager({
      tasks: this.tasks,
      nodes: this.nodes,
      findAvailableWorker: () => this.findAvailableWorker(),
      assignTaskToNode: (task, worker, checkpoint) => this.assignTaskToNode(task, worker, checkpoint),
      broadcastEvent: (event) => this.broadcastEvent(event),
    });

    // Setup logging handler
    setLogHandler((level, context, message, data) => {
      // Broadcast log cho monitor
      const logEntry: LogEntry = {
        id: generateId(),
        timestamp: new Date(),
        nodeId: 'coordinator',
        nodeName: 'Coordinator',
        level,
        context,
        message,
        data
      };
      
      this.io.to('monitor').emit(SOCKET_EVENTS.LOG_MESSAGE, logEntry);
    });

    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      logInfo('Coordinator', `New connection: ${socket.id}`);

      // Node đăng ký
      socket.on(SOCKET_EVENTS.NODE_REGISTER, (data: { nodeInfo: NodeInfo }) => {
        this.handleNodeRegister(socket, data.nodeInfo);
        
        // Nếu là monitor, join room 'monitor'
        if (data.nodeInfo.role === 'monitor') {
          socket.join('monitor');
        }
      });

      // Node heartbeat
      socket.on(SOCKET_EVENTS.NODE_HEARTBEAT, (data: { nodeId: string }) => {
        this.handleHeartbeat(data.nodeId);
      });

      // Node status update
      socket.on(SOCKET_EVENTS.NODE_STATUS_UPDATE, (data: { nodeId: string; status: NodeInfo['status'] }) => {
        this.handleStatusUpdate(data.nodeId, data.status);
      });

      // Task submit
      socket.on(SOCKET_EVENTS.TASK_SUBMIT, (data: { task: Task }) => {
        this.handleTaskSubmit(socket, data.task);
      });

      // Task progress
      socket.on(SOCKET_EVENTS.TASK_PROGRESS, (data: {
        taskId: string;
        progress: number;
        currentStep: number;
        totalSteps: number;
        message?: string;
      }) => {
        this.handleTaskProgress(data);
      });

      // Task complete
      socket.on(SOCKET_EVENTS.TASK_COMPLETE, (data: { taskId: string; result: unknown }) => {
        this.handleTaskComplete(data.taskId, data.result);
      });

      // Migration request
      socket.on(SOCKET_EVENTS.MIGRATION_REQUEST, (data: {
        taskId: string;
        sourceNodeId: string;
        targetNodeId: string;
        migrationType: 'weak' | 'strong';
      }) => {
        this.handleMigrationRequest(data);
      });

      // Checkpoint saved
      socket.on(SOCKET_EVENTS.CHECKPOINT_SAVED, (data: { checkpoint: ExecutionCheckpoint }) => {
        this.handleCheckpointSaved(data.checkpoint);
      });

      // Log message from worker
      socket.on(SOCKET_EVENTS.LOG_MESSAGE, (logEntry: LogEntry) => {
        // Forward to monitors
        this.io.to('monitor').emit(SOCKET_EVENTS.LOG_MESSAGE, logEntry);
      });

      // Node stats from worker
      socket.on(SOCKET_EVENTS.NODE_STATS, (stats: NodeStats) => {
        this.handleNodeStats(stats);
      });

      // Disconnect
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });
    });
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  private handleNodeRegister(socket: Socket, nodeInfo: NodeInfo): void {
    const fullNodeInfo: NodeInfo = {
      ...nodeInfo,
      status: 'online',
      joinedAt: new Date(),
      lastPing: new Date(),
    };

    this.nodes.set(nodeInfo.id, {
      socket,
      info: fullNodeInfo,
      lastPing: new Date(),
    });

    logSuccess('Coordinator', `Node registered: ${nodeInfo.name} (${nodeInfo.role}) - ID: ${nodeInfo.id}`);

    // Gửi xác nhận
    socket.emit(SOCKET_EVENTS.NODE_REGISTERED, { nodeId: nodeInfo.id });

    // Broadcast danh sách nodes mới
    this.broadcastNodeList();
  }

  private handleHeartbeat(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.lastPing = new Date();
      node.info.lastPing = new Date();
    }
  }

  private handleStatusUpdate(nodeId: string, status: NodeInfo['status']): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.info.status = status;
      logInfo('Coordinator', `Node ${nodeId} status: ${status}`);
      this.broadcastNodeList();
    }
  }

  private handleTaskSubmit(socket: Socket, task: Task): void {
    // Lưu task
    this.tasks.set(task.id, task);
    logInfo('Coordinator', `Task submitted: ${task.name} (${task.id})`);

    // Tìm worker available
    const worker = this.findAvailableWorker();
    if (!worker) {
      logWarn('Coordinator', 'Không có worker available');
      socket.emit(SOCKET_EVENTS.TASK_ERROR, { 
        taskId: task.id, 
        error: 'Không có worker available' 
      });
      return;
    }

    // Lấy code bundle
    const codeBundle = this.registry.getBundle('counting-task');
    if (!codeBundle) {
      logError('Coordinator', 'Không tìm thấy code bundle');
      return;
    }

    // Gán task cho worker
    this.assignTaskToNode(task, worker);

    // Confirm cho submitter
    socket.emit(SOCKET_EVENTS.TASK_SUBMITTED, { taskId: task.id, assignedTo: worker.info.id });

    // Broadcast updates
    this.broadcastSystemUpdate();
  }

  /**
   * Helper: Assign task to specific worker
   */
  public assignTaskToNode(task: Task, worker: ConnectedNode, checkpoint?: ExecutionCheckpoint): void {
    const codeBundle = this.registry.getBundle('counting-task');
    if (!codeBundle) return;

    task.status = 'running';
    task.currentNodeId = worker.info.id;
    task.startedAt = new Date(); // Reset start time
    worker.info.status = 'busy';

    logInfo('Coordinator', `Gán task ${task.id} cho worker ${worker.info.name}`);

    worker.socket.emit(SOCKET_EVENTS.TASK_ASSIGN, {
      task,
      codeBundle,
      checkpoint,
    });



    // Broadcast updates
    this.broadcastSystemUpdate();
  }

  private handleTaskProgress(data: {
    taskId: string;
    progress: number;
    currentStep: number;
    totalSteps: number;
    message?: string;
  }): void {
    const task = this.tasks.get(data.taskId);
    if (task) {
      task.progress = data.progress;
    }

    // Broadcast đến tất cả nodes (để monitor hiển thị)
    this.io.emit(SOCKET_EVENTS.TASK_PROGRESS, data);
  }

  private handleTaskComplete(taskId: string, result: unknown): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = {
        success: true,
        data: result,
        executionTime: task.startedAt 
          ? Date.now() - task.startedAt.getTime() 
          : 0,
      };

      // Cập nhật worker status
      const worker = this.nodes.get(task.currentNodeId || '');
      if (worker) {
        worker.info.status = 'online';
      }

      logSuccess('Coordinator', `Task ${taskId} completed`);
    }

    // Broadcast
    this.io.emit(SOCKET_EVENTS.TASK_COMPLETE, { taskId, result });
    this.broadcastSystemUpdate();
  }

  private async handleMigrationRequest(data: {
    taskId: string;
    sourceNodeId: string;
    targetNodeId: string;
    migrationType: 'weak' | 'strong';
  }): Promise<void> {
    const task = this.tasks.get(data.taskId);
    if (!task) {
      logError('Coordinator', `Task không tồn tại: ${data.taskId}`);
      return;
    }

    const sourceNode = this.nodes.get(data.sourceNodeId);
    const targetNode = this.nodes.get(data.targetNodeId);

    if (!sourceNode || !targetNode) {
      logError('Coordinator', 'Source hoặc target node không tồn tại');
      return;
    }

    logInfo('Coordinator', `Bắt đầu ${data.migrationType} migration`);
    logInfo('Coordinator', `${sourceNode.info.name} → ${targetNode.info.name}`);

    // Pause task trên source
    sourceNode.socket.emit(SOCKET_EVENTS.TASK_PAUSE, { taskId: data.taskId });
    task.status = 'migrating';

    // Lấy code bundle
    const codeBundle = this.registry.getBundle('counting-task');
    if (!codeBundle) {
      logError('Coordinator', 'Không tìm thấy code bundle');
      return;
    }

    // Lấy checkpoint (cho Strong Mobility)
    let checkpoint: ExecutionCheckpoint | undefined;
    if (data.migrationType === 'strong') {
      // Yêu cầu source lưu checkpoint
      sourceNode.socket.emit(SOCKET_EVENTS.CHECKPOINT_SAVE, { taskId: data.taskId });
      
      // Đợi một chút để nhận checkpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      checkpoint = this.registry.getLatestCheckpoint(data.taskId);
    }

    // Thực hiện migration
    const result = await this.migrationManager.executeMigration({
      taskId: data.taskId,
      task,
      codeBundle,
      sourceNodeId: data.sourceNodeId,
      targetNodeId: data.targetNodeId,
      migrationType: data.migrationType,
      checkpoint,
    });

    if (result.success) {
      // Cập nhật task
      task.currentNodeId = data.targetNodeId;
      task.status = 'running';
      
      // Cập nhật node statuses
      sourceNode.info.status = 'online';
      targetNode.info.status = 'busy';

      // Gửi task đến target node
      targetNode.socket.emit(SOCKET_EVENTS.TASK_ASSIGN, {
        task,
        codeBundle,
        checkpoint: data.migrationType === 'strong' ? checkpoint : undefined,
      });
    }

    this.broadcastSystemUpdate();
  }

  private handleCheckpointSaved(checkpoint: ExecutionCheckpoint): void {
    this.registry.saveCheckpoint(checkpoint);
    logInfo('Coordinator', `Checkpoint saved: ${checkpoint.id} at step ${checkpoint.currentStep}`);
    
    // Broadcast checkpoint event
    this.io.emit(SOCKET_EVENTS.CHECKPOINT_SAVED, { checkpoint });
  }

  private handleDisconnect(socket: Socket, reason: string): void {
    // Tìm và xóa node
    for (const [nodeId, node] of this.nodes) {
      if (node.socket.id === socket.id) {
        logWarn('Coordinator', `Node disconnected: ${node.info.name} - Reason: ${reason}`);
        
        // Trigger recovery nếu node đang online/busy mà disconnect
        if (node.info.status !== 'offline') {
           this.recoveryManager.handleNodeFailure(nodeId, node.info.name);
        }

        this.nodes.delete(nodeId);
        break;
      }
    }

    this.broadcastNodeList();
  }

  private handleNodeStats(stats: NodeStats): void {
    // 1. Broadcast to monitors
    this.io.to('monitor').emit(SOCKET_EVENTS.NODE_STATS, stats);

    // 2. Store stats
    if (!this.nodeStatsHistory.has(stats.nodeId)) {
      this.nodeStatsHistory.set(stats.nodeId, []);
    }
    const history = this.nodeStatsHistory.get(stats.nodeId)!;
    
    // Convert string timestamp to Date if needed
    const statsWithDate = {
        ...stats,
        timestamp: new Date(stats.timestamp)
    };
    history.push(statsWithDate);

    // 3. Prune old stats (keep last 30s)
    const now = Date.now();
    const thirtySecondsAgo = now - 30000;
    while(history.length > 0 && history[0].timestamp.getTime() < thirtySecondsAgo) {
      history.shift();
    }

    // 4. Check migration rules
    this.checkAutoMigration(stats.nodeId);
  }

  private async checkAutoMigration(nodeId: string): Promise<void> {
    const history = this.nodeStatsHistory.get(nodeId);
    if (!history) return;

    // Filter stats trong window duration (5s)
    const now = Date.now();
    const windowStart = now - DEFAULT_CONFIG.AUTO_MIGRATION_DURATION_MS;
    
    const relevantStats = history.filter(s => s.timestamp.getTime() >= windowStart);

    // Nếu chưa đủ dữ liệu (VD: mới chạy 1s) -> skip
    // Cần ít nhất 80% số mẫu expected trong khoảng thời gian đó
    // (VD: 5s, interval 1s => expected 5 mẫu. Có > 3 mẫu là ok)
    const expectedSamples = DEFAULT_CONFIG.AUTO_MIGRATION_DURATION_MS / DEFAULT_CONFIG.HEARTBEAT_INTERVAL;
    if (relevantStats.length < expectedSamples * 0.8) return;

    // Check CPU threshold
    const isOverloaded = relevantStats.every(s => s.cpuUsage > DEFAULT_CONFIG.AUTO_MIGRATION_CPU_THRESHOLD);

    if (isOverloaded) {
      // Tìm task đang chạy trên node này
      const runningTask = Array.from(this.tasks.values()).find(
        t => t.currentNodeId === nodeId && t.status === 'running'
      );

      if (runningTask) {
        logWarn('Coordinator', `⚠️ Node ${nodeId} quá tải (CPU > ${DEFAULT_CONFIG.AUTO_MIGRATION_CPU_THRESHOLD}%). Kích hoạt Auto Migration!`);

        // Tìm node đích
        const targetNode = this.findAutoMigrationTarget(nodeId);
        
        if (targetNode) {
          // Trigger Strong Migration
          await this.handleMigrationRequest({
            taskId: runningTask.id,
            sourceNodeId: nodeId,
            targetNodeId: targetNode.info.id,
            migrationType: 'strong' // Luôn dùng Strong cho Auto Migration
          });

          // Clear history để không trigger liên tục
          this.nodeStatsHistory.set(nodeId, []);
        } else {
          logWarn('Coordinator', 'Không tìm thấy node đích phù hợp để di trú.');
        }
      }
    }
  }

  private findAutoMigrationTarget(excludeNodeId: string): ConnectedNode | undefined {
    // Tìm worker online, khác node nguồn, và (lý tưởng nhất) là không quá tải
    // Ở đây demo simple: cứ khác node nguồn là được
    for (const node of this.nodes.values()) {
      if (
        node.info.role === 'worker' && 
        node.info.status === 'online' && 
        node.info.id !== excludeNodeId
      ) {
        return node;
      }
    }
    return undefined;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private findAvailableWorker(): ConnectedNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.info.role === 'worker' && node.info.status === 'online') {
        return node;
      }
    }
    return undefined;
  }

  private getNodeList(): NodeInfo[] {
    return Array.from(this.nodes.values()).map(n => n.info);
  }

  private broadcastNodeList(): void {
    const nodes = this.getNodeList();
    this.io.emit(SOCKET_EVENTS.NODE_LIST_UPDATE, nodes);
  }

  private broadcastEvent(event: MigrationEvent): void {
    this.io.emit(SOCKET_EVENTS.BROADCAST_EVENT, event);
  }

  private broadcastSystemUpdate(): void {
    const data = {
      nodes: this.getNodeList(),
      tasks: Array.from(this.tasks.values()),
      registryStats: this.registry.getStats(),
    };
    this.io.emit(SOCKET_EVENTS.SYSTEM_UPDATE, data);
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  start(): void {
    this.httpServer.listen(this.port, () => {
      logSuccess('Coordinator', `=================================`);
      logSuccess('Coordinator', `  Coordinator Server Started!`);
      logSuccess('Coordinator', `  Port: ${this.port}`);
      logSuccess('Coordinator', `  http://localhost:${this.port}`);
      logSuccess('Coordinator', `=================================`);
    });

    // Heartbeat check interval
    setInterval(() => {
      const now = Date.now();
      for (const [nodeId, node] of this.nodes) {
        const timeSinceLastPing = now - node.lastPing.getTime();
        if (timeSinceLastPing > DEFAULT_CONFIG.HEARTBEAT_TIMEOUT) {
          logWarn('Coordinator', `Node ${node.info.name} timed out`);
          
          if (node.info.status !== 'offline') {
             node.info.status = 'offline';
             this.broadcastNodeList();
             
             // Trigger recovery
             this.recoveryManager.handleNodeFailure(nodeId, node.info.name);
          }
        }
      }
    }, DEFAULT_CONFIG.CHECK_INTERVAL);
  }

  stop(): void {
    this.io.close();
    this.httpServer.close();
    logInfo('Coordinator', 'Server stopped');
  }
}

// =============================================================================
// MAIN - Chạy server
// =============================================================================

const port = parseInt(process.env.COORDINATOR_PORT || String(DEFAULT_CONFIG.COORDINATOR_PORT));
const server = new CoordinatorServer(port);
server.start();

// Graceful shutdown
process.on('SIGINT', () => {
  logInfo('Coordinator', 'Shutting down...');
  server.stop();
  process.exit(0);
});
