import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import * as Y from 'yjs';
import TurndownService from 'turndown';
import fs from 'fs';
import path from 'path';

export interface Document {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  owner_id: string;
}

export interface Version {
  id: string;
  document_id: string;
  created_at: number;
  label: string | null;
}

export interface Snapshot {
  id: string;
  document_id: string;
  created_at: number;
  label: string | null;
}

export interface Comment {
  id: string;
  document_id: string;
  user_id: string;
  user_name: string;
  content: string;
  position: string | null;
  parent_id: string | null;
  resolved: number;
  created_at: number;
  updated_at: number;
}

const STATES_DIR = path.join(__dirname, '../../data/states');

function ensureStatesDir() {
  if (!fs.existsSync(STATES_DIR)) {
    fs.mkdirSync(STATES_DIR, { recursive: true });
  }
}

function uint8ArrayToBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString('base64');
}

function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export async function saveDocumentState(docId: string, state: Uint8Array): Promise<void> {
  ensureStatesDir();
  const filePath = path.join(STATES_DIR, `${docId}.yjs`);
  fs.writeFileSync(filePath, state);
}

export async function loadDocumentState(docId: string): Promise<Uint8Array | null> {
  ensureStatesDir();
  const filePath = path.join(STATES_DIR, `${docId}.yjs`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export async function createDocument(userId: string = 'anonymous'): Promise<Document> {
  const db = await getDb();
  const id = uuidv4();
  const now = Date.now();

  const doc: Document = {
    id,
    title: '无标题文档',
    created_at: now,
    updated_at: now,
    owner_id: userId,
  };

  db.data.documents.push(doc);
  await db.write();
  return doc;
}

export async function listDocuments(): Promise<Document[]> {
  const db = await getDb();
  return [...db.data.documents].sort((a, b) => b.updated_at - a.updated_at);
}

export async function getDocument(id: string): Promise<Document | undefined> {
  const db = await getDb();
  return db.data.documents.find(d => d.id === id);
}

export async function updateDocument(id: string, title: string): Promise<void> {
  const db = await getDb();
  const doc = db.data.documents.find(d => d.id === id);
  if (doc) {
    doc.title = title;
    doc.updated_at = Date.now();
    await db.write();
  }
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  db.data.documents = db.data.documents.filter(d => d.id !== id);
  db.data.versions = db.data.versions.filter(v => v.document_id !== id);
  db.data.snapshots = db.data.snapshots.filter(s => s.document_id !== id);
  db.data.comments = db.data.comments.filter(c => c.document_id !== id);
  await db.write();

  const statePath = path.join(STATES_DIR, `${id}.yjs`);
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
}

export async function createVersion(
  docId: string,
  state: Uint8Array,
  label?: string
): Promise<Version> {
  const db = await getDb();
  const id = uuidv4();
  const now = Date.now();

  const version = {
    id,
    document_id: docId,
    state: uint8ArrayToBase64(state),
    created_at: now,
    label: label || null,
  };

  db.data.versions.push(version);
  await db.write();

  return {
    id,
    document_id: docId,
    created_at: now,
    label: label || null,
  };
}

export async function listVersions(docId: string): Promise<Version[]> {
  const db = await getDb();
  return db.data.versions
    .filter(v => v.document_id === docId)
    .map(v => ({
      id: v.id,
      document_id: v.document_id,
      created_at: v.created_at,
      label: v.label,
    }))
    .sort((a, b) => b.created_at - a.created_at);
}

export async function getVersionState(versionId: string): Promise<Uint8Array | undefined> {
  const db = await getDb();
  const version = db.data.versions.find(v => v.id === versionId);
  return version ? base64ToUint8Array(version.state) : undefined;
}

export async function restoreVersion(docId: string, versionId: string): Promise<void> {
  const state = await getVersionState(versionId);
  if (!state) throw new Error('Version not found');
  await saveDocumentState(docId, state);
}

export async function createSnapshot(
  docId: string,
  state: Uint8Array,
  label?: string
): Promise<Snapshot> {
  const db = await getDb();
  const id = uuidv4();
  const now = Date.now();

  const snapshot = {
    id,
    document_id: docId,
    state: uint8ArrayToBase64(state),
    created_at: now,
    label: label || null,
  };

  db.data.snapshots.push(snapshot);
  await db.write();

  return {
    id,
    document_id: docId,
    created_at: now,
    label: label || null,
  };
}

export async function listSnapshots(docId: string): Promise<Snapshot[]> {
  const db = await getDb();
  return db.data.snapshots
    .filter(s => s.document_id === docId)
    .map(s => ({
      id: s.id,
      document_id: s.document_id,
      created_at: s.created_at,
      label: s.label,
    }))
    .sort((a, b) => b.created_at - a.created_at);
}

export async function restoreSnapshot(docId: string, snapshotId: string): Promise<void> {
  const db = await getDb();
  const snapshot = db.data.snapshots.find(s => s.id === snapshotId);
  if (!snapshot) throw new Error('Snapshot not found');
  await saveDocumentState(docId, base64ToUint8Array(snapshot.state));
}

export async function addComment(
  docId: string,
  content: string,
  userId: string = 'anonymous',
  userName: string = '匿名用户',
  position?: string,
  parentId?: string
): Promise<Comment> {
  const db = await getDb();
  const id = uuidv4();
  const now = Date.now();

  const comment: Comment = {
    id,
    document_id: docId,
    user_id: userId,
    user_name: userName,
    content,
    position: position || null,
    parent_id: parentId || null,
    resolved: 0,
    created_at: now,
    updated_at: now,
  };

  db.data.comments.push(comment);
  await db.write();
  return comment;
}

export async function listComments(docId: string): Promise<Comment[]> {
  const db = await getDb();
  return [...db.data.comments]
    .filter(c => c.document_id === docId)
    .sort((a, b) => b.created_at - a.created_at);
}

export async function resolveComment(commentId: string, resolved: boolean): Promise<Comment | undefined> {
  const db = await getDb();
  const comment = db.data.comments.find(c => c.id === commentId);
  if (comment) {
    comment.resolved = resolved ? 1 : 0;
    comment.updated_at = Date.now();
    await db.write();
    return { ...comment };
  }
  return undefined;
}

export async function deleteComment(commentId: string): Promise<Comment | undefined> {
  const db = await getDb();
  const idx = db.data.comments.findIndex(c => c.id === commentId);
  if (idx >= 0) {
    const deleted = { ...db.data.comments[idx] };
    db.data.comments.splice(idx, 1);
    await db.write();
    return deleted;
  }
  return undefined;
}

export async function exportToMarkdown(htmlContent: string): Promise<string> {
  const turndownService = new TurndownService();
  return turndownService.turndown(htmlContent);
}
