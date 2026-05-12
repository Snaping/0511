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

export interface AISummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}
