# Chat Schema Fix - Apply This Migration

The 400 error indicates the database schema doesn't match what your code expects. You MUST apply the migration to fix this.

## Option 1: Apply via Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project: `zirftywinscopzuuwdlg`
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the entire content from: `supabase/migrations/202604230002_complete_chat_schema_fix.sql`
6. Paste into the SQL editor
7. Click **Run** (or press Ctrl+Enter)

## Option 2: Apply via CLI

If you have the Supabase CLI installed:

```bash
cd /Users/thando/Desktop/devprojects/ITsNomatataWorkSpace
supabase db push
```

## What This Fixes

- Creates missing `chat_conversation_members` table
- Adds missing columns: `type`, `organization_id`, `created_by`, `last_message_at`
- Fixes `chat_messages` schema with correct columns
- Sets up proper RLS policies
- Creates required indexes

## Verify It Worked

After applying, refresh your chat page. The 400 errors should disappear.
