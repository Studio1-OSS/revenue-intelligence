CREATE TABLE tally_connections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL,
  last_received_at TEXT,
  imported_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(workspace_id,id)
);

CREATE TABLE tally_receipts (
  workspace_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY(connection_id,form_id,submission_id),
  FOREIGN KEY(workspace_id,connection_id) REFERENCES tally_connections(workspace_id,id) ON DELETE CASCADE
);
