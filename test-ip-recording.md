# Debug IP-to-Email Mapping

## Quick Test Steps:

1. **Check Demo Mode:**
   - Visit: `meet.numstro.com/create`
   - Look for yellow "Demo Mode Active" banner
   - If visible: You're in demo mode, IP tracking is disabled

2. **Check Database Setup:**
   - Go to Supabase SQL Editor
   - Run: `SELECT * FROM rate_limits LIMIT 5;`
   - Check if `creator_email` and `creator_name` columns exist

3. **Check Monitoring Dashboard:**
   - Visit: `meet.numstro.com/admin/monitoring`
   - Password: `kennyadmin2024`
   - Look at "Email-to-IP Correlation Analysis" section
   - Click "Refresh" to reload data

4. **Test API Endpoints:**
   - Open browser dev tools (F12)
   - Create a new poll
   - Check Network tab for `/api/rate-limit/record` calls
   - Look for any errors in Console tab

5. **Check Rate Limits Table:**
   In Supabase SQL Editor, run:
   ```sql
   SELECT ip_address, creator_email, creator_name, created_at 
   FROM rate_limits 
   WHERE creator_email IS NOT NULL 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

## Common Issues:

- **Demo Mode**: No Supabase env vars = no IP tracking
- **Missing Columns**: Need to run database migration
- **API Errors**: Check browser console for rate limit recording failures
- **Cache Issues**: Try hard refresh (Ctrl+F5) on monitoring dashboard
