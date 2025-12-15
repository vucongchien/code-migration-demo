/**
 * =============================================================================
 * CODE REGISTRY - Lưu trữ và quản lý code bundles
 * =============================================================================
 * 
 * Registry lưu trữ:
 * - Code bundles (có thể di trú)
 * - Checkpoints (cho Strong Mobility)
 * - Version history
 */

import { 
  generateId, 
  createCodeBundle, 
  verifyCodeBundle,
  logInfo,
  logSuccess,
  logError,
  logWarn 
} from '../utils';
import { DEMO_CODE_TEMPLATES } from '../constants';
import type { 
  CodeBundle, 
  ExecutionCheckpoint 
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface RegistryStats {
  totalBundles: number;
  totalCheckpoints: number;
  storageSize: number;  // bytes (estimated)
}

// =============================================================================
// CODE REGISTRY CLASS
// =============================================================================

export class CodeRegistry {
  private bundles: Map<string, CodeBundle> = new Map();
  private checkpoints: Map<string, ExecutionCheckpoint[]> = new Map(); // taskId -> checkpoints
  private latestCheckpoints: Map<string, ExecutionCheckpoint> = new Map(); // taskId -> latest

  constructor() {
    // Khởi tạo với các code templates mặc định
    this.initDefaultBundles();
    logInfo('Registry', 'Code Registry đã khởi tạo');
  }

  /**
   * Khởi tạo các code bundles mặc định cho demo
   */
  private initDefaultBundles(): void {
    // Demo đếm số
    const countingBundle = createCodeBundle(
      'counting-task',
      DEMO_CODE_TEMPLATES.COUNTING_TASK,
      'Demo đếm số từ 1 đến N - hỗ trợ checkpoint'
    );
    this.bundles.set(countingBundle.id, countingBundle);
    this.bundles.set('counting-task', countingBundle); // Alias by name

    // Demo tính tổng
    const sumBundle = createCodeBundle(
      'sum-task',
      DEMO_CODE_TEMPLATES.SUM_TASK,
      'Demo tính tổng từ 1 đến N - hỗ trợ checkpoint và resume'
    );
    this.bundles.set(sumBundle.id, sumBundle);
    this.bundles.set('sum-task', sumBundle); // Alias by name

    logInfo('Registry', `Đã khởi tạo ${this.bundles.size / 2} code bundles mặc định`);
  }

  // ===========================================================================
  // CODE BUNDLE OPERATIONS
  // ===========================================================================

  /**
   * Thêm hoặc cập nhật code bundle
   */
  registerBundle(
    name: string,
    code: string,
    description: string = ''
  ): CodeBundle {
    const bundle = createCodeBundle(name, code, description);
    this.bundles.set(bundle.id, bundle);
    this.bundles.set(name, bundle); // Alias by name
    
    logSuccess('Registry', `Đã đăng ký bundle: ${name} (ID: ${bundle.id})`);
    return bundle;
  }

  /**
   * Lấy code bundle theo ID hoặc name
   */
  getBundle(idOrName: string): CodeBundle | undefined {
    return this.bundles.get(idOrName);
  }

  /**
   * Lấy tất cả bundles
   */
  getAllBundles(): CodeBundle[] {
    // Chỉ trả về bundles có ID là UUID (không phải alias)
    const uniqueBundles = new Map<string, CodeBundle>();
    for (const [key, bundle] of this.bundles) {
      if (key === bundle.id) {
        uniqueBundles.set(bundle.id, bundle);
      }
    }
    return Array.from(uniqueBundles.values());
  }

  /**
   * Xóa bundle
   */
  removeBundle(idOrName: string): boolean {
    const bundle = this.bundles.get(idOrName);
    if (!bundle) return false;

    this.bundles.delete(bundle.id);
    this.bundles.delete(bundle.name);
    logInfo('Registry', `Đã xóa bundle: ${bundle.name}`);
    return true;
  }

  /**
   * Verify bundle integrity
   */
  verifyBundle(idOrName: string): boolean {
    const bundle = this.bundles.get(idOrName);
    if (!bundle) {
      logWarn('Registry', `Bundle không tồn tại: ${idOrName}`);
      return false;
    }
    
    const isValid = verifyCodeBundle(bundle);
    if (!isValid) {
      logError('Registry', `Bundle bị corrupt: ${bundle.name}`);
    }
    return isValid;
  }

  // ===========================================================================
  // CHECKPOINT OPERATIONS (Strong Mobility)
  // ===========================================================================

  /**
   * Lưu checkpoint
   */
  saveCheckpoint(checkpoint: ExecutionCheckpoint): void {
    // Lưu vào history
    if (!this.checkpoints.has(checkpoint.taskId)) {
      this.checkpoints.set(checkpoint.taskId, []);
    }
    this.checkpoints.get(checkpoint.taskId)!.push(checkpoint);

    // Cập nhật latest
    this.latestCheckpoints.set(checkpoint.taskId, checkpoint);
    
    logInfo('Registry', 
      `Checkpoint saved - Task: ${checkpoint.taskId}, Step: ${checkpoint.currentStep}/${checkpoint.totalSteps}`
    );
  }

  /**
   * Lấy checkpoint mới nhất của task
   */
  getLatestCheckpoint(taskId: string): ExecutionCheckpoint | undefined {
    return this.latestCheckpoints.get(taskId);
  }

  /**
   * Lấy tất cả checkpoints của task
   */
  getCheckpointHistory(taskId: string): ExecutionCheckpoint[] {
    return this.checkpoints.get(taskId) || [];
  }

  /**
   * Lấy checkpoint theo ID
   */
  getCheckpointById(checkpointId: string): ExecutionCheckpoint | undefined {
    for (const checkpointList of this.checkpoints.values()) {
      const found = checkpointList.find(cp => cp.id === checkpointId);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Xóa checkpoints của một task
   */
  clearCheckpoints(taskId: string): void {
    this.checkpoints.delete(taskId);
    this.latestCheckpoints.delete(taskId);
    logInfo('Registry', `Đã xóa checkpoints của task: ${taskId}`);
  }

  /**
   * Xóa tất cả checkpoints
   */
  clearAllCheckpoints(): void {
    this.checkpoints.clear();
    this.latestCheckpoints.clear();
    logInfo('Registry', 'Đã xóa tất cả checkpoints');
  }

  // ===========================================================================
  // STATS & UTILITIES
  // ===========================================================================

  /**
   * Lấy thống kê registry
   */
  getStats(): RegistryStats {
    let checkpointCount = 0;
    for (const list of this.checkpoints.values()) {
      checkpointCount += list.length;
    }

    // Estimate storage size
    let storageSize = 0;
    for (const bundle of this.getAllBundles()) {
      storageSize += bundle.code.length * 2; // UTF-16
    }
    for (const list of this.checkpoints.values()) {
      for (const cp of list) {
        storageSize += JSON.stringify(cp).length * 2;
      }
    }

    return {
      totalBundles: this.getAllBundles().length,
      totalCheckpoints: checkpointCount,
      storageSize,
    };
  }

  /**
   * Export dữ liệu (cho persistence)
   */
  export(): {
    bundles: CodeBundle[];
    checkpoints: Record<string, ExecutionCheckpoint[]>;
  } {
    const checkpointsObj: Record<string, ExecutionCheckpoint[]> = {};
    for (const [taskId, list] of this.checkpoints) {
      checkpointsObj[taskId] = list;
    }

    return {
      bundles: this.getAllBundles(),
      checkpoints: checkpointsObj,
    };
  }

  /**
   * Import dữ liệu
   */
  import(data: {
    bundles: CodeBundle[];
    checkpoints: Record<string, ExecutionCheckpoint[]>;
  }): void {
    // Import bundles
    for (const bundle of data.bundles) {
      this.bundles.set(bundle.id, bundle);
      this.bundles.set(bundle.name, bundle);
    }

    // Import checkpoints
    for (const [taskId, list] of Object.entries(data.checkpoints)) {
      this.checkpoints.set(taskId, list);
      if (list.length > 0) {
        this.latestCheckpoints.set(taskId, list[list.length - 1]);
      }
    }

    logInfo('Registry', 
      `Imported ${data.bundles.length} bundles và ${Object.keys(data.checkpoints).length} task checkpoints`
    );
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let registryInstance: CodeRegistry | null = null;

/**
 * Lấy singleton instance của registry
 */
export function getRegistry(): CodeRegistry {
  if (!registryInstance) {
    registryInstance = new CodeRegistry();
  }
  return registryInstance;
}

/**
 * Reset registry (cho testing)
 */
export function resetRegistry(): void {
  registryInstance = null;
}
