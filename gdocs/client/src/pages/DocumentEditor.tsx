import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  Sparkles,
  Download,
  Users,
  Wifi,
  WifiOff,
  RotateCcw,
  X,
} from 'lucide-react';
import CollabEditor from '../components/CollabEditor';
import CommentsPanel from '../components/CommentsPanel';
import HistoryPanel from '../components/HistoryPanel';
import AISummaryPanel from '../components/AISummaryPanel';
import { createCollabConnection, type Connection } from '../lib/collab';
import { documentApi, exportApi } from '../lib/api';
import { useUserStore } from '../store/userStore';
import type { Document as DocType } from '../types';

type Panel = 'comments' | 'history' | 'ai' | null;

interface RestoreNotification {
  source: 'version' | 'snapshot';
  sourceId: string;
  sourceLabel?: string;
}

export default function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, userName } = useUserStore();

  const [docInfo, setDocInfo] = useState<DocType | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [title, setTitle] = useState('');
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [restoreNotif, setRestoreNotif] = useState<RestoreNotification | null>(null);

  const editorRef = useRef<any>(null);
  const titleSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;

    documentApi.get(id).then(res => {
      setDocInfo(res.data);
      setTitle(res.data.title);
    }).catch(() => {
      navigate('/');
    });

    const conn = createCollabConnection(id, userId, userName);
    setConnection(conn);

    conn.socket.on('connect', () => setConnected(true));
    conn.socket.on('disconnect', () => setConnected(false));
    conn.socket.on('users-update', (users: string[]) => {
      setOnlineUsers(users.length);
    });

    conn.socket.on('document:restored', ({ source, sourceId }: { source: 'version' | 'snapshot', sourceId: string }) => {
      setRestoreNotif({ source, sourceId });
      setTimeout(() => setRestoreNotif(null), 5000);
    });

    return () => {
      conn.destroy();
      setConnection(null);
    };
  }, [id, userId, userName, navigate]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (titleSaveTimerRef.current) {
      window.clearTimeout(titleSaveTimerRef.current);
    }
    titleSaveTimerRef.current = window.setTimeout(() => {
      if (id && newTitle.trim()) {
        documentApi.update(id, newTitle.trim());
      }
    }, 500);
  };

  const exportMarkdown = async () => {
    if (!id || !editorRef.current) return;
    const html = editorRef.current.getHTML();
    try {
      const blob = await exportApi.markdown(id, html);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${title || 'document'}.md`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
      alert('导出失败');
    }
  };

  const getEditorHtml = () => {
    return editorRef.current?.getHTML() || '';
  };

  const handleRestore = () => {
    setActivePanel(null);
  };

  const togglePanel = (panel: Panel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  if (!docInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {restoreNotif && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
          <RotateCcw className="w-5 h-5" />
          <span>
            文档已从 {restoreNotif.source === 'version' ? '版本' : '快照'} 恢复
          </span>
          <button
            onClick={() => setRestoreNotif(null)}
            className="ml-2 p-1 hover:bg-green-500 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="返回"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex-1 max-w-2xl">
              <input
                type="text"
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="无标题文档"
                className="w-full text-xl font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 placeholder-gray-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                  connected
                    ? 'text-green-600 bg-green-50'
                    : 'text-red-600 bg-red-50'
                }`}
              >
                {connected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" />
                    <span>已连接</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>未连接</span>
                  </>
                )}
              </div>

              {onlineUsers > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-600 bg-gray-100">
                  <Users className="w-3.5 h-3.5" />
                  <span>{onlineUsers} 人在线</span>
                </div>
              )}

              <button
                onClick={() => togglePanel('comments')}
                className={`p-2 rounded-lg transition-colors ${
                  activePanel === 'comments'
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="评论"
              >
                <MessageSquare className="w-5 h-5" />
              </button>

              <button
                onClick={() => togglePanel('history')}
                className={`p-2 rounded-lg transition-colors ${
                  activePanel === 'history'
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="版本历史"
              >
                <Clock className="w-5 h-5" />
              </button>

              <button
                onClick={() => togglePanel('ai')}
                className={`p-2 rounded-lg transition-colors ${
                  activePanel === 'ai'
                    ? 'bg-yellow-100 text-yellow-600'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="AI 总结"
              >
                <Sparkles className="w-5 h-5" />
              </button>

              <button
                onClick={exportMarkdown}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                title="导出 Markdown"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-8">
            <CollabEditor
              connection={connection}
              editorRef={editorRef}
            />
          </div>
        </main>

        {activePanel === 'comments' && (
          <CommentsPanel
            docId={id!}
            socket={connection?.socket}
            onClose={() => setActivePanel(null)}
          />
        )}

        {activePanel === 'history' && (
          <HistoryPanel
            docId={id!}
            socket={connection?.socket}
            onClose={() => setActivePanel(null)}
            onRestore={handleRestore}
          />
        )}

        {activePanel === 'ai' && (
          <AISummaryPanel
            docId={id!}
            getHtml={getEditorHtml}
            onClose={() => setActivePanel(null)}
          />
        )}
      </div>
    </div>
  );
}
