# Supabase Setup Instructions

## Step 1: Run the Base Schema

First, you need to create all the tables. Run this in the Supabase SQL Editor:

**File: `supabase/doodle-schema.sql`**

This creates:
- `polls` table
- `poll_options` table  
- `poll_responses` table
- RLS policies
- Indexes
- Helper functions

## Step 2: Run Additional Migrations (if needed)

After the base schema, you may need to run additional migrations in order:

1. `add-ip-to-polls.sql` - Adds `creator_ip` column
2. `add-soft-delete-participants.sql` - Adds `is_active` and `is_deleted` columns
3. `add-comment-column.sql` - Adds `comment` column to responses
4. `add-proposer-name.sql` - Adds `proposed_by_name` to poll_options
5. `add-archive-system.sql` - Adds `deleted_at` to polls
6. `add-short-id.sql` - Adds `short_id` column (for short URLs)

## Step 3: Run the Short ID Migration

**File: `supabase/add-short-id.sql`**

This will:
- Add `short_id` column to polls
- Generate short IDs for existing polls
- Create unique index

## Quick Setup (All-in-One)

If you're setting up a fresh database, you can run all migrations in this order:

1. `supabase/doodle-schema.sql`
2. `add-ip-to-polls.sql`
3. `add-soft-delete-participants.sql`
4. `add-comment-column.sql`
5. `add-proposer-name.sql`
6. `add-archive-system.sql`
7. `add-short-id.sql`

