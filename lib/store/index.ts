/**
 * =============================================================================
 * GLOBAL STORE - State management cho Dashboard (Monitor)
 * =============================================================================
 * 
 * Sử dụng Zustand để quản lý state toàn cục của ứng dụng.
 * Store này được sử dụng bởi Monitor Dashboard để hiển thị real-time.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { 
  NodeInfo, 
  Task, 
  MigrationEvent, 
  SystemStats,
  ExecutionCheckpoint,
  LogEntry,
  NodeStats
} from '../types';

// =============================================================================
// STORE STATE TYPE
// =============================================================================

interface SystemState {
  // Data
  nodes: NodeInfo[];
  tasks: Task[];
  events: MigrationEvent[];
  checkpoints: ExecutionCheckpoint[];
  logs: LogEntry[];
  nodeStats: Record<string, NodeStats>;
  
  // UI State
  selectedTaskId: string | null;
  selectedNodeId: string | null;
  isConnected: boolean;
  currentRole: 'coordinator' | 'worker' | 'monitor' | null;
  
  // Computed stats
  stats: SystemStats;
  
  // Actions - Nodes
  addNode: (node: NodeInfo) => void;
  updateNode: (nodeId: string, updates: Partial<NodeInfo>) => void;
  removeNode: (nodeId: string) => void;
  setNodes: (nodes: NodeInfo[]) => void;
  
  // Actions - Tasks
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
  setTasks: (tasks: Task[]) => void;
  
  // Actions - Events
  addEvent: (event: MigrationEvent) => void;
  clearEvents: () => void;
  
  // Actions - Checkpoints
  addCheckpoint: (checkpoint: ExecutionCheckpoint) => void;
  getCheckpoint: (taskId: string) => ExecutionCheckpoint | undefined;
  clearCheckpoints: (taskId: string) => void;

  // Actions - Logs & Stats
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  updateNodeStats: (stats: NodeStats) => void;
  
  // Actions - UI State
  selectTask: (taskId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  setConnected: (connected: boolean) => void;
  setRole: (role: 'coordinator' | 'worker' | 'monitor' | null) => void;
  
  // Actions - Utility
  reset: () => void;
  getNodeById: (nodeId: string) => NodeInfo | undefined;
  getTaskById: (taskId: string) => Task | undefined;
  getWorkerNodes: () => NodeInfo[];
  getLogsByNode: (nodeId: string) => LogEntry[];
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialStats: SystemStats = {
  onlineNodes: 0,
  totalTasks: 0,
  runningTasks: 0,
  completedMigrations: 0,
  failedMigrations: 0,
};

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useSystemStore = create<SystemState>()(
  immer((set, get) => ({
    // Initial state
    nodes: [],
    tasks: [],
    events: [],
    checkpoints: [],
    logs: [],
    nodeStats: {},
    selectedTaskId: null,
    selectedNodeId: null,
    isConnected: false,
    currentRole: null,
    stats: initialStats,

    // =========================================================================
    // NODE ACTIONS
    // =========================================================================
    
    addNode: (node) => set((state) => {
      // Kiểm tra xem node đã tồn tại chưa
      const existingIndex = state.nodes.findIndex(n => n.id === node.id);
      if (existingIndex >= 0) {
        // Cập nhật node existing
        state.nodes[existingIndex] = node;
      } else {
        // Thêm node mới
        state.nodes.push(node);
      }
      // Cập nhật stats
      state.stats.onlineNodes = state.nodes.filter(n => n.status === 'online').length;
    }),

    updateNode: (nodeId, updates) => set((state) => {
      const index = state.nodes.findIndex(n => n.id === nodeId);
      if (index >= 0) {
        Object.assign(state.nodes[index], updates);
        // Cập nhật stats nếu status thay đổi
        if (updates.status !== undefined) {
          state.stats.onlineNodes = state.nodes.filter(n => n.status === 'online').length;
        }
      }
    }),

    removeNode: (nodeId) => set((state) => {
      state.nodes = state.nodes.filter(n => n.id !== nodeId);
      state.stats.onlineNodes = state.nodes.filter(n => n.status === 'online').length;
    }),

    setNodes: (nodes) => set((state) => {
      state.nodes = nodes;
      state.stats.onlineNodes = nodes.filter(n => n.status === 'online').length;
    }),

    // =========================================================================
    // TASK ACTIONS
    // =========================================================================
    
    addTask: (task) => set((state) => {
      state.tasks.push(task);
      state.stats.totalTasks = state.tasks.length;
      state.stats.runningTasks = state.tasks.filter(t => t.status === 'running').length;
    }),

    updateTask: (taskId, updates) => set((state) => {
      const index = state.tasks.findIndex(t => t.id === taskId);
      if (index >= 0) {
        Object.assign(state.tasks[index], updates);
        state.stats.runningTasks = state.tasks.filter(t => t.status === 'running').length;
      }
    }),

    removeTask: (taskId) => set((state) => {
      state.tasks = state.tasks.filter(t => t.id !== taskId);
      state.stats.totalTasks = state.tasks.length;
      state.stats.runningTasks = state.tasks.filter(t => t.status === 'running').length;
    }),

    setTasks: (tasks) => set((state) => {
      state.tasks = tasks;
      state.stats.totalTasks = tasks.length;
      state.stats.runningTasks = tasks.filter(t => t.status === 'running').length;
    }),

    // =========================================================================
    // EVENT ACTIONS
    // =========================================================================
    
    addEvent: (event) => set((state) => {
      // Thêm event vào đầu danh sách (mới nhất trước)
      state.events.unshift(event);
      // Giữ tối đa 100 events
      if (state.events.length > 100) {
        state.events = state.events.slice(0, 100);
      }
      // Cập nhật stats dựa trên loại event
      if (event.type === 'migration_completed') {
        state.stats.completedMigrations++;
      } else if (event.type === 'migration_failed') {
        state.stats.failedMigrations++;
      }
    }),

    clearEvents: () => set((state) => {
      state.events = [];
    }),

    // =========================================================================
    // CHECKPOINT ACTIONS
    // =========================================================================
    
    addCheckpoint: (checkpoint) => set((state) => {
      // Thay thế checkpoint cũ của cùng task (nếu có)
      const existingIndex = state.checkpoints.findIndex(
        c => c.taskId === checkpoint.taskId
      );
      if (existingIndex >= 0) {
        state.checkpoints[existingIndex] = checkpoint;
      } else {
        state.checkpoints.push(checkpoint);
      }
    }),

    getCheckpoint: (taskId) => {
      return get().checkpoints.find(c => c.taskId === taskId);
    },

    clearCheckpoints: (taskId) => set((state) => {
      state.checkpoints = state.checkpoints.filter(c => c.taskId !== taskId);
    }),

    // =========================================================================
    // LOG & STATS ACTIONS
    // =========================================================================

    addLog: (log) => set((state) => {
      state.logs.unshift(log);
      if (state.logs.length > 200) {
        state.logs = state.logs.slice(0, 200);
      }
    }),

    clearLogs: () => set((state) => {
      state.logs = [];
    }),

    updateNodeStats: (stats) => set((state) => {
      state.nodeStats[stats.nodeId] = stats;
    }),

    // =========================================================================
    // UI STATE ACTIONS
    // =========================================================================
    
    selectTask: (taskId) => set((state) => {
      state.selectedTaskId = taskId;
    }),

    selectNode: (nodeId) => set((state) => {
      state.selectedNodeId = nodeId;
    }),

    setConnected: (connected) => set((state) => {
      state.isConnected = connected;
    }),

    setRole: (role) => set((state) => {
      state.currentRole = role;
    }),

    // =========================================================================
    // UTILITY ACTIONS
    // =========================================================================
    
    reset: () => set((state) => {
      state.nodes = [];
      state.tasks = [];
      state.events = [];
      state.checkpoints = [];
      state.selectedTaskId = null;
      state.selectedNodeId = null;
      state.isConnected = false;
      state.currentRole = null;
      state.stats = initialStats;
    }),

    getNodeById: (nodeId) => {
      return get().nodes.find(n => n.id === nodeId);
    },

    getTaskById: (taskId) => {
      return get().tasks.find(t => t.id === taskId);
    },

    getWorkerNodes: () => {
      return get().nodes.filter(n => n.role === 'worker');
    },

    getLogsByNode: (nodeId) => {
      return get().logs.filter(l => l.nodeId === nodeId);
    },
  }))
);

// =============================================================================
// SELECTOR HOOKS - Các hook để lấy dữ liệu cụ thể
// =============================================================================

/**
 * Lấy danh sách nodes theo role
 */
export const useNodesByRole = (role: NodeInfo['role']) => {
  return useSystemStore(state => state.nodes.filter(n => n.role === role));
};

/**
 * Lấy task đang được chọn
 */
export const useSelectedTask = () => {
  return useSystemStore(state => {
    if (!state.selectedTaskId) return null;
    return state.tasks.find(t => t.id === state.selectedTaskId) || null;
  });
};

/**
 * Lấy node đang được chọn
 */
export const useSelectedNode = () => {
  return useSystemStore(state => {
    if (!state.selectedNodeId) return null;
    return state.nodes.find(n => n.id === state.selectedNodeId) || null;
  });
};

/**
 * Lấy events của một task cụ thể
 */
export const useTaskEvents = (taskId: string) => {
  return useSystemStore(state => state.events.filter(e => e.taskId === taskId));
};

/**
 * Lấy worker nodes đang online
 */
export const useOnlineWorkers = () => {
  return useSystemStore(state => 
    state.nodes.filter(n => n.role === 'worker' && n.status === 'online')
  );
};
