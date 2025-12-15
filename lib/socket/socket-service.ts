/**
 * =============================================================================
 * SOCKET SERVICE - WebSocket communication cho các nodes
 * =============================================================================
 * 
 * Service này cung cấp:
 * - Client connection đến Coordinator
 * - Event handling cho migration
 * - Real-time updates
 */

import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, DEFAULT_CONFIG } from '../constants';
import { generateId, logInfo, logSuccess, logError, logWarn } from '../utils';
import type { 
  NodeInfo, 
  NodeRole, 
  Task, 
  MigrationEvent,
  ExecutionCheckpoint,
  CodeBundle 
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface SocketServiceCallbacks {
  // Connection events
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  
  // Node events
  onNodeListUpdate?: (nodes: NodeInfo[]) => void;
  onNodeStatusUpdate?: (nodeId: string, status: NodeInfo['status']) => void;
  
  // Task events
  onTaskAssigned?: (task: Task, codeBundle: CodeBundle, checkpoint?: ExecutionCheckpoint) => void;
  onTaskProgress?: (taskId: string, progress: number, message?: string) => void;
  onTaskComplete?: (taskId: string, result: unknown) => void;
  onTaskPause?: (taskId: string) => void;
  
  // Migration events
  onMigrationRequest?: (taskId: string, targetNodeId: string, migrationType: 'weak' | 'strong') => void;
  onMigrationEvent?: (event: MigrationEvent) => void;
  
  // Checkpoint events
  onCheckpointRequest?: (taskId: string) => void;
  onCheckpointReceived?: (checkpoint: ExecutionCheckpoint) => void;
  
  // System events
  onSystemUpdate?: (data: unknown) => void;
}

export interface SocketServiceConfig {
  serverUrl: string;
  nodeInfo: Omit<NodeInfo, 'joinedAt' | 'lastPing' | 'status'>;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

// =============================================================================
// SOCKET SERVICE CLASS
// =============================================================================

export class SocketService {
  private socket: Socket | null = null;
  private config: SocketServiceConfig;
  private callbacks: SocketServiceCallbacks;
  private isConnected: boolean = false;
  private nodeInfo: NodeInfo;

  constructor(config: SocketServiceConfig, callbacks?: SocketServiceCallbacks) {
    this.config = {
      autoReconnect: true,
      reconnectDelay: 3000,
      ...config,
    };
    
    this.callbacks = callbacks || {};
    
    this.nodeInfo = {
      ...config.nodeInfo,
      status: 'offline',
      joinedAt: new Date(),
    };
  }

  /**
   * Kết nối đến Coordinator server
   */
  connect(): void {
    if (this.socket?.connected) {
      logWarn('Socket', 'Đã kết nối rồi');
      return;
    }

    logInfo('Socket', `Đang kết nối đến ${this.config.serverUrl}...`);

    this.socket = io(this.config.serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: this.config.autoReconnect,
      reconnectionDelay: this.config.reconnectDelay,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.nodeInfo.status = 'online';
      logSuccess('Socket', `Đã kết nối thành công! Socket ID: ${this.socket?.id}`);
      
      // Đăng ký node với coordinator
      this.registerNode();
      
      this.callbacks.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.nodeInfo.status = 'offline';
      logWarn('Socket', `Mất kết nối: ${reason}`);
      this.callbacks.onDisconnect?.(reason);
    });

    this.socket.on('connect_error', (error) => {
      logError('Socket', 'Lỗi kết nối:', error.message);
      this.callbacks.onError?.(error);
    });

    // Node events
    this.socket.on(SOCKET_EVENTS.NODE_REGISTERED, (data) => {
      logSuccess('Socket', `Node đã được đăng ký: ${data.nodeId}`);
    });

    this.socket.on(SOCKET_EVENTS.NODE_LIST_UPDATE, (nodes: NodeInfo[]) => {
      logInfo('Socket', `Cập nhật danh sách nodes: ${nodes.length} nodes`);
      this.callbacks.onNodeListUpdate?.(nodes);
    });

    this.socket.on(SOCKET_EVENTS.NODE_STATUS_UPDATE, (data: { nodeId: string; status: NodeInfo['status'] }) => {
      this.callbacks.onNodeStatusUpdate?.(data.nodeId, data.status);
    });

    // Task events
    this.socket.on(SOCKET_EVENTS.TASK_ASSIGN, (data: { 
      task: Task; 
      codeBundle: CodeBundle; 
      checkpoint?: ExecutionCheckpoint 
    }) => {
      logInfo('Socket', `Nhận task mới: ${data.task.name}`);
      this.callbacks.onTaskAssigned?.(data.task, data.codeBundle, data.checkpoint);
    });

    this.socket.on(SOCKET_EVENTS.TASK_PROGRESS, (data: { 
      taskId: string; 
      progress: number; 
      message?: string 
    }) => {
      this.callbacks.onTaskProgress?.(data.taskId, data.progress, data.message);
    });

    this.socket.on(SOCKET_EVENTS.TASK_COMPLETE, (data: { taskId: string; result: unknown }) => {
      logInfo('Socket', `Task hoàn thành: ${data.taskId}`);
      this.callbacks.onTaskComplete?.(data.taskId, data.result);
    });

    this.socket.on(SOCKET_EVENTS.TASK_PAUSE, (data: { taskId: string }) => {
      logInfo('Socket', `Task pause: ${data.taskId}`);
      this.callbacks.onTaskPause?.(data.taskId);
    });

    // Migration events
    this.socket.on(SOCKET_EVENTS.MIGRATION_REQUEST, (data: {
      taskId: string;
      targetNodeId: string;
      migrationType: 'weak' | 'strong';
    }) => {
      logInfo('Socket', `Nhận yêu cầu migration: ${data.migrationType}`);
      this.callbacks.onMigrationRequest?.(data.taskId, data.targetNodeId, data.migrationType);
    });

    this.socket.on(SOCKET_EVENTS.BROADCAST_EVENT, (event: MigrationEvent) => {
      this.callbacks.onMigrationEvent?.(event);
    });

    // Checkpoint events
    this.socket.on(SOCKET_EVENTS.CHECKPOINT_SAVE, (data: { taskId: string }) => {
      logInfo('Socket', `Yêu cầu lưu checkpoint: ${data.taskId}`);
      this.callbacks.onCheckpointRequest?.(data.taskId);
    });

    this.socket.on(SOCKET_EVENTS.CHECKPOINT_LOADED, (checkpoint: ExecutionCheckpoint) => {
      logInfo('Socket', `Nhận checkpoint: step ${checkpoint.currentStep}`);
      this.callbacks.onCheckpointReceived?.(checkpoint);
    });

    // System events
    this.socket.on(SOCKET_EVENTS.SYSTEM_UPDATE, (data: unknown) => {
      this.callbacks.onSystemUpdate?.(data);
    });
  }

  /**
   * Đăng ký node với Coordinator
   */
  private registerNode(): void {
    if (!this.socket) return;
    
    logInfo('Socket', `Đăng ký node: ${this.nodeInfo.name} (${this.nodeInfo.role})`);
    this.socket.emit(SOCKET_EVENTS.NODE_REGISTER, { nodeInfo: this.nodeInfo });
  }

  /**
   * Gửi heartbeat
   */
  sendHeartbeat(): void {
    if (!this.socket || !this.isConnected) return;
    
    this.socket.emit(SOCKET_EVENTS.NODE_HEARTBEAT, {
      nodeId: this.nodeInfo.id,
      timestamp: new Date(),
    });
  }

  /**
   * Bắt đầu auto heartbeat
   */
  startHeartbeat(intervalMs: number = DEFAULT_CONFIG.HEARTBEAT_INTERVAL): NodeJS.Timeout {
    return setInterval(() => this.sendHeartbeat(), intervalMs);
  }

  // ===========================================================================
  // EMIT METHODS - Gửi events
  // ===========================================================================

  /**
   * Submit task mới
   */
  submitTask(task: Task): void {
    if (!this.socket) return;
    logInfo('Socket', `Submit task: ${task.name}`);
    this.socket.emit(SOCKET_EVENTS.TASK_SUBMIT, { task });
  }

  /**
   * Báo cáo tiến độ task
   */
  reportProgress(taskId: string, progress: number, currentStep: number, totalSteps: number, message?: string): void {
    if (!this.socket) return;
    this.socket.emit(SOCKET_EVENTS.TASK_PROGRESS, {
      taskId,
      progress,
      currentStep,
      totalSteps,
      message,
    });
  }

  /**
   * Báo cáo task hoàn thành
   */
  reportComplete(taskId: string, result: unknown): void {
    if (!this.socket) return;
    logInfo('Socket', `Báo cáo task hoàn thành: ${taskId}`);
    this.socket.emit(SOCKET_EVENTS.TASK_COMPLETE, { taskId, result });
  }

  /**
   * Yêu cầu migration
   */
  requestMigration(taskId: string, sourceNodeId: string, targetNodeId: string, migrationType: 'weak' | 'strong'): void {
    if (!this.socket) return;
    logInfo('Socket', `Yêu cầu ${migrationType} migration cho task ${taskId}`);
    this.socket.emit(SOCKET_EVENTS.MIGRATION_REQUEST, {
      taskId,
      sourceNodeId,
      targetNodeId,
      migrationType,
    });
  }

  /**
   * Gửi checkpoint
   */
  sendCheckpoint(checkpoint: ExecutionCheckpoint): void {
    if (!this.socket) return;
    logInfo('Socket', `Gửi checkpoint: step ${checkpoint.currentStep}`);
    this.socket.emit(SOCKET_EVENTS.CHECKPOINT_SAVED, { checkpoint });
  }

  /**
   * Broadcast event đến tất cả nodes
   */
  broadcastEvent(event: MigrationEvent): void {
    if (!this.socket) return;
    this.socket.emit(SOCKET_EVENTS.BROADCAST_EVENT, event);
  }

  /**
   * Cập nhật trạng thái node
   */
  updateStatus(status: NodeInfo['status']): void {
    if (!this.socket) return;
    this.nodeInfo.status = status;
    this.socket.emit(SOCKET_EVENTS.NODE_STATUS_UPDATE, {
      nodeId: this.nodeInfo.id,
      status,
    });
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Ngắt kết nối
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  isSocketConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Lấy thông tin node hiện tại
   */
  getNodeInfo(): NodeInfo {
    return { ...this.nodeInfo };
  }

  /**
   * Lấy socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Cập nhật callbacks
   */
  setCallbacks(callbacks: Partial<SocketServiceCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Tạo socket service mới
 */
export function createSocketService(
  serverUrl: string,
  nodeId: string,
  nodeName: string,
  role: NodeRole,
  callbacks?: SocketServiceCallbacks
): SocketService {
  return new SocketService(
    {
      serverUrl,
      nodeInfo: {
        id: nodeId,
        name: nodeName,
        role,
        address: '',
      },
    },
    callbacks
  );
}
