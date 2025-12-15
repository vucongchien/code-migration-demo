/**
 * =============================================================================
 * UI COMPONENTS - Các component UI cho Dashboard
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import type { NodeInfo, Task, MigrationEvent, MigrationType } from '@/lib/types';
import { NODE_COLORS, STATUS_COLORS } from '@/lib/constants';
import { formatTimestamp, getTimeAgo } from '@/lib/utils';

// =============================================================================
// NODE CARD COMPONENT
// =============================================================================

interface NodeCardProps {
  node: NodeInfo;
  isSource?: boolean;
  isTarget?: boolean;
  onClick?: () => void;
}

export function NodeCard({ node, isSource, isTarget, onClick }: NodeCardProps) {
  const colors = NODE_COLORS[node.role];
  const statusColor = STATUS_COLORS[node.status];

  return (
    <div 
      className={`
        relative p-4 rounded-xl border-2 transition-all cursor-pointer
        hover:scale-105 hover:shadow-lg
        ${isSource ? 'ring-4 ring-orange-400 ring-opacity-50' : ''}
        ${isTarget ? 'ring-4 ring-green-400 ring-opacity-50' : ''}
      `}
      style={{ 
        backgroundColor: colors.bg,
        borderColor: colors.primary,
      }}
      onClick={onClick}
    >
      {/* Status indicator */}
      <div 
        className="absolute top-2 right-2 w-3 h-3 rounded-full animate-pulse"
        style={{ backgroundColor: statusColor }}
      />

      {/* Role badge */}
      <div 
        className="inline-block px-2 py-1 text-xs font-semibold text-white rounded-full mb-2"
        style={{ backgroundColor: colors.primary }}
      >
        {node.role.toUpperCase()}
      </div>

      {/* Node name */}
      <h3 className="text-lg font-bold text-gray-800">{node.name}</h3>

      {/* Node info */}
      <div className="mt-2 text-sm text-gray-600 space-y-1">
        <p><span className="font-medium">ID:</span> {node.id.slice(0, 8)}...</p>
        <p><span className="font-medium">Status:</span> {node.status}</p>
        {node.address && (
          <p><span className="font-medium">Địa chỉ:</span> {node.address}</p>
        )}
      </div>

      {/* Labels */}
      {isSource && (
        <div className="absolute -top-2 -left-2 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
          SOURCE
        </div>
      )}
      {isTarget && (
        <div className="absolute -top-2 -left-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
          TARGET
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TASK CARD COMPONENT
// =============================================================================

interface TaskCardProps {
  task: Task;
  nodeName?: string;
  onMigrate?: (type: MigrationType) => void;
}

export function TaskCard({ task, nodeName, onMigrate }: TaskCardProps) {
  const statusColor = STATUS_COLORS[task.status];

  return (
    <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-sm font-medium text-gray-500 uppercase">
            {task.status}
          </span>
        </div>
        <span className={`
          px-2 py-1 text-xs font-bold rounded-full
          ${task.migrationType === 'strong' 
            ? 'bg-purple-100 text-purple-700' 
            : 'bg-blue-100 text-blue-700'}
        `}>
          {task.migrationType.toUpperCase()} MOBILITY
        </span>
      </div>

      {/* Task name */}
      <h3 className="text-lg font-bold text-gray-800 mb-2">{task.name}</h3>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Tiến độ</span>
          <span>{task.progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      {/* Info */}
      <div className="text-sm text-gray-600 space-y-1">
        {nodeName && (
          <p><span className="font-medium">Node:</span> {nodeName}</p>
        )}
        <p><span className="font-medium">ID:</span> {task.id.slice(0, 8)}...</p>
      </div>

      {/* Migration buttons */}
      {task.status === 'running' && onMigrate && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onMigrate('weak')}
            className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg
                     hover:bg-blue-600 transition-colors"
          >
            Weak Migration
          </button>
          <button
            onClick={() => onMigrate('strong')}
            className="flex-1 px-3 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg
                     hover:bg-purple-600 transition-colors"
          >
            Strong Migration
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EVENT LOG COMPONENT
// =============================================================================

interface EventLogProps {
  events: MigrationEvent[];
  maxItems?: number;
}

export function EventLog({ events, maxItems = 10 }: EventLogProps) {
  const displayEvents = events.slice(0, maxItems);

  const getEventIcon = (type: MigrationEvent['type']) => {
    switch (type) {
      case 'migration_requested': return '📤';
      case 'migration_started': return '🚀';
      case 'checkpoint_saved': return '💾';
      case 'code_transferred': return '📦';
      case 'state_transferred': return '🔄';
      case 'migration_completed': return '✅';
      case 'migration_failed': return '❌';
      case 'execution_resumed': return '▶️';
      case 'node_failure_detected': return '⚠️';
      case 'task_recovered': return '🏥';
      default: return '📌';
    }
  };

  const getEventColor = (type: MigrationEvent['type']) => {
    switch (type) {
      case 'migration_completed': return 'border-green-500 bg-green-50';
      case 'migration_failed': return 'border-red-500 bg-red-50';
      case 'checkpoint_saved': return 'border-purple-500 bg-purple-50';
      case 'node_failure_detected': return 'border-red-500 bg-red-100'; // Đỏ đậm hơn chút
      case 'task_recovered': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  return (
    <div className="space-y-2">
      {displayEvents.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Chưa có sự kiện nào</p>
      ) : (
        displayEvents.map((event) => (
          <div 
            key={event.id}
            className={`
              p-3 rounded-lg border-l-4 transition-all
              ${getEventColor(event.type)}
            `}
          >
            <div className="flex items-start gap-2">
              <span className="text-xl">{getEventIcon(event.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 break-words">
                  {event.message}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{formatTimestamp(event.timestamp)}</span>
                  <span>•</span>
                  <span className={`font-medium ${
                    event.migrationType === 'strong' ? 'text-purple-600' : 'text-blue-600'
                  }`}>
                    {event.migrationType.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// =============================================================================
// STATS CARD COMPONENT
// =============================================================================

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  subtitle?: string;
}

export function StatsCard({ title, value, icon, color, subtitle }: StatsCardProps) {
  return (
    <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
      <div className="flex items-center gap-3">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${color}20` }}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// NETWORK TOPOLOGY COMPONENT
// =============================================================================

interface NetworkTopologyProps {
  nodes: NodeInfo[];
  sourceNodeId?: string;
  targetNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
}

export function NetworkTopology({ 
  nodes, 
  sourceNodeId, 
  targetNodeId,
  onNodeClick 
}: NetworkTopologyProps) {
  // Phân loại nodes theo role
  const coordinator = nodes.find(n => n.role === 'coordinator');
  const workers = nodes.filter(n => n.role === 'worker');
  const registry = nodes.find(n => n.role === 'registry');
  const monitor = nodes.find(n => n.role === 'monitor');

  return (
    <div className="relative p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl min-h-[400px]">
      {/* Center - Coordinator */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        {coordinator && (
          <NodeCard 
            node={coordinator}
            onClick={() => onNodeClick?.(coordinator.id)}
          />
        )}
      </div>

      {/* Left - Workers */}
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 space-y-4">
        {workers.map((worker) => (
          <NodeCard 
            key={worker.id}
            node={worker}
            isSource={worker.id === sourceNodeId}
            isTarget={worker.id === targetNodeId}
            onClick={() => onNodeClick?.(worker.id)}
          />
        ))}
      </div>

      {/* Right - Registry */}
      <div className="absolute right-4 top-1/3 transform -translate-y-1/2">
        {registry && (
          <NodeCard 
            node={registry}
            onClick={() => onNodeClick?.(registry.id)}
          />
        )}
      </div>

      {/* Bottom - Monitor */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        {monitor && (
          <NodeCard 
            node={monitor}
            onClick={() => onNodeClick?.(monitor.id)}
          />
        )}
      </div>

      {/* Connection lines (simplified) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
          </marker>
        </defs>
        {/* Lines would be drawn here based on node positions */}
      </svg>
    </div>
  );
}

// =============================================================================
// CONNECTION STATUS COMPONENT
// =============================================================================

interface ConnectionStatusProps {
  isConnected: boolean;
  serverUrl?: string;
}

export function ConnectionStatus({ isConnected, serverUrl }: ConnectionStatusProps) {
  return (
    <div className={`
      flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium
      ${isConnected 
        ? 'bg-green-100 text-green-700' 
        : 'bg-red-100 text-red-700'}
    `}>
      <div className={`
        w-2 h-2 rounded-full
        ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}
      `} />
      <span>
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
      {serverUrl && (
        <span className="text-gray-500 text-xs">
          ({serverUrl})
        </span>
      )}
    </div>
  );
}

// =============================================================================
// DEMO CONTROL PANEL COMPONENT
// =============================================================================

interface DemoControlPanelProps {
  onStartTask: (migrationType: MigrationType) => void;
  onTriggerMigration: (migrationType: MigrationType) => void;
  onReset: () => void;
  isRunning: boolean;
  disabled?: boolean;
}

export function DemoControlPanel({ 
  onStartTask, 
  onTriggerMigration, 
  onReset,
  isRunning,
  disabled 
}: DemoControlPanelProps) {
  return (
    <div className="p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
      <h2 className="text-xl font-bold text-gray-800 mb-4">🎮 Demo Controls</h2>
      
      {/* Start Task */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">1. Khởi tạo Task</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onStartTask('weak')}
            disabled={disabled || isRunning}
            className="flex-1 px-4 py-3 bg-blue-500 text-white font-semibold rounded-xl
                     hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all hover:scale-105"
          >
            🔵 Start (Weak)
          </button>
          <button
            onClick={() => onStartTask('strong')}
            disabled={disabled || isRunning}
            className="flex-1 px-4 py-3 bg-purple-500 text-white font-semibold rounded-xl
                     hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all hover:scale-105"
          >
            🟣 Start (Strong)
          </button>
        </div>
      </div>

      {/* Trigger Migration */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">2. Trigger Migration</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onTriggerMigration('weak')}
            disabled={disabled || !isRunning}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 
                     text-white font-semibold rounded-xl
                     hover:from-blue-600 hover:to-cyan-600 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all hover:scale-105"
          >
            ⚡ Weak Migration
          </button>
          <button
            onClick={() => onTriggerMigration('strong')}
            disabled={disabled || !isRunning}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 
                     text-white font-semibold rounded-xl
                     hover:from-purple-600 hover:to-pink-600 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all hover:scale-105"
          >
            🚀 Strong Migration
          </button>
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        disabled={disabled}
        className="w-full px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-xl
                 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed
                 transition-colors"
      >
        🔄 Reset Demo
      </button>
    </div>
  );
}
