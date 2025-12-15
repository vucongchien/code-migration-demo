/**
 * =============================================================================
 * UTILITY FUNCTIONS - Các hàm tiện ích dùng chung
 * =============================================================================
 */

import { v4 as uuidv4 } from 'uuid';
import type { CodeBundle, ExecutionCheckpoint, Task, MigrationEvent, MigrationType, MigrationEventType } from '../types';

// =============================================================================
// ID GENERATION - Tạo ID duy nhất
// =============================================================================

/**
 * Tạo một ID duy nhất
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Tạo ID ngắn hơn cho display
 */
export function generateShortId(): string {
  return uuidv4().slice(0, 8);
}

// =============================================================================
// TIME UTILITIES - Các hàm xử lý thời gian
// =============================================================================

/**
 * Sleep function cho async/await
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format timestamp thành chuỗi đọc được
 */
export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Tính thời gian đã qua từ một thời điểm
 */
export function getTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 60) return `${seconds} giây trước`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return `${Math.floor(seconds / 86400)} ngày trước`;
}

// =============================================================================
// CODE SERIALIZATION - Đóng gói và giải nén code
// =============================================================================

/**
 * Tạo checksum đơn giản cho code
 * (Trong production nên dùng crypto hash)
 */
export function generateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Tạo CodeBundle từ code string
 */
export function createCodeBundle(
  name: string,
  code: string,
  description: string = ''
): CodeBundle {
  return {
    id: generateId(),
    name,
    description,
    code,
    version: '1.0.0',
    checksum: generateChecksum(code),
    createdAt: new Date(),
  };
}

/**
 * Verify tính toàn vẹn của CodeBundle
 */
export function verifyCodeBundle(bundle: CodeBundle): boolean {
  return generateChecksum(bundle.code) === bundle.checksum;
}

// =============================================================================
// CHECKPOINT UTILITIES - Các hàm xử lý checkpoint
// =============================================================================

/**
 * Tạo checkpoint mới
 */
export function createCheckpoint(
  taskId: string,
  currentStep: number,
  totalSteps: number,
  variables: Record<string, unknown>,
  sourceNodeId: string,
  metadata?: Record<string, unknown>
): ExecutionCheckpoint {
  return {
    id: generateId(),
    taskId,
    currentStep,
    totalSteps,
    variables,
    sourceNodeId,
    createdAt: new Date(),
    metadata,
  };
}

/**
 * Serialize checkpoint thành JSON string
 */
export function serializeCheckpoint(checkpoint: ExecutionCheckpoint): string {
  return JSON.stringify(checkpoint);
}

/**
 * Deserialize JSON string thành checkpoint
 */
export function deserializeCheckpoint(data: string): ExecutionCheckpoint {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt),
  };
}

// =============================================================================
// TASK UTILITIES - Các hàm xử lý task
// =============================================================================

/**
 * Tạo task mới
 */
export function createTask(
  name: string,
  code: string,
  migrationType: MigrationType
): Task {
  return {
    id: generateId(),
    name,
    code,
    status: 'pending',
    migrationType,
    progress: 0,
    createdAt: new Date(),
  };
}

/**
 * Tính phần trăm tiến độ
 */
export function calculateProgress(currentStep: number, totalSteps: number): number {
  if (totalSteps === 0) return 0;
  return Math.round((currentStep / totalSteps) * 100);
}

// =============================================================================
// EVENT UTILITIES - Các hàm xử lý sự kiện
// =============================================================================

/**
 * Tạo migration event mới
 */
export function createMigrationEvent(
  taskId: string,
  type: MigrationEventType,
  sourceNodeId: string,
  targetNodeId: string,
  migrationType: MigrationType,
  message: string,
  data?: Record<string, unknown>
): MigrationEvent {
  return {
    id: generateId(),
    taskId,
    type,
    sourceNodeId,
    targetNodeId,
    migrationType,
    timestamp: new Date(),
    message,
    data,
  };
}

// =============================================================================
// NETWORK UTILITIES - Các hàm xử lý network
// =============================================================================

/**
 * Lấy địa chỉ cơ bản của máy
 * Dùng cho việc display, không phải detection thực
 */
export function getDisplayAddress(port: number): string {
  // Trong browser, dùng window.location hoặc hardcode
  if (typeof window !== 'undefined') {
    return `${window.location.hostname}:${port}`;
  }
  return `localhost:${port}`;
}

/**
 * Validate địa chỉ host:port
 */
export function isValidAddress(address: string): boolean {
  const pattern = /^[\w.-]+:\d+$/;
  return pattern.test(address);
}

// =============================================================================
// LOGGING UTILITIES - Các hàm log có format đẹp
// =============================================================================

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

const LOG_COLORS = {
  info: '\x1b[36m',     // Cyan
  warn: '\x1b[33m',     // Yellow
  error: '\x1b[31m',    // Red
  debug: '\x1b[90m',    // Gray
  success: '\x1b[32m',  // Green
  reset: '\x1b[0m',
};

const LOG_PREFIXES = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  debug: '🔍',
  success: '✅',
};

// Log handler type
type LogHandler = (level: LogLevel, context: string, message: string, data?: unknown) => void;

let remoteLogHandler: LogHandler | null = null;

/**
 * Set handler để gửi log ra ngoài (VD: qua socket)
 */
export function setLogHandler(handler: LogHandler): void {
  remoteLogHandler = handler;
}

/**
 * Log với format đẹp
 */
export function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  // Gửi qua remote handler nếu có
  if (remoteLogHandler) {
    remoteLogHandler(level, context, message, data);
  }

  const timestamp = formatTimestamp(new Date());
  const prefix = LOG_PREFIXES[level];
  const color = LOG_COLORS[level];
  const reset = LOG_COLORS.reset;

  const formattedMessage = `${color}[${timestamp}] ${prefix} [${context}] ${message}${reset}`;
  
  if (data !== undefined) {
    console.log(formattedMessage, data);
  } else {
    console.log(formattedMessage);
  }
}

// Convenience functions
export const logInfo = (context: string, message: string, data?: unknown) => log('info', context, message, data);
export const logWarn = (context: string, message: string, data?: unknown) => log('warn', context, message, data);
export const logError = (context: string, message: string, data?: unknown) => log('error', context, message, data);
export const logDebug = (context: string, message: string, data?: unknown) => log('debug', context, message, data);
export const logSuccess = (context: string, message: string, data?: unknown) => log('success', context, message, data);
