-- Add board_type column to clients table
-- This column distinguishes between client-facing boards and internal/company boards

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS board_type TEXT NOT NULL DEFAULT 'client' CHECK (board_type IN ('client', 'internal'));

-- Add comment for documentation
COMMENT ON COLUMN clients.board_type IS 'Type of board: "client" for client-facing projects, "internal" for company internal projects';
