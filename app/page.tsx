/**
 * =============================================================================
 * DASHBOARD PAGE - Trang chính Demo Code Migration
 * =============================================================================
 * 
 * Đây là trang Monitor Dashboard (Máy 5) để hiển thị và điều khiển demo.
 */

'use client';

import { useEffect, useState } from 'react';
import { generateId } from '@/lib/utils';
import { useSystemStore } from '@/lib/store';
import { 
  NodeCard, 
  TaskCard, 
  EventLog, 
  StatsCard,
  DemoControlPanel,
  ConnectionStatus 
} from '@/components/ui/dashboard-components';
import { useSocketConnection, useDemoController, useMockData } from '@/hooks/use-demo';
import type { MigrationType } from '@/lib/types';

// =============================================================================
// MAIN DASHBOARD PAGE
// =============================================================================

export default function DashboardPage() {
  const [useMock, setUseMock] = useState(false);
  const { initMockData } = useMockData();
  
  // Store state
  const { nodes, tasks, events, stats, isConnected } = useSystemStore();

  // Monitor ID (stable)
  const [monitorId] = useState(() => `monitor-${generateId().slice(0, 8)}`);

  // Socket connection
  const { 
    isConnected: socketConnected, 
    error: socketError,
    submitTask,
    requestMigration,
    connect,
  } = useSocketConnection({
    nodeId: monitorId,
    nodeName: 'Monitor Dashboard',
    role: 'monitor',
    autoConnect: !useMock,
  });

  // Demo controller
  const {
    demoState,
    currentTask,
    workers,
    startTask,
    triggerMigration,
    resetDemo,
    isRunning,
  } = useDemoController({
    isConnected: socketConnected || useMock,
    submitTask,
    requestMigration,
  });

  // Init mock data if using mock mode
  useEffect(() => {
    if (useMock) {
      initMockData();
    }
  }, [useMock, initMockData]);

  // Get source and target for visualization
  const sourceNodeId = currentTask?.currentNodeId;
  const targetNodeId = workers.find(w => w.id !== sourceNodeId)?.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                🚀 Code Migration Demo
              </h1>
              <p className="text-sm text-purple-300">
                Hệ thống phân tán - Weak & Strong Mobility
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Mock mode toggle */}
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMock}
                  onChange={(e) => setUseMock(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                Mock Mode
              </label>
              <ConnectionStatus 
                isConnected={socketConnected || useMock} 
                serverUrl={useMock ? 'Mock' : 'localhost:3001'}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Connection Error */}
        {socketError && !useMock && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-xl text-red-200">
            <p className="font-semibold">⚠️ Lỗi kết nối: {socketError}</p>
            <p className="text-sm mt-1">
              Hãy chạy Coordinator server: <code className="bg-black/30 px-2 py-1 rounded">npm run coordinator</code>
            </p>
            <button
              onClick={connect}
              className="mt-2 px-4 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="Nodes Online"
            value={stats.onlineNodes}
            icon="🖥️"
            color="#10B981"
          />
          <StatsCard
            title="Tasks Đang Chạy"
            value={stats.runningTasks}
            icon="⚡"
            color="#3B82F6"
          />
          <StatsCard
            title="Migrations Thành Công"
            value={stats.completedMigrations}
            icon="✅"
            color="#8B5CF6"
          />
          <StatsCard
            title="Migrations Thất Bại"
            value={stats.failedMigrations}
            icon="❌"
            color="#EF4444"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Network Topology */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4">🌐 Network Topology</h2>
              
              {/* Nodes Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {nodes.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-400">
                    {useMock 
                      ? 'Click "Mock Mode" để tạo nodes giả lập'
                      : 'Chưa có node nào kết nối. Hãy khởi động Coordinator.'
                    }
                  </div>
                ) : (
                  nodes.map((node) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      isSource={node.id === sourceNodeId}
                      isTarget={node.id === targetNodeId}
                    />
                  ))
                )}
              </div>

              {/* Migration Arrow Visualization */}
              {currentTask?.status === 'migrating' && sourceNodeId && targetNodeId && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-white/10">
                  <div className="flex items-center justify-center gap-4 text-white">
                    <span className="px-3 py-1 bg-orange-500/30 rounded-lg text-sm">
                      {nodes.find(n => n.id === sourceNodeId)?.name}
                    </span>
                    <span className="text-2xl animate-pulse">
                      {currentTask.migrationType === 'strong' ? '🚀→' : '📦→'}
                    </span>
                    <span className="px-3 py-1 bg-green-500/30 rounded-lg text-sm">
                      {nodes.find(n => n.id === targetNodeId)?.name}
                    </span>
                  </div>
                  <p className="text-center text-sm text-gray-300 mt-2">
                    {currentTask.migrationType === 'strong' 
                      ? 'Strong Migration: Code + State đang được transfer...'
                      : 'Weak Migration: Code đang được transfer...'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Current Task */}
            {currentTask && (
              <div className="mt-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-4">📋 Task Hiện Tại</h2>
                <TaskCard
                  task={currentTask}
                  nodeName={nodes.find(n => n.id === currentTask.currentNodeId)?.name}
                />
              </div>
            )}
          </div>

          {/* Right Column - Controls & Events */}
          <div className="space-y-6">
            {/* Demo Controls */}
            <DemoControlPanel
              onStartTask={startTask}
              onTriggerMigration={triggerMigration}
              onReset={resetDemo}
              isRunning={isRunning}
              disabled={!socketConnected && !useMock}
            />

            {/* Event Log */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4">📜 Event Log</h2>
              <div className="max-h-80 overflow-y-auto">
                <EventLog events={events} maxItems={15} />
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h2 className="text-xl font-bold text-white mb-4">📖 Hướng Dẫn Demo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-300 text-sm">
            <div>
              <h3 className="font-semibold text-blue-400 mb-2">🔵 Weak Mobility</h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>Click <strong>"Start (Weak)"</strong> để bắt đầu task</li>
                <li>Task sẽ chạy trên Worker A</li>
                <li>Click <strong>"Weak Migration"</strong> để di trú</li>
                <li>Task sẽ <strong>restart từ đầu</strong> trên Worker B</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-purple-400 mb-2">🟣 Strong Mobility</h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>Click <strong>"Start (Strong)"</strong> để bắt đầu task</li>
                <li>Task sẽ chạy và tạo checkpoints</li>
                <li>Click <strong>"Strong Migration"</strong> để di trú</li>
                <li>Task sẽ <strong>tiếp tục từ checkpoint</strong> trên Worker B</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>Đồ án Hệ thống Phân tán - Demo Code Migration</p>
          <p>Next.js 16 • Socket.IO • TypeScript</p>
        </footer>
      </main>
    </div>
  );
}
