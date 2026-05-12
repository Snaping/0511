import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Trash2, Clock, User } from 'lucide-react';
import { documentApi } from '../lib/api';
import type { Document } from '../types';
import { useUserStore } from '../store/userStore';

export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { userName, setUserName } = useUserStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await documentApi.list();
      setDocuments(res.data);
    } catch (e) {
      console.error('Failed to load documents', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const createDocument = async () => {
    const res = await documentApi.create();
    navigate(`/doc/${res.data.id}`);
  };

  const deleteDocument = async (id: string) => {
    if (!window.confirm('确定要删除这个文档吗？')) return;
    await documentApi.delete(id);
    loadDocuments();
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN');
  };

  const saveUserName = () => {
    if (nameInput.trim()) {
      setUserName(nameInput.trim());
    }
    setEditingName(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">协同文档系统</h1>
          </div>
          <div className="flex items-center gap-3">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && saveUserName()}
                />
                <button
                  onClick={saveUserName}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  保存
                </button>
                <button
                  onClick={() => { setEditingName(false); setNameInput(userName); }}
                  className="px-3 py-1.5 text-gray-600 rounded-md text-sm hover:bg-gray-100"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md text-sm"
              >
                <User className="w-4 h-4" />
                {userName}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">我的文档</h2>
          <button
            onClick={createDocument}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            新建文档
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">还没有任何文档</p>
            <button
              onClick={createDocument}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              创建第一个文档
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => navigate(`/doc/${doc.id}`)}
                  >
                    <h3 className="font-medium text-gray-900 group-hover:text-blue-600 mb-2">
                      {doc.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDate(doc.updated_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除文档"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
