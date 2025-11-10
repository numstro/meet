# Meet App - Complete Documentation & History

**Project:** meet.numstro.com  
**Type:** Calendly/Doodle-style meeting poll application  
**Built:** November 2025 (2 days of development)  
**Status:** Live in production ✅

---

## 🎯 What This App Does

**Meeting availability polling tool:**
- Users create polls with multiple date/time options
- Others vote on their availability (Yes/Maybe/No)
- System highlights best time slots (most "yes" votes)
- Email-based poll recovery via magic links
- Admin dashboard for moderation

**Live at:** https://meet.numstro.com

---

## 🏗️ Technical Stack

### **Framework:**
- Next.js 14 (App Router)
- React 19
- TypeScript
- Tailwind CSS

### **Database:**
- Supabase (PostgreSQL)
- Row Level Security (RLS) enabled

### **Email:**
- Resend API for transactional emails
- Magic link authentication

### **Hosting:**
- Vercel
- Custom domain: meet.numstro.com

---

## 📊 Database Schema

### **Tables:**

#### 1. `polls`
```sql
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  creator_name TEXT NOT NULL,
  creator_email TEXT NOT NULL,
  response_deadline TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,  -- Soft delete for archiving
  CONSTRAINT polls_response_deadline_check CHECK (response_deadline > NOW())
);
```

#### 2. `poll_options`
```sql
CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  option_date DATE NOT NULL,
  time_of_day TEXT NOT NULL,  -- 'morning', 'afternoon', 'evening'
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. `votes`
```sql
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE,
  voter_name TEXT NOT NULL,
  voter_email TEXT NOT NULL,
  vote_type TEXT NOT NULL,  -- 'yes', 'maybe', 'no'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(poll_option_id, voter_email)  -- One vote per option per email
);
```

#### 4. `suggested_times`
```sql
CREATE TABLE suggested_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  suggester_name TEXT NOT NULL,
  option_date DATE NOT NULL,
  time_of_day TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 5. `magic_links`
```sql
CREATE TABLE magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_magic_links_token ON magic_links(token);
CREATE INDEX idx_magic_links_expires ON magic_links(expires_at);
```

#### 6. `rate_limits`
```sql
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  poll_count INTEGER DEFAULT 0,
  last_reset TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ip_address)
);
```

#### 7. `ip_bans`
```sql
CREATE TABLE ip_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT UNIQUE NOT NULL,
  reason TEXT,
  banned_at TIMESTAMP DEFAULT NOW()
);
```

