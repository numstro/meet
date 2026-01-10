-- Find all polls to see what exists
SELECT id, short_id, title, creator_email, created_at 
FROM polls 
ORDER BY created_at DESC 
LIMIT 10;

-- If you know the title, search by title
-- SELECT id, short_id, title FROM polls WHERE title ILIKE '%TEST%';



