import { useState } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  FileText,
  CheckCircle2,
  ListTodo,
} from 'lucide-react';
import { aiApi } from '../lib/api';
import type { AISummary } from '../types';

interface AISummaryPanelProps {
  docId: string;
  getHtml: () => string;
  onClose: () => void;
}

export default function AISummaryPanel({ docId, getHtml, onClose }: AISummaryPanelProps) {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    const html = getHtml();
    if (!html || html.replace(/<[^>]*>/g, '').trim().length < 20) {
      setError('文档内容太少，无法生成总结');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await aiApi.summarize(docId, html);
      setSummary(res.data);
    } catch (e) {
      setError('生成总结失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          AI 文档总结
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!summary && !loading && !error && (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-yellow-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">
              点击下方按钮，AI 将分析您的文档内容进行智能总结
            </p>
            <button
              onClick={generateSummary}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              生成总结
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-yellow-500 mx-auto mb-3 animate-spin" />
            <p className="text-gray-500 text-sm">AI 正在分析文档...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button
              onClick={generateSummary}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200"
            >
              重试
            </button>
          </div>
        )}

        {summary && !loading && (
          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                内容摘要
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed bg-blue-50 p-3 rounded-lg">
                {summary.summary}
              </p>
            </div>

            {summary.keyPoints.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  关键点
                </h4>
                <ul className="space-y-2">
                  {summary.keyPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-gray-700 flex items-start gap-2 bg-green-50 p-2 rounded"
                    >
                      <span className="text-green-600 mt-0.5">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.actionItems.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-orange-500" />
                  待办事项
                </h4>
                <ul className="space-y-2">
                  {summary.actionItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-gray-700 flex items-start gap-2 bg-orange-50 p-2 rounded"
                    >
                      <span className="text-orange-600 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={generateSummary}
              className="w-full mt-4 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              重新生成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
