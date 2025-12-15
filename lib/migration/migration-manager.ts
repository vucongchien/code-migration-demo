/**
 * =============================================================================
 * MIGRATION MANAGER - Quản lý quá trình migration
 * =============================================================================
 * 
 * Đây là module chịu trách nhiệm orchestrate quá trình migration:
 * - Weak Mobility: Chỉ transfer code
 * - Strong Mobility: Transfer code + execution state
 */

import { 
  generateId, 
  createMigrationEvent,
  logInfo,
  logSuccess,
  logError,
  logWarn 
} from '../utils';
import { MIGRATION_MESSAGES } from '../constants';
import type { 
  Task, 
  ExecutionCheckpoint, 
  CodeBundle,
  MigrationType,
  MigrationEvent,
  NodeInfo 
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Kết quả của quá trình migration
 */
export interface MigrationResult {
  success: boolean;
  migrationType: MigrationType;
  sourceNodeId: string;
  targetNodeId: string;
  taskId: string;
  checkpoint?: ExecutionCheckpoint;
  error?: string;
  duration: number;
  events: MigrationEvent[];
}

/**
 * Request migration
 */
export interface MigrationRequest {
  taskId: string;
  task: Task;
  codeBundle: CodeBundle;
  sourceNodeId: string;
  targetNodeId: string;
  migrationType: MigrationType;
  checkpoint?: ExecutionCheckpoint;  // Có nếu là Strong mobility
}

/**
 * Callbacks trong quá trình migration
 */
export interface MigrationCallbacks {
  /** Gọi khi có event mới */
  onEvent?: (event: MigrationEvent) => void;
  /** Gọi khi migration hoàn thành */
  onComplete?: (result: MigrationResult) => void;
  /** Gọi khi cần gửi message đến node */
  sendToNode?: (nodeId: string, event: string, data: unknown) => void;
}

// =============================================================================
// MIGRATION MANAGER CLASS
// =============================================================================

export class MigrationManager {
  private events: MigrationEvent[] = [];
  private callbacks: MigrationCallbacks;

  constructor(callbacks?: MigrationCallbacks) {
    this.callbacks = callbacks || {};
  }

  /**
   * Thực hiện Weak Migration
   * - Dừng task trên source
   * - Transfer code sang target
   * - Restart task từ đầu trên target
   */
  async executeWeakMigration(request: MigrationRequest): Promise<MigrationResult> {
    const startTime = Date.now();
    this.events = [];

    logInfo('Migration', `=== BẮT ĐẦU WEAK MIGRATION ===`);
    logInfo('Migration', `Task: ${request.taskId}`);
    logInfo('Migration', `Source: ${request.sourceNodeId} → Target: ${request.targetNodeId}`);

    try {
      // Step 1: Migration requested
      this.emitEvent(request.taskId, 'migration_requested', 
        request.sourceNodeId, request.targetNodeId, 'weak',
        MIGRATION_MESSAGES.WEAK.REQUESTED
      );

      // Step 2: Stop source (nếu có callback gửi message)
      this.emitEvent(request.taskId, 'migration_started',
        request.sourceNodeId, request.targetNodeId, 'weak',
        MIGRATION_MESSAGES.WEAK.STOPPING_SOURCE
      );
      
      // Simulate stopping source
      await this.delay(500);

      // Step 3: Transfer code
      this.emitEvent(request.taskId, 'code_transferred',
        request.sourceNodeId, request.targetNodeId, 'weak',
        MIGRATION_MESSAGES.WEAK.TRANSFERRING_CODE,
        { bundleId: request.codeBundle.id, bundleName: request.codeBundle.name }
      );
      
      await this.delay(300);

      // Step 4: Start on target (từ đầu - không có checkpoint)
      this.emitEvent(request.taskId, 'execution_resumed',
        request.sourceNodeId, request.targetNodeId, 'weak',
        MIGRATION_MESSAGES.WEAK.STARTING_TARGET,
        { startFrom: 1 }
      );

      // Step 5: Migration complete
      this.emitEvent(request.taskId, 'migration_completed',
        request.sourceNodeId, request.targetNodeId, 'weak',
        MIGRATION_MESSAGES.WEAK.COMPLETED
      );

      const result: MigrationResult = {
        success: true,
        migrationType: 'weak',
        sourceNodeId: request.sourceNodeId,
        targetNodeId: request.targetNodeId,
        taskId: request.taskId,
        duration: Date.now() - startTime,
        events: [...this.events],
      };

      logSuccess('Migration', `Weak Migration hoàn thành trong ${result.duration}ms`);
      this.callbacks.onComplete?.(result);
      return result;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError('Migration', 'Weak Migration thất bại:', err.message);

      this.emitEvent(request.taskId, 'migration_failed',
        request.sourceNodeId, request.targetNodeId, 'weak',
        `Migration thất bại: ${err.message}`
      );

      return {
        success: false,
        migrationType: 'weak',
        sourceNodeId: request.sourceNodeId,
        targetNodeId: request.targetNodeId,
        taskId: request.taskId,
        error: err.message,
        duration: Date.now() - startTime,
        events: [...this.events],
      };
    }
  }

  /**
   * Thực hiện Strong Migration
   * - Dừng task và capture state
   * - Lưu checkpoint
   * - Transfer code + checkpoint sang target
   * - Resume task từ checkpoint trên target
   */
  async executeStrongMigration(request: MigrationRequest): Promise<MigrationResult> {
    const startTime = Date.now();
    this.events = [];

    logInfo('Migration', `=== BẮT ĐẦU STRONG MIGRATION ===`);
    logInfo('Migration', `Task: ${request.taskId}`);
    logInfo('Migration', `Source: ${request.sourceNodeId} → Target: ${request.targetNodeId}`);
    
    if (request.checkpoint) {
      logInfo('Migration', `Checkpoint step: ${request.checkpoint.currentStep}`);
    }

    try {
      // Step 1: Migration requested
      this.emitEvent(request.taskId, 'migration_requested',
        request.sourceNodeId, request.targetNodeId, 'strong',
        MIGRATION_MESSAGES.STRONG.REQUESTED
      );

      // Step 2: Save checkpoint (nếu chưa có)
      if (!request.checkpoint) {
        this.emitEvent(request.taskId, 'checkpoint_saved',
          request.sourceNodeId, request.targetNodeId, 'strong',
          MIGRATION_MESSAGES.STRONG.SAVING_CHECKPOINT
        );
        await this.delay(500);
      }

      // Step 3: Stop source và capture state
      this.emitEvent(request.taskId, 'migration_started',
        request.sourceNodeId, request.targetNodeId, 'strong',
        MIGRATION_MESSAGES.STRONG.STOPPING_SOURCE
      );
      await this.delay(400);

      // Step 4: Transfer code
      this.emitEvent(request.taskId, 'code_transferred',
        request.sourceNodeId, request.targetNodeId, 'strong',
        MIGRATION_MESSAGES.STRONG.TRANSFERRING_CODE,
        { bundleId: request.codeBundle.id }
      );
      await this.delay(300);

      // Step 5: Transfer state (checkpoint)
      if (request.checkpoint) {
        this.emitEvent(request.taskId, 'state_transferred',
          request.sourceNodeId, request.targetNodeId, 'strong',
          MIGRATION_MESSAGES.STRONG.TRANSFERRING_STATE,
          { 
            checkpointId: request.checkpoint.id,
            step: request.checkpoint.currentStep 
          }
        );
        await this.delay(300);
      }

      // Step 6: Restore state trên target
      this.emitEvent(request.taskId, 'execution_resumed',
        request.sourceNodeId, request.targetNodeId, 'strong',
        MIGRATION_MESSAGES.STRONG.RESTORING_STATE,
        { 
          resumeFrom: request.checkpoint?.currentStep ?? 1,
          message: request.checkpoint 
            ? `Tiếp tục từ step ${request.checkpoint.currentStep + 1}`
            : 'Bắt đầu từ đầu (không có checkpoint)'
        }
      );
      await this.delay(200);

      // Step 7: Confirm continuing
      this.emitEvent(request.taskId, 'migration_completed',
        request.sourceNodeId, request.targetNodeId, 'strong',
        MIGRATION_MESSAGES.STRONG.COMPLETED,
        { 
          continuedFrom: request.checkpoint?.currentStep ?? 0,
          variables: request.checkpoint?.variables
        }
      );

      const result: MigrationResult = {
        success: true,
        migrationType: 'strong',
        sourceNodeId: request.sourceNodeId,
        targetNodeId: request.targetNodeId,
        taskId: request.taskId,
        checkpoint: request.checkpoint,
        duration: Date.now() - startTime,
        events: [...this.events],
      };

      logSuccess('Migration', `Strong Migration hoàn thành trong ${result.duration}ms`);
      if (request.checkpoint) {
        logSuccess('Migration', `Task sẽ tiếp tục từ step ${request.checkpoint.currentStep + 1}`);
      }
      
      this.callbacks.onComplete?.(result);
      return result;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError('Migration', 'Strong Migration thất bại:', err.message);

      this.emitEvent(request.taskId, 'migration_failed',
        request.sourceNodeId, request.targetNodeId, 'strong',
        `Migration thất bại: ${err.message}`
      );

      return {
        success: false,
        migrationType: 'strong',
        sourceNodeId: request.sourceNodeId,
        targetNodeId: request.targetNodeId,
        taskId: request.taskId,
        error: err.message,
        duration: Date.now() - startTime,
        events: [...this.events],
      };
    }
  }

  /**
   * Thực hiện migration dựa trên loại
   */
  async executeMigration(request: MigrationRequest): Promise<MigrationResult> {
    if (request.migrationType === 'weak') {
      return this.executeWeakMigration(request);
    } else {
      return this.executeStrongMigration(request);
    }
  }

  /**
   * Helper: Emit migration event
   */
  private emitEvent(
    taskId: string,
    type: MigrationEvent['type'],
    sourceNodeId: string,
    targetNodeId: string,
    migrationType: MigrationType,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const event = createMigrationEvent(
      taskId,
      type,
      sourceNodeId,
      targetNodeId,
      migrationType,
      message,
      data
    );
    
    this.events.push(event);
    this.callbacks.onEvent?.(event);
    
    logInfo('Migration', `[${type}] ${message}`);
  }

  /**
   * Helper: Delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Lấy tất cả events
   */
  getEvents(): MigrationEvent[] {
    return [...this.events];
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Tạo migration manager mới
 */
export function createMigrationManager(callbacks?: MigrationCallbacks): MigrationManager {
  return new MigrationManager(callbacks);
}
