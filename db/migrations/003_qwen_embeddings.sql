-- Preserve completed classifications while rebuilding the search index.
ALTER TABLE chunks ADD COLUMN classification_complete INTEGER NOT NULL DEFAULT 0 CHECK(classification_complete IN (0,1));
UPDATE chunks SET classification_complete=1 WHERE status='ready';
UPDATE chunks SET status='pending',error_code=NULL
WHERE status='ready' AND NOT EXISTS (
  SELECT 1 FROM chunk_embeddings e WHERE e.workspace_id=chunks.workspace_id
  AND e.chunk_id=chunks.id AND e.model='Qwen/Qwen3-Embedding-8B'
);
DELETE FROM chunk_embeddings WHERE model<>'Qwen/Qwen3-Embedding-8B';
