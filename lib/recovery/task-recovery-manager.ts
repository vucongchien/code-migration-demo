/**
 * =============================================================================
 * TASK RECOVERY MANAGER - Quản lý phục hồi lỗi (Fault Tolerance)
 * =============================================================================
 * 
 * Module này chịu trách nhiệm:
 * 1. Xử lý khi phát hiện node chết
 * 2. Tìm task bị ảnh hưởng
 * 3. Chọn node thay thế
 * 4. Thực hiện phục hồi (Weak hoặc Strong)
 */

import { 
  logInfo, 
  logWarn, 
  logError, 
  logSuccess,
  createMigrationEvent 
} from '../utils';
import { MIGRATION_MESSAGES } from '../constants';
import { getRegistry } from '../registry/code-registry';
import type { 
  Task, 
  NodeInfo, 
  MigrationEvent, 
  MigrationType,
  CodeBundle,
  ExecutionCheckpoint
} from '../types';

/**
 * Interface cho dependencies cần thiết từ Coordinator
 */
export interface RecoveryContext {
  tasks: Map<string, Task>;
  nodes: Map<string, any>; // Using any to avoid circular dependency with CoordinatorServer types
  findAvailableWorker: () => any; // Returns ConnectedNode | undefined
  assignTaskToNode: (task: Task, worker: any, checkpoint?: ExecutionCheckpoint) => void;
  broadcastEvent: (event: MigrationEvent) => void;
}

export class TaskRecoveryManager {
  private context: RecoveryContext;
  private registry = getRegistry();

  constructor(context: RecoveryContext) {
    this.context = context;
  }

  /**
   * Xử lý sự cố khi một node bị disconnect hoặc timeout
   */
  async handleNodeFailure(failedNodeId: string, failedNodeName: string): Promise<void> {
    logWarn('Recovery', `Bắt đầu quy trình phục hồi cho node: ${failedNodeName} (${failedNodeId})`);

    // 1. Tìm các task bị ảnh hưởng
    const affectedTasks = this.findAffectedTasks(failedNodeId);
    
    if (affectedTasks.length === 0) {
      logInfo('Recovery', 'Không có task nào bị ảnh hưởng.');
      return;
    }

    logInfo('Recovery', `Tìm thấy ${affectedTasks.length} task cần phục hồi.`);

    // 2. Broadcast sự kiện phát hiện lỗi
    this.emitEvent(
      affectedTasks[0].id, // Dùng ID task đầu tiên làm đại diện
      'node_failure_detected',
      failedNodeId,
      'SYSTEM',
      affectedTasks[0].migrationType,
      `${MIGRATION_MESSAGES.RECOVERY.NODE_FAILED} ${failedNodeName}`
    );

    // 3. Phục hồi từng task
    for (const task of affectedTasks) {
      await this.recoverTask(task, failedNodeId);
    }
  }

  /**
   * Tìm các task đang chạy trên node bị lỗi
   */
  private findAffectedTasks(nodeId: string): Task[] {
    const tasks: Task[] = [];
    for (const task of this.context.tasks.values()) {
      // Chỉ quan tâm task đang running hoặc migrating trên node đó
      if (task.currentNodeId === nodeId && 
         (task.status === 'running' || task.status === 'migrating')) {
        tasks.push(task);
      }
    }
    return tasks;
  }

  /**
   * Thực hiện phục hồi một task cụ thể
   */
  private async recoverTask(task: Task, failedNodeId: string): Promise<void> {
    logInfo('Recovery', `Đang phục hồi task: ${task.name} (${task.id})`);

    // Tìm node thay thế
    const targetWorker = this.context.findAvailableWorker();
    
    if (!targetWorker) {
      logError('Recovery', `KHÔNG THỂ PHỤC HỒI: ${MIGRATION_MESSAGES.RECOVERY.NO_NODES}`);
      
      this.emitEvent(
        task.id,
        'migration_failed',
        failedNodeId,
        'NONE',
        task.migrationType,
        MIGRATION_MESSAGES.RECOVERY.NO_NODES
      );
      
      task.status = 'failed';
      return;
    }

    const targetNodeId = targetWorker.info.id;
    const targetNodeName = targetWorker.info.name;

    logInfo('Recovery', `Node thay thế: ${targetNodeName} (${targetNodeId})`);

    // Xử lý dựa trên Migration Type
    if (task.migrationType === 'weak') {
      await this.performWeakRecovery(task, failedNodeId, targetWorker);
    } else {
      await this.performStrongRecovery(task, failedNodeId, targetWorker);
    }
  }

  /**
   * Weak Recovery: Restart từ đầu
   */
  private async performWeakRecovery(task: Task, failedNodeId: string, targetWorker: any): Promise<void> {
    this.emitEvent(
      task.id,
      'task_recovered',
      failedNodeId,
      targetWorker.info.id,
      'weak',
      `${MIGRATION_MESSAGES.RECOVERY.WEAK_RECOVERY} -> ${targetWorker.info.name}`
    );

    // Reset task state
    task.progress = 0;
    task.currentNodeId = targetWorker.info.id;
    task.status = 'running';
    
    // Assign lại (không có checkpoint)
    this.context.assignTaskToNode(task, targetWorker);
    
    logSuccess('Recovery', `Weak Recovery thành công cho task ${task.id}`);
  }

  /**
   * Strong Recovery: Resume từ checkpoint
   */
  private async performStrongRecovery(task: Task, failedNodeId: string, targetWorker: any): Promise<void> {
    // Lấy checkpoint mới nhất từ Registry
    const latestCheckpoint = this.registry.getLatestCheckpoint(task.id);

    let message = MIGRATION_MESSAGES.RECOVERY.STRONG_RECOVERY;
    if (latestCheckpoint) {
      message += ` (Step ${latestCheckpoint.currentStep})`;
    } else {
      message += ` (Không có checkpoint - Restart từ đầu)`;
    }

    this.emitEvent(
      task.id,
      'task_recovered',
      failedNodeId,
      targetWorker.info.id,
      'strong',
      `${message} -> ${targetWorker.info.name}`,
      { checkpointStep: latestCheckpoint?.currentStep }
    );

    // Update task state
    task.currentNodeId = targetWorker.info.id;
    task.status = 'running';
    if (latestCheckpoint) {
        task.progress = (latestCheckpoint.currentStep / latestCheckpoint.totalSteps) * 100;
    } else {
        task.progress = 0;
    }

    // Assign lại với checkpoint
    this.context.assignTaskToNode(task, targetWorker, latestCheckpoint);

    logSuccess('Recovery', `Strong Recovery thành công cho task ${task.id}`);
  }

  /**
   * Helper: Emit event
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
    this.context.broadcastEvent(event);
  }
}
