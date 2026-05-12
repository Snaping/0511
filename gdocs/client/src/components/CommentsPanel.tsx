import { useState, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import {
  MessageSquare,
  Send,
  Check,
  X,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import { commentApi } from '../lib/api';
import type { Comment } from '../types';

interface CommentsPanelProps {
  docId: string;
  socket?: Socket;
  onClose: () => void;
}

export default function CommentsPanel({ docId, socket, onClose }: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const loadComments = async () => {
    setLoading(true);
    try {
      const res = await commentApi.list(docId);
      setComments(res.data);
    } catch (e) {
      console.error('Failed to load comments', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [docId]);

  useEffect(() => {
    if (!socket) return;

    const handleCommentCreated = (comment: Comment) => {
      setComments(prev => [comment, ...prev]);
    };

    const handleCommentUpdated = (updated: Comment) => {
      setComments(prev => prev.map(c => c.id === updated.id ? updated : c));
    };

    const handleCommentDeleted = ({ id }: { id: string }) => {
      setComments(prev => prev.filter(c => c.id !== id));
    };

    socket.on('comment:created', handleCommentCreated);
    socket.on('comment:updated', handleCommentUpdated);
    socket.on('comment:deleted', handleCommentDeleted);

    return () => {
      socket.off('comment:created', handleCommentCreated);
      socket.off('comment:updated', handleCommentUpdated);
      socket.off('comment:deleted', handleCommentDeleted);
    };
  }, [socket]);

  const addComment = async () => {
    if (!newComment.trim()) return;
    try {
      await commentApi.create(docId, newComment.trim());
      setNewComment('');
    } catch (e) {
      console.error('Failed to add comment', e);
    }
  };

  const toggleResolve = async (comment: Comment) => {
    try {
      await commentApi.resolve(comment.id, comment.resolved !== 1);
    } catch (e) {
      console.error('Failed to resolve', e);
    }
  };

  const deleteComment = async (id: string) => {
    if (!window.confirm('确定删除这条评论？')) return;
    try {
      await commentApi.delete(id);
    } catch (e) {
      console.error('Failed to delete', e);
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleString('zh-CN');

  const rootComments = comments.filter(c => !c.parent_id);

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          评论 ({comments.length})
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="px-3 py-3 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="添加评论..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => {
              if (e.key === 'Enter') addComment();
            }}
          />
          <button
            onClick={addComment}
            disabled={!newComment.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">加载中...</div>
        ) : rootComments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            暂无评论
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rootComments.map(comment => (
              <div
                key={comment.id}
                className={`px-4 py-3 ${
                  comment.resolved ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800">
                    {comment.user_name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleResolve(comment)}
                      className={`p-1 rounded hover:bg-gray-100 ${
                        comment.resolved
                          ? 'text-green-600'
                          : 'text-gray-400'
                      }`}
                      title={comment.resolved ? '取消解决' : '标记已解决'}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-1">{comment.content}</p>
                <p className="text-xs text-gray-400">{formatTime(comment.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