#### 8. `rate_limit_violations`
```sql
CREATE TABLE rate_limit_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  email TEXT,
  attempted_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔐 Security Features

### **Rate Limiting**
- **5 polls per IP per day**
- Resets at midnight
- Tracked in `rate_limits` table
- Admin bypass (specific IP excluded)

### **IP Banning**
- Ban specific IPs from creating polls
- Managed from admin dashboard
- Can unban from monitoring page

### **Validation**
- Max 200 characters for poll titles
- Response deadline must be in future
- Poll options must be future dates
- Email format validation

### **Magic Links**
- 15-minute expiration
- Secure random tokens (32 bytes)
- One-time use for poll recovery
- Session-based access after authentication

---

## 🎨 Key Features

### **Poll Creation**
- Table-style interface (like voting UI)
- Multiple date/time options (Morning/Afternoon/Evening)
- Response deadline (defaults to 1 week)
- Auto-populates creator's name/email in voting form

### **Voting Interface**
- Three-choice voting (Yes/Maybe/No)
- Table format showing all options
- Red box highlights best time slots (highest score)
- Scoring: Yes=2, Maybe=1, No=0
- Edit votes functionality

### **Highlighting Logic**
- Calculates score for each option (yes*2 + maybe*1)
- Highlights highest score(s) with red border
- If tied, shows multiple red boxes
- Only highlights when 2+ people voted
- Orders options by time (Morning → Afternoon → Evening)

### **Time Suggestions**
- "Suggest a New Time" button
- Table format matching poll creation
- Shows suggester name next to option
- No email required for suggestions

### **Poll Recovery (Magic Links)**
- "Access My Polls" from homepage
- Enter email → Receive magic link
- 15-minute expiration
- Shows all polls created by that email
- Session persists (doesn't expire on refresh)

### **Poll Deletion**
- Delete button on poll page (for creator)
- Simple email verification
- No magic link required (creator convenience)
- Soft delete (sets `deleted_at` timestamp)

### **Archive System**
- **Live polls:** Active, deadline in future
- **Archived polls:** Past deadline, still accessible via link
- **Deleted polls:** Soft deleted, admin-only access
- "Find my polls" shows both live and archived

### **Admin Dashboard** (`/admin`)
- Password protected (`ADMIN_PASSWORD` env var)
- View all live polls
- View deleted polls
- Delete any poll
- See poll statistics
- Link to monitoring page

### **Monitoring Page** (`/admin/monitoring`)
- Usage statistics
- Rate limit violations log
- Email-to-IP correlation
- Ban/unban functionality
- Reset rate limits for specific IPs
- Cross-navigation with admin dashboard

---

## 🎯 User Flows

### **Create Poll:**
1. Click "Create Poll" on homepage
2. Fill in title, description, name, email
3. Set response deadline (defaults to 1 week)
4. Add date options with time buckets (table UI)
5. Submit → Redirected to poll page
6. Creator can vote immediately (name/email pre-filled)

### **Vote on Poll:**
1. Receive poll link
2. View all options in table
3. Vote Yes/Maybe/No for each option
4. Submit votes
5. See results with highlighting
6. Can edit votes later

### **Suggest Time:**
1. Click "Suggest a New Time" on poll
2. Table UI (same as poll creation)
3. Enter name, select date + times
4. Submit → Appears in suggestions list

### **Recover Polls:**
1. Click "Access My Polls" on homepage
2. Enter email
3. Receive magic link via email
4. Click link (15 min expiration)
5. See all your polls (live + archived)
6. Session persists on refresh

### **Delete Poll:**
1. Click "Delete Poll" on poll page
2. Enter creator email for verification
3. Confirm → Poll soft deleted
4. No longer visible to public
5. Admin can still see in admin dashboard

---

## 🚫 What We Removed

### **Demo Mode** (Removed)
- Initially had demo environment
- Removed per user request
- All references cleaned up

### **Recent Polls on Homepage** (Removed)
- Security/privacy concern
- Removed for user privacy

### **Complex Poll Deletion** (Simplified)
- Originally used magic links
- Too cumbersome for non-critical polls
- Now just email verification

### **Action Column Title** (Removed)
- Tables no longer show "Action" header
- Cleaner UI

### **Formula Box from Cells** (Removed)
- Initially showed formulas in cells
- Caused confusion
- Now static values + recalc button

---

## 🎨 UI/UX Decisions

### **Mobile Responsiveness**
- Table layouts optimized for mobile
- Adjusted padding, font sizes
- Min-widths to prevent overflow
- Date input doesn't bleed into other cells

### **Day Display**
- Shows day of week (e.g., "Sunday")
- Not full "Day, Month Date" format
- Cleaner, more scannable

### **Time Ordering**
- Options always sorted: Morning → Afternoon → Evening
- Consistent ordering for same date

### **Emojis**
- 🌅 Morning
- ☀️ Afternoon  
- 🌙 Evening
- Used in both creation and voting

### **Color Coding**
- Red border: Best time slot(s)
- Green: Yes votes
- Yellow: Maybe votes
- Gray: No votes

---

## 🔧 Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Resend (Email)
RESEND_API_KEY=re_...

# Admin
ADMIN_PASSWORD=your_secure_password

# Admin IP (bypass rate limiting)
ADMIN_IP=your.ip.address
```

---

## 📂 Project Structure

```
/app
├── page.tsx                     # Homepage
├── create/page.tsx              # Create poll
├── poll/[id]/page.tsx          # View/vote on poll
├── access-polls/page.tsx       # Magic link entry
├── my-polls/page.tsx           # Poll list (after auth)
├── verify-magic-link/page.tsx  # Magic link handler
├── admin/page.tsx              # Admin dashboard
├── admin/monitoring/page.tsx   # Monitoring dashboard
├── contact/page.tsx            # Contact form
└── api/
    ├── polls/route.ts          # Create poll
    ├── vote/route.ts           # Submit votes
    ├── delete-poll/route.ts    # Delete poll (email verify)
    ├── send-magic-link/route.ts # Send recovery email
    ├── verify-magic-link/route.ts # Verify token
    ├── get-user-polls/route.ts # Get polls by email
    ├── contact/route.ts        # Contact form submission
    └── admin/
        ├── polls/route.ts      # Admin: Get all polls
        ├── ban-ip/route.ts     # Ban/unban IPs
        └── reset-rate-limit/route.ts # Reset limits

/components
├── PollForm.tsx                # Poll creation form
├── VotingInterface.tsx         # Vote submission UI
└── (various other components)

/lib
└── supabase.ts                 # Supabase client setup
```

---

## 🐛 Known Issues Fixed

### **Date Logic**
- ✅ Fixed: "11/9/25 is not Saturday" (was showing wrong day)
- ✅ Now correctly parses dates and shows day of week

### **TypeScript Errors**
- ✅ Fixed: Implicit 'any' type in sorting function
- ✅ Added proper types to sort callbacks

### **Poll Deletion Persistence**
- ✅ Fixed: `deleted_at` column was missing
- ✅ Added SQL migration for soft delete

### **Expired Poll Validation**
- ✅ Prevent creating polls with past deadlines
- ✅ Prevent selecting past dates as options
- ✅ Prevent voting on expired polls
- ✅ Hide "Edit My Votes" on expired polls

### **Session Persistence**
- ✅ Fixed: "Access My Polls" page expiring on refresh
- ✅ Now uses proper session storage

### **Mobile Layout**
- ✅ Fixed: Date input bleeding into other columns
- ✅ Adjusted table widths and padding

---

## 💰 Costs

### **Current Monthly Costs:**
- Supabase: **$0** (free tier)
- Resend: **$0** (free tier - 100 emails/day)
- Vercel: **$0** (free tier)
- Domain: **$30/year** (already paid)

