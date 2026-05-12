import { useState, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import {
  Clock,
  Camera,
  Plus,
  X,
  RotateCcw,
} from 'lucide-react';
import { versionApi, snapshotApi } from '../lib/api';
import type { Version, Snapshot } from '../types';

interface HistoryPanelProps {
  docId: string;
  socket?: Socket;
  onClose: () => void;
  onRestore: () => void;
}

type Tab = 'versions' | 'snapshots';

export default function HistoryPanel({ docId, socket, onClose, onRestore }: HistoryPanelProps) {
  const [tab, setTab] = useState<Tab>('versions');
  const [versions, setVersions] = useState<Version[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const res = await versionApi.list(docId);
      setVersions(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const res = await snapshotApi.list(docId);
      setSnapshots(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'versions') {
      loadVersions();
    } else {
      loadSnapshots();
    }
  }, [tab, docId]);

  useEffect(() => {
    if (!socket) return;

    const handleVersionCreated = (version: Version) => {
      setVersions(prev => [version, ...prev]);
    };

    const handleSnapshotCreated = (snapshot: Snapshot) => {
      setSnapshots(prev => [snapshot, ...prev]);
    };

    socket.on('version:created', handleVersionCreated);
    socket.on('snapshot:created', handleSnapshotCreated);

    return () => {
      socket.off('version:created', handleVersionCreated);
      socket.off('snapshot:created', handleSnapshotCreated);
    };
  }, [socket]);

  const createVersion = async () => {
    try {
      await versionApi.create(docId, newLabel.trim() || undefined);
      setNewLabel('');
    } catch (e) {
      console.error(e);
    }
  };

  const createSnapshot = async () => {
    try {
      await snapshotApi.create(docId, newLabel.trim() || undefined);
      setNewLabel('');
    } catch (e) {
      console.error(e);
    }
  };

  const restoreVersion = async (id: string) => {
    if (!window.confirm('确定要恢复到此版本吗？当前内容将被覆盖。')) return;
    setRestoring(true);
    try {
      await versionApi.restore(docId, id);
      onRestore();
    } catch (e) {
      console.error(e);
    } finally {
      setRestoring(false);
    }
  };

  const restoreSnapshot = async (id: string) => {
    if (!window.confirm('确定要恢复到此快照吗？当前内容将被覆盖。')) return;
    setRestoring(true);
    try {
      await snapshotApi.restore(docId, id);
      onRestore();
    } catch (e) {
      console.error(e);
    } finally {
      setRestoring(false);
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleString('zh-CN');

  const items = tab === 'versions' ? versions : snapshots;

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">版本历史</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {restoring && (
        <div className="px-4 py-2 bg-blue-50 text-blue-700 text-sm text-center">
          正在恢复文档...
        </div>
      )}

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('versions')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            tab === 'versions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <Clock className="w-4 h-4" />
            版本
          </div>
        </button>
        <button
          onClick={() => setTab('snapshots')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            tab === 'snapshots'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <Camera className="w-4 h-4" />
            快照
          </div>
        </button>
      </div>

      <div className="px-3 py-3 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="标签（可选）..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={tab === 'versions' ? createVersion : createSnapshot}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">加载中...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {tab === 'versions' ? (
              <>
                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                暂无版本历史
              </>
            ) : (
              <>
                <Camera className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                暂无快照
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800">
                    {item.label || (tab === 'versions' ? `版本 ${items.length - index}` : `快照 ${items.length - index}`)}
                  </span>
                  <button
                    onClick={() => {
                      if (tab === 'versions') {
                        restoreVersion(item.id);
                      } else {
                        restoreSnapshot(item.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-opacity"
                    title="恢复"
                    disabled={restoring}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400">{formatTime(item.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
