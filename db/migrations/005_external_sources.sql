CREATE TABLE external_connections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('github','airtable')),
  resource TEXT NOT NULL,
  config TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL DEFAULT '',
  revision TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  cursor TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id,provider,resource),
  UNIQUE(workspace_id,id)
);
CREATE TABLE external_records (
  workspace_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  source_url TEXT NOT NULL,
  PRIMARY KEY(connection_id,external_id),
  UNIQUE(workspace_id,document_id),
  FOREIGN KEY(workspace_id,connection_id) REFERENCES external_connections(workspace_id,id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,document_id) REFERENCES documents(workspace_id,id) ON DELETE CASCADE
);