**Total: $0/month**

### **Potential Revenue:**
- Google AdSense (if enabled)
- Not currently monetized
- Built in 2 days, primarily as utility tool

---

## 🚀 Deployment

### **Current Setup:**
- Hosted on Vercel
- Auto-deploys from GitHub pushes
- Custom domain: meet.numstro.com
- CNAME record pointing to Vercel

### **GitHub Actions:**
- Not using GitHub Actions
- Direct Vercel webhook integration
- Push to `main` → Auto-deploy

---

## 📈 Analytics

### **Google Analytics:**
- GA4 measurement ID configured
- Tracks pageviews and user behavior
- Environment variable: `NEXT_PUBLIC_GA_MEASUREMENT_ID`

---

## 🔮 Future Enhancements (Not Built)

### **Considered but Not Implemented:**
- ❌ User accounts / authentication
- ❌ Poll editing after creation
- ❌ Calendar integrations
- ❌ Notifications for voters
- ❌ Poll comments/discussion
- ❌ Multiple organizers per poll
- ❌ Recurring poll templates
- ❌ Premium features

**Reasoning:** Keep it simple, lightweight, and free. No user accounts = lower friction.

---

## 🎯 Key Design Principles

1. **No accounts required** - Friction-free
2. **Email-based recovery** - Simple magic links
3. **Admin moderation** - Prevent abuse
4. **Rate limiting** - 5 polls/day per IP
5. **Soft deletes** - Archive, don't destroy
6. **Mobile-first** - Responsive design
7. **Fast** - Minimal dependencies
8. **Free** - No monetization (yet)

---

## 📝 Important SQL Migrations

### **Add `deleted_at` column:**
```sql
ALTER TABLE polls ADD COLUMN deleted_at TIMESTAMP;
```

### **Create indexes for performance:**
```sql
CREATE INDEX idx_polls_creator_email ON polls(creator_email);
CREATE INDEX idx_polls_deleted_at ON polls(deleted_at);
CREATE INDEX idx_magic_links_token ON magic_links(token);
CREATE INDEX idx_magic_links_expires ON magic_links(expires_at);
```

---

## 🔐 Admin Credentials

**Admin Dashboard:** `/admin`  
**Password:** Set via `ADMIN_PASSWORD` environment variable  
**Monitoring:** `/admin/monitoring` (same password)

**What admin can do:**
- View all polls (live + deleted)
- Delete any poll
- Ban/unban IP addresses
- Reset rate limits
- View usage statistics
- Monitor violations

---

## 📧 Email Templates

### **Magic Link Email:**
```
Subject: Access Your Meeting Polls

Here's your link to access your polls:
[Magic Link - expires in 15 minutes]

This link will show all polls you've created.
```

### **Contact Form Email:**
- Sent to: `dev@numstro.com`
- Includes: Name, email, message
- Using Resend API

---

## 🎨 Branding

**Name:** Meet (by Numstro)  
**Logo:** Simple text-based  
**Color Scheme:** Blue primary, clean/minimal  
**Tagline:** "Find the perfect time, together"

---

## 🐛 Debugging Tips

### **Common Issues:**

1. **Magic links not working:**
   - Check `RESEND_API_KEY` env var
   - Verify email in Resend dashboard
   - Check magic_links table for expiration

2. **Rate limiting not working:**
   - Check IP address detection in API
   - Verify rate_limits table
   - Ensure ADMIN_IP is set correctly

3. **Polls not showing:**
   - Check `deleted_at` is NULL
   - Verify RLS policies in Supabase
   - Check response_deadline > NOW()

4. **Voting errors:**
   - Check unique constraint (one vote per option per email)
   - Verify poll_option_id exists
   - Check vote_type is valid ('yes', 'maybe', 'no')

---

## 📚 Related Documentation

See also:
- `/Users/kennychang/Calendly/README.md` - Project README
- `/Users/kennychang/Calendly/sync-rate-limits.sql` - SQL migrations

---

## 🎉 Project Highlights

**Built in:** 2 days  
**Lines of code:** ~2,000  
**Features:** Poll creation, voting, magic links, admin dashboard, rate limiting, IP banning  
**Status:** Live and functional ✅  
**Users:** Available to anyone with the link  
**Revenue:** $0 (no monetization)  
**Purpose:** Utility tool / portfolio piece  

---

**This app demonstrates:**
- Full-stack Next.js development
- Supabase database design
- Email authentication (magic links)
- Admin systems (moderation, monitoring)
- Rate limiting and security
- Mobile-responsive design
- Production deployment

---

## 🔄 How to Continue Development

1. **Clone repo** (if transferring)
2. **Install deps:** `npm install`
3. **Set up .env.local** with all environment variables
4. **Run locally:** `npm run dev`
5. **Test features** with sample data
6. **Deploy changes** via git push to main

---

**For full conversation context about how this was built, see:**
- Main project: `/Users/kennychang/numstro/CONVERSATION_HISTORY.md`
- Meet app was built in parallel during Numstro development

---

**Last Updated:** November 10, 2025  
**Status:** Production-ready ✅

