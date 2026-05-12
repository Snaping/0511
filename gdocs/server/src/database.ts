import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DocumentRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  owner_id: string;
}

interface VersionRow {
  id: string;
  document_id: string;
  state: string;
  created_at: number;
  label: string | null;
}

interface SnapshotRow {
  id: string;
  document_id: string;
  state: string;
  created_at: number;
  label: string | null;
}

interface CommentRow {
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

interface DatabaseSchema {
  documents: DocumentRow[];
  versions: VersionRow[];
  snapshots: SnapshotRow[];
  comments: CommentRow[];
}

const defaultData: DatabaseSchema = {
  documents: [],
  versions: [],
  snapshots: [],
  comments: [],
};

let db: Low<DatabaseSchema> | null = null;

export async function getDb(): Promise<Low<DatabaseSchema>> {
  if (!db) {
    const file = path.join(DATA_DIR, 'db.json');
    const adapter = new JSONFile<DatabaseSchema>(file);
    db = new Low(adapter, defaultData);
    await db.read();
    if (!db.data) {
      db.data = { ...defaultData };
    }
  }
  return db;
}

export async function setupDatabase(): Promise<void> {
  await getDb();
}
