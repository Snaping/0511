import { Express, Request, Response } from 'express';
import {
  createDocument,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  createVersion,
  listVersions,
  restoreVersion,
  getVersionState,
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
  addComment,
  listComments,
  resolveComment,
  deleteComment,
  exportToMarkdown,
  loadDocumentState,
} from './services/documentService';
import { summarizeContent } from './services/aiService';
import * as Y from 'yjs';
import {
  rooms,
  broadcastCommentEvent,
  broadcastVersionCreated,
  broadcastSnapshotCreated,
  broadcastDocumentRestored,
  applyDocumentUpdate,
} from './socket';

export function setupRoutes(app: Express) {
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.get('/api/documents', async (_req: Request, res: Response) => {
    res.json(await listDocuments());
  });

  app.get('/api/documents/:id', async (req: Request, res: Response) => {
    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: '文档不存在' });
    res.json(doc);
  });

  app.post('/api/documents', async (_req: Request, res: Response) => {
    const doc = await createDocument();
    res.json(doc);
  });

  app.put('/api/documents/:id', async (req: Request, res: Response) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: '标题不能为空' });
    await updateDocument(req.params.id, title);
    res.json({ success: true });
  });

  app.delete('/api/documents/:id', async (req: Request, res: Response) => {
    await deleteDocument(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/documents/:id/versions', async (req: Request, res: Response) => {
    res.json(await listVersions(req.params.id));
  });

  app.post('/api/documents/:id/versions', async (req: Request, res: Response) => {
    const { label } = req.body;
    const docId = req.params.id;
    let state: Uint8Array | null = null;

    const room = rooms.get(docId);
    if (room) {
      state = Y.encodeStateAsUpdate(room.doc);
    } else {
      state = await loadDocumentState(docId);
    }

    if (!state) return res.status(400).json({ error: '无法获取文档状态' });

    const version = await createVersion(docId, state, label);
    broadcastVersionCreated(docId, version);
    res.json(version);
  });

  app.post('/api/documents/:id/versions/:versionId/restore', async (req: Request, res: Response) => {
    try {
      const docId = req.params.id;
      const versionId = req.params.versionId;

      const state = await getVersionState(versionId);
      if (!state) {
        return res.status(404).json({ error: 'Version not found' });
      }

      await restoreVersion(docId, versionId);
      await applyDocumentUpdate(docId, state);
      broadcastDocumentRestored(docId, 'version', versionId);

      res.json({ success: true });
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  });

  app.get('/api/documents/:id/snapshots', async (req: Request, res: Response) => {
    res.json(await listSnapshots(req.params.id));
  });

  app.post('/api/documents/:id/snapshots', async (req: Request, res: Response) => {
    const { label } = req.body;
    const docId = req.params.id;
    let state: Uint8Array | null = null;

    const room = rooms.get(docId);
    if (room) {
      state = Y.encodeStateAsUpdate(room.doc);
    } else {
      state = await loadDocumentState(docId);
    }

    if (!state) return res.status(400).json({ error: '无法获取文档状态' });

    const snapshot = await createSnapshot(docId, state, label);
    broadcastSnapshotCreated(docId, snapshot);
    res.json(snapshot);
  });

  app.post('/api/documents/:id/snapshots/:snapshotId/restore', async (req: Request, res: Response) => {
    try {
      const docId = req.params.id;
      const snapshotId = req.params.snapshotId;

      await restoreSnapshot(docId, snapshotId);

      const restoredState = await loadDocumentState(docId);
      if (restoredState) {
        await applyDocumentUpdate(docId, restoredState);
      }

      broadcastDocumentRestored(docId, 'snapshot', snapshotId);

      res.json({ success: true });
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  });

  app.get('/api/documents/:id/comments', async (req: Request, res: Response) => {
    res.json(await listComments(req.params.id));
  });

  app.post('/api/documents/:id/comments', async (req: Request, res: Response) => {
    const { content, user_name, user_id, position, parent_id } = req.body;
    if (!content) return res.status(400).json({ error: '评论内容不能为空' });

    const comment = await addComment(
      req.params.id,
      content,
      user_id || 'anonymous',
      user_name || '匿名用户',
      position,
      parent_id
    );
    broadcastCommentEvent(req.params.id, 'comment:created', comment);
    res.json(comment);
  });

  app.put('/api/comments/:id/resolve', async (req: Request, res: Response) => {
    const { resolved } = req.body;
    const comment = await resolveComment(req.params.id, resolved !== false);
    if (comment) {
      broadcastCommentEvent(comment.document_id, 'comment:updated', comment);
    }
    res.json({ success: true });
  });

  app.delete('/api/comments/:id', async (req: Request, res: Response) => {
    const comment = await deleteComment(req.params.id);
    if (comment) {
      broadcastCommentEvent(comment.document_id, 'comment:deleted', { id: comment.id });
    }
    res.json({ success: true });
  });

  app.post('/api/documents/:id/summarize', async (req: Request, res: Response) => {
    const { html } = req.body;
    if (!html) return res.status(400).json({ error: '内容不能为空' });

    try {
      const summary = await summarizeContent(html);
      res.json(summary);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/documents/:id/export/markdown', async (req: Request, res: Response) => {
    const { html } = req.body;
    if (!html) return res.status(400).json({ error: '内容不能为空' });

    try {
      const markdown = await exportToMarkdown(html);
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename=document.md');
      res.send(markdown);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
