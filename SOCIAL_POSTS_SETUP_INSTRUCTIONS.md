# Social Posts Setup Instructions

## Problem

The app is showing: `Could not find the table 'public.social_posts' in the schema cache`

This means the table hasn't been created in your Supabase database yet.

## Solution

### Step 1: Open Supabase SQL Editor

1. Go to [supabase.com](https://supabase.com) and log in
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Setup Script

1. Open the file: `SOCIAL_POSTS_SETUP.sql` in this project
2. Copy **all** the SQL code
3. Paste it into the Supabase SQL Editor
4. Click **Run** (or press `Ctrl+Enter`)

### What This Does

✅ Creates `social_posts` table with proper schema
✅ Creates `social_post_assets` table for linking to media
✅ Adds database indexes for performance
✅ Enables Row Level Security (RLS) for data protection
✅ Creates RLS policies so users can only see their organization's data

### Step 3: Verify Success

After running the script, you should see: "Success – Server-side SQL results"

### Step 4: Refresh Your App

- Return to your app
- Refresh the page (Cmd+R or Ctrl+R)
- Try creating a social post - it should work now!

---

## Alternative: Using Migrations

If you prefer using migrations:

1. Migrations are stored in: `supabase/migrations/`
2. You have:
   - `202604120001_social_posts.sql` - Creates tables
   - `202604130001_social_posts_rls.sql` - Adds RLS policies
3. Run them in order in Supabase SQL Editor

---

## If It Still Doesn't Work

Check the browser console (F12 → Console tab) for error messages and share them. Common issues:

- **Foreign key error**: Means `organizations` table doesn't exist (need to create that first)
- **Permission error**: Check if RLS policies are interfering
- **Table already exists**: The table exists but app cache is stale - refresh page

---

## Questions?

If you get auth errors or permission denied messages, it's likely an RLS policy issue. The `SOCIAL_POSTS_SETUP.sql` file handles all of this automatically.
