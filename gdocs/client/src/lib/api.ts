import axios from 'axios';
import type { Document, Version, Snapshot, Comment, AISummary } from '../types';

const API_BASE = 'http://localhost:3001/api';

const api = axios.create({ baseURL: API_BASE });

export const documentApi = {
  list: () => api.get<Document[]>('/documents'),
  get: (id: string) => api.get<Document>(`/documents/${id}`),
  create: () => api.post<Document>('/documents'),
  update: (id: string, title: string) => api.put(`/documents/${id}`, { title }),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

export const versionApi = {
  list: (docId: string) => api.get<Version[]>(`/documents/${docId}/versions`),
  create: (docId: string, label?: string) => api.post<Version>(`/documents/${docId}/versions`, { label }),
  restore: (docId: string, versionId: string) => api.post(`/documents/${docId}/versions/${versionId}/restore`),
};

export const snapshotApi = {
  list: (docId: string) => api.get<Snapshot[]>(`/documents/${docId}/snapshots`),
  create: (docId: string, label?: string) => api.post<Snapshot>(`/documents/${docId}/snapshots`, { label }),
  restore: (docId: string, snapshotId: string) => api.post(`/documents/${docId}/snapshots/${snapshotId}/restore`),
};

export const commentApi = {
  list: (docId: string) => api.get<Comment[]>(`/documents/${docId}/comments`),
  create: (docId: string, content: string, position?: string, parentId?: string) =>
    api.post<Comment>(`/documents/${docId}/comments`, {
      content,
      position,
      parent_id: parentId,
    }),
  resolve: (commentId: string, resolved: boolean) =>
    api.put(`/comments/${commentId}/resolve`, { resolved }),
  delete: (commentId: string) => api.delete(`/comments/${commentId}`),
};

export const aiApi = {
  summarize: (docId: string, html: string) =>
    api.post<AISummary>(`/documents/${docId}/summarize`, { html }),
};

export const exportApi = {
  markdown: async (docId: string, html: string) => {
    const res = await api.post(`/documents/${docId}/export/markdown`, { html }, {
      responseType: 'blob',
    });
    return res.data as Blob;
  },
};
