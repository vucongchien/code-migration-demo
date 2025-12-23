/**
 * =============================================================================
 * DEMO HOOKS - Custom hooks cho Demo Dashboard
 * =============================================================================
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, DEFAULT_CONFIG } from '@/lib/constants';
import { generateId, createTask } from '@/lib/utils';
import { useSystemStore } from '@/lib/store';
import type { 
  NodeInfo, 
  Task, 
  MigrationEvent, 
  ExecutionCheckpoint,
  MigrationType,
  CodeBundle,
  LogEntry,
  NodeStats
} from '@/lib/types';

// =============================================================================
// USE SOCKET CONNECTION HOOK
// =============================================================================

interface UseSocketConnectionOptions {
  serverUrl?: string;
  nodeId: string;
  nodeName: string;
  role: 'monitor';
  autoConnect?: boolean;
}

export function useSocketConnection(options: UseSocketConnectionOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    setNodes,
    setTasks,
    addEvent,
    updateTask,
    addCheckpoint,
    addLog,
    updateNodeStats,
    setConnected,
  } = useSystemStore();

  const serverUrl = options.serverUrl || `http://localhost:${DEFAULT_CONFIG.COORDINATOR_PORT}`;

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnected(true);
      setError(null);
      
      // Đăng ký với coordinator
      socket.emit(SOCKET_EVENTS.NODE_REGISTER, {
        nodeInfo: {
          id: options.nodeId,
          name: options.nodeName,
          role: options.role,
          status: 'online',
          address: '',
        },
      });
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      setConnected(false);
      console.warn('Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
      setIsConnected(false);
      setConnected(false);
    });

    // Node events
    socket.on(SOCKET_EVENTS.NODE_LIST_UPDATE, (nodes: NodeInfo[]) => {
      setNodes(nodes);
    });

    // Task events
    socket.on(SOCKET_EVENTS.TASK_PROGRESS, (data: {
      taskId: string;
      progress: number;
      currentStep: number;
      totalSteps: number;
      message?: string;
    }) => {
      updateTask(data.taskId, { progress: data.progress });
    });

    socket.on(SOCKET_EVENTS.TASK_COMPLETE, (data: { taskId: string; result: unknown }) => {
      updateTask(data.taskId, { 
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        result: {
          success: true,
          data: data.result,
          executionTime: 0,
        }
      });
    });

    // Migration events
    socket.on(SOCKET_EVENTS.BROADCAST_EVENT, (event: MigrationEvent) => {
      addEvent(event);
    });

    // Checkpoint events
    socket.on(SOCKET_EVENTS.CHECKPOINT_SAVED, (data: { checkpoint: ExecutionCheckpoint }) => {
      addCheckpoint(data.checkpoint);
    });

    // System update
    socket.on(SOCKET_EVENTS.SYSTEM_UPDATE, (data: {
      nodes: NodeInfo[];
      tasks: Task[];
    }) => {
      setNodes(data.nodes);
      setTasks(data.tasks);
    });

    // Log events
    socket.on(SOCKET_EVENTS.LOG_MESSAGE, (log: LogEntry) => {
      addLog(log);
    });

    // Node stats events
    socket.on(SOCKET_EVENTS.NODE_STATS, (stats: NodeStats) => {
      updateNodeStats(stats);
    });

  }, [serverUrl, options.nodeId, options.nodeName, options.role, setNodes, setTasks, addEvent, updateTask, addCheckpoint, addLog, updateNodeStats, setConnected]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
    setConnected(false);
  }, [setConnected]);

  // Auto connect
  useEffect(() => {
    if (options.autoConnect !== false) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [options.autoConnect, connect, disconnect]);

  // Heartbeat loop
  useEffect(() => {
    if (!isConnected || !socketRef.current) return;

    const interval = setInterval(() => {
      socketRef.current?.emit(SOCKET_EVENTS.NODE_HEARTBEAT, {
        nodeId: options.nodeId,
      });
    }, DEFAULT_CONFIG.HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [isConnected, options.nodeId]);

  // Emit functions
  const submitTask = useCallback((task: Task) => {
    socketRef.current?.emit(SOCKET_EVENTS.TASK_SUBMIT, { task });
  }, []);

  const requestMigration = useCallback((
    taskId: string, 
    sourceNodeId: string, 
    targetNodeId: string, 
    migrationType: MigrationType
  ) => {
    socketRef.current?.emit(SOCKET_EVENTS.MIGRATION_REQUEST, {
      taskId,
      sourceNodeId,
      targetNodeId,
      migrationType,
    });
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    connect,
    disconnect,
    submitTask,
    requestMigration,
  };
}

// =============================================================================
// USE DEMO CONTROLLER HOOK
// =============================================================================

interface UseDemoControllerOptions {
  isConnected: boolean;
  submitTask: (task: Task) => void;
  requestMigration: (
    taskId: string,
    sourceNodeId: string,
    targetNodeId: string,
    migrationType: MigrationType
  ) => void;
}

export function useDemoController(options: UseDemoControllerOptions) {
  const { nodes, tasks, addTask, updateTask, clearEvents, reset } = useSystemStore();
  const [demoState, setDemoState] = useState<'idle' | 'running' | 'completed'>('idle');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // Get workers
  const workers = nodes.filter(n => n.role === 'worker' && n.status !== 'offline');

  // Start new task
  const startTask = useCallback((migrationType: MigrationType, customCode?: string) => {
    if (!options.isConnected || workers.length === 0) {
      console.warn('Cannot start task: not connected or no workers');
      return;
    }

    const task = createTask(
      `Demo ${migrationType === 'strong' ? 'Strong' : 'Weak'} Migration`,
      customCode || '', 
      migrationType,
      customCode
    );

    if (customCode) {
        task.code = customCode; // Ensure main code field is also set
    }

    addTask(task);
    setCurrentTaskId(task.id);
    setDemoState('running');
    
    options.submitTask(task);
  }, [options, workers.length, addTask]);

  // Trigger migration
  const triggerMigration = useCallback((migrationType: MigrationType) => {
    if (!currentTaskId || workers.length < 2) {
      console.warn('Cannot migrate: no current task or not enough workers');
      return;
    }

    const currentTask = tasks.find(t => t.id === currentTaskId);
    if (!currentTask || !currentTask.currentNodeId) {
      console.warn('Task not found or not assigned to any node');
      return;
    }

    const sourceNodeId = currentTask.currentNodeId;
    const targetNode = workers.find(w => w.id !== sourceNodeId);
    
    if (!targetNode) {
      console.warn('No target worker available');
      return;
    }

    updateTask(currentTaskId, { status: 'migrating' });

    options.requestMigration(
      currentTaskId,
      sourceNodeId,
      targetNode.id,
      migrationType
    );
  }, [currentTaskId, tasks, workers, updateTask, options]);

  // Reset demo
  const resetDemo = useCallback(() => {
    setDemoState('idle');
    setCurrentTaskId(null);
    clearEvents();
  }, [clearEvents]);

  // Check completion
  useEffect(() => {
    if (currentTaskId) {
      const task = tasks.find(t => t.id === currentTaskId);
      if (task?.status === 'completed') {
        setDemoState('completed');
      }
    }
  }, [currentTaskId, tasks]);

  return {
    demoState,
    currentTaskId,
    currentTask: currentTaskId ? tasks.find(t => t.id === currentTaskId) : null,
    workers,
    startTask,
    triggerMigration,
    resetDemo,
    isRunning: demoState === 'running',
    canMigrate: demoState === 'running' && workers.length >= 2,
  };
}

// =============================================================================
// USE MOCK DATA HOOK (for development without server)
// =============================================================================

export function useMockData() {
  const { setNodes, addTask, addEvent, updateTask } = useSystemStore();

  const initMockData = useCallback(() => {
    // Mock nodes
    const mockNodes: NodeInfo[] = [
      {
        id: 'coordinator-1',
        name: 'Coordinator',
        role: 'coordinator',
        status: 'online',
        address: 'localhost:3001',
        joinedAt: new Date(),
      },
      {
        id: 'worker-a',
        name: 'Worker A (Máy 2)',
        role: 'worker',
        status: 'online',
        address: 'localhost:3002',
        joinedAt: new Date(),
      },
      {
        id: 'worker-b',
        name: 'Worker B (Máy 3)',
        role: 'worker',
        status: 'online',
        address: 'localhost:3003',
        joinedAt: new Date(),
      },
      {
        id: 'registry-1',
        name: 'Registry',
        role: 'registry',
        status: 'online',
        address: 'localhost:3004',
        joinedAt: new Date(),
      },
      {
        id: 'monitor-1',
        name: 'Monitor (Máy 5)',
        role: 'monitor',
        status: 'online',
        address: 'localhost:3000',
        joinedAt: new Date(),
      },
    ];

    setNodes(mockNodes);
  }, [setNodes]);

  return { initMockData };
}
