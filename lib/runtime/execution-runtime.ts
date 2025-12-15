/**
 * =============================================================================
 * EXECUTION RUNTIME - Runtime thực thi code cho Worker nodes
 * =============================================================================
 * 
 * Đây là core của hệ thống - cho phép thực thi code với khả năng:
 * - Báo cáo tiến độ real-time
 * - Checkpoint cho Strong Mobility
 * - Pause/Resume để hỗ trợ migration
 */

import { 
  generateId, 
  sleep, 
  createCheckpoint, 
  calculateProgress,
  logInfo,
  logDebug,
  logSuccess,
  logError 
} from '../utils';
import { DEFAULT_CONFIG } from '../constants';
import type { 
  Task, 
  ExecutionCheckpoint, 
  TaskResult, 
  CheckpointConfig 
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Context được truyền vào code thực thi
 * Cho phép code tương tác với runtime
 */
export interface ExecutionContext {
  /** Task ID */
  taskId: string;
  /** Node ID đang thực thi */
  nodeId: string;
  /** Các tham số cho task */
  params: Record<string, unknown>;
  /** Checkpoint hiện tại (nếu đang resume) */
  checkpoint?: ExecutionCheckpoint;
  
  // Functions cho code sử dụng
  /** Báo cáo tiến độ */
  reportProgress: (progress: ProgressReport) => void;
  /** Kiểm tra có nên tạo checkpoint không */
  shouldCheckpoint: () => boolean;
  /** Lưu checkpoint */
  saveCheckpoint: (data: CheckpointData) => Promise<void>;
  /** Sleep function */
  sleep: (ms: number) => Promise<void>;
  /** Kiểm tra task có bị pause không */
  isPaused: () => boolean;
}

/**
 * Báo cáo tiến độ thực thi
 */
export interface ProgressReport {
  currentStep: number;
  totalSteps: number;
  message?: string;
}

/**
 * Dữ liệu để tạo checkpoint
 */
export interface CheckpointData {
  currentStep: number;
  variables: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Callbacks từ runtime
 */
export interface RuntimeCallbacks {
  /** Gọi khi có cập nhật tiến độ */
  onProgress?: (progress: ProgressReport) => void;
  /** Gọi khi checkpoint được tạo */
  onCheckpoint?: (checkpoint: ExecutionCheckpoint) => void;
  /** Gọi khi task hoàn thành */
  onComplete?: (result: TaskResult) => void;
  /** Gọi khi có lỗi */
  onError?: (error: Error) => void;
}

// =============================================================================
// EXECUTION RUNTIME CLASS
// =============================================================================

export class ExecutionRuntime {
  private taskId: string;
  private nodeId: string;
  private isPausedFlag: boolean = false;
  private stepsSinceCheckpoint: number = 0;
  private currentStep: number = 0;
  private totalSteps: number = 0;
  private checkpointConfig: CheckpointConfig;
  private callbacks: RuntimeCallbacks;
  private latestCheckpoint?: ExecutionCheckpoint;

  constructor(
    taskId: string,
    nodeId: string,
    checkpointConfig?: Partial<CheckpointConfig>,
    callbacks?: RuntimeCallbacks
  ) {
    this.taskId = taskId;
    this.nodeId = nodeId;
    this.callbacks = callbacks || {};
    this.checkpointConfig = {
      enabled: checkpointConfig?.enabled ?? true,
      intervalSteps: checkpointConfig?.intervalSteps ?? DEFAULT_CONFIG.CHECKPOINT_INTERVAL_STEPS,
      saveOnPause: checkpointConfig?.saveOnPause ?? true,
    };

    logInfo('Runtime', `Khởi tạo runtime cho task ${taskId} trên node ${nodeId}`);
  }

  /**
   * Thực thi code string trong sandbox
   */
  async execute(
    code: string,
    params: Record<string, unknown> = {},
    checkpoint?: ExecutionCheckpoint
  ): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      logInfo('Runtime', `Bắt đầu thực thi task ${this.taskId}`);
      
      if (checkpoint) {
        logInfo('Runtime', `Resuming từ checkpoint step ${checkpoint.currentStep}`);
        this.currentStep = checkpoint.currentStep;
      }

      // Tạo execution context
      const context = this.createContext(params, checkpoint);

      // Tạo function từ code string
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const taskFunction = new Function('context', `
        return (async function() {
          ${code}
          // Gọi function chính trong code
          if (typeof countingTask === 'function') {
            return await countingTask(context);
          } else if (typeof sumTask === 'function') {
            return await sumTask(context);
          } else if (typeof main === 'function') {
            return await main(context);
          }
          throw new Error('Không tìm thấy function thực thi (countingTask, sumTask, hoặc main)');
        })();
      `);

      // Thực thi
      const result = await taskFunction(context);

      const executionTime = Date.now() - startTime;
      const taskResult: TaskResult = {
        success: !result?.paused,
        data: result,
        executionTime,
      };

      if (result?.paused) {
        logInfo('Runtime', `Task ${this.taskId} đã pause tại step ${result.at}`);
      } else {
        logSuccess('Runtime', `Task ${this.taskId} hoàn thành trong ${executionTime}ms`);
      }

      this.callbacks.onComplete?.(taskResult);
      return taskResult;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError('Runtime', `Lỗi thực thi task ${this.taskId}:`, err.message);
      
      this.callbacks.onError?.(err);
      return {
        success: false,
        error: err.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Tạo execution context
   */
  private createContext(
    params: Record<string, unknown>,
    checkpoint?: ExecutionCheckpoint
  ): ExecutionContext {
    return {
      taskId: this.taskId,
      nodeId: this.nodeId,
      params,
      checkpoint,
      
      reportProgress: (progress: ProgressReport) => {
        this.currentStep = progress.currentStep;
        this.totalSteps = progress.totalSteps;
        this.stepsSinceCheckpoint++;
        
        logDebug('Runtime', 
          `[${this.taskId}] Step ${progress.currentStep}/${progress.totalSteps} - ${progress.message || ''}`
        );
        
        this.callbacks.onProgress?.(progress);
      },
      
      shouldCheckpoint: () => {
        if (!this.checkpointConfig.enabled) return false;
        return this.stepsSinceCheckpoint >= this.checkpointConfig.intervalSteps;
      },
      
      saveCheckpoint: async (data: CheckpointData) => {
        const cp = createCheckpoint(
          this.taskId,
          data.currentStep,
          this.totalSteps,
          data.variables,
          this.nodeId,
          data.metadata
        );
        
        this.latestCheckpoint = cp;
        this.stepsSinceCheckpoint = 0;
        
        logInfo('Runtime', `Checkpoint saved tại step ${data.currentStep}`);
        this.callbacks.onCheckpoint?.(cp);
      },
      
      sleep: (ms: number) => sleep(ms),
      
      isPaused: () => this.isPausedFlag,
    };
  }

  /**
   * Pause task execution
   */
  async pause(): Promise<ExecutionCheckpoint | undefined> {
    logInfo('Runtime', `Pause requested cho task ${this.taskId}`);
    this.isPausedFlag = true;
    
    // Nếu cần lưu checkpoint khi pause
    if (this.checkpointConfig.saveOnPause && this.latestCheckpoint) {
      return this.latestCheckpoint;
    }
    
    return this.latestCheckpoint;
  }

  /**
   * Resume task
   */
  resume(): void {
    logInfo('Runtime', `Resume task ${this.taskId}`);
    this.isPausedFlag = false;
  }

  /**
   * Lấy checkpoint mới nhất
   */
  getLatestCheckpoint(): ExecutionCheckpoint | undefined {
    return this.latestCheckpoint;
  }

  /**
   * Lấy tiến độ hiện tại
   */
  getProgress(): { current: number; total: number; percent: number } {
    return {
      current: this.currentStep,
      total: this.totalSteps,
      percent: calculateProgress(this.currentStep, this.totalSteps),
    };
  }

  /**
   * Kiểm tra task có đang pause
   */
  isPaused(): boolean {
    return this.isPausedFlag;
  }
}

// =============================================================================
// FACTORY FUNCTION - Tạo runtime dễ dàng hơn
// =============================================================================

/**
 * Tạo execution runtime mới
 */
export function createExecutionRuntime(
  taskId: string,
  nodeId: string,
  options?: {
    checkpointConfig?: Partial<CheckpointConfig>;
    callbacks?: RuntimeCallbacks;
  }
): ExecutionRuntime {
  return new ExecutionRuntime(
    taskId,
    nodeId,
    options?.checkpointConfig,
    options?.callbacks
  );
}
