# Abuse Tracking & Prevention Recommendations

## Currently Implemented ✅

1. **Rate Limiting**
   - Poll creation: 5 polls/day per IP
   - Calendar invites: 100 invites/day per IP
   - Recipients per invite: 50 max

2. **IP Banning**
   - Manual IP bans with expiration
   - Automatic ban on rate limit violations (optional)

3. **Monitoring Dashboard**
   - Total polls, responses, invites
   - Rate limit hits tracking
   - Email-to-IP correlation
   - Daily statistics
   - SES cost estimation

## Recommended Additions 🎯

### 1. **Exact Email Count Tracking**
**Current Issue**: We estimate emails sent (1 per invite), but actual count is higher (multiple recipients per invite)

**Solution**: 
- Add `recipient_count` field to `rate_limits` table when recording calendar invites
- Track exact number of emails sent per invite
- Update monitoring dashboard to show accurate email counts

**SQL Migration**:
```sql
ALTER TABLE rate_limits ADD COLUMN recipient_count INTEGER;
ALTER TABLE rate_limits ADD COLUMN action_type TEXT DEFAULT 'poll_creation'; -- 'poll_creation' or 'calendar_invite'
```

### 2. **Suspicious Pattern Detection**
**What to Track**:
- Same email address from multiple IPs (potential account sharing/abuse)
- Same IP creating polls with different emails (potential spam)
- Rapid-fire invites (multiple invites in < 1 minute)
- Unusually high recipient counts per invite

**Implementation**:
- Add alerts in monitoring dashboard for:
  - Email used from 3+ different IPs
  - IP creating polls with 5+ different emails
  - Invites with 30+ recipients (approaching limit)

### 3. **Bounce/Complaint Tracking**
**Why**: High bounce or complaint rates can get your SES account suspended

**What to Track**:
- SES bounce notifications (via SNS webhook)
- SES complaint notifications
- Auto-ban IPs/emails with high bounce rates
- Alert when bounce rate > 5%

**Implementation**:
- Set up AWS SNS topic for SES bounces/complaints
- Create API endpoint to receive webhooks
- Store bounces/complaints in database
- Auto-ban after 3+ bounces or 1+ complaint

### 4. **Cost Alerts**
**Why**: Prevent unexpected AWS bills

**What to Track**:
- Daily email sending cost
- Projected monthly cost
- Alert when daily cost exceeds threshold (e.g., $1/day)

**Implementation**:
- Calculate exact cost: `(emails_sent * 0.10) / 1000`
- Show in monitoring dashboard
- Add alert banner if daily cost > $1
- Email notification if daily cost > $5

### 5. **Recipient Email Validation**
**Why**: Prevent sending to invalid/disposable emails

**What to Track**:
- Disposable email domains (10minutemail, etc.)
- Invalid email formats
- Blocked domains list

**Implementation**:
- Validate recipient emails before sending
- Check against disposable email list
- Reject invites with invalid emails
- Log validation failures

### 6. **Time-Based Rate Limiting**
**Why**: Prevent burst attacks

**What to Track**:
- Invites sent in last hour (not just 24h)
- Burst detection (10+ invites in 1 minute)

**Implementation**:
- Add hourly rate limit: 20 invites/hour per IP
- Alert on burst patterns
- Auto-throttle during bursts

### 7. **User Agent Tracking**
**Why**: Identify bots/automated abuse

**What to Track**:
- User agent strings
- Suspicious user agents (curl, python-requests, etc.)
- Flag for manual review

**Implementation**:
- Store user agent in `rate_limits` table
- Show in monitoring dashboard
- Filter by suspicious user agents

### 8. **Geographic Anomaly Detection**
**Why**: Detect VPN/proxy abuse

**What to Track**:
- IP geolocation (country/region)
- Rapid location changes for same email
- High-volume from single country

**Implementation**:
- Use IP geolocation API (free: ipapi.co, ip-api.com)
- Store country in `rate_limits` table
- Alert on rapid location changes

### 9. **Poll-to-Invite Ratio**
**Why**: Detect abuse (creating polls just to send spam invites)

**What to Track**:
- Ratio of invites sent to polls created
- Flag accounts with high ratio (e.g., 10+ invites per poll)

**Implementation**:
- Calculate: `invites_sent / polls_created` per email/IP
- Alert if ratio > 5
- Consider auto-ban if ratio > 10

### 10. **Failed Send Tracking**
**Why**: Identify delivery issues early

**What to Track**:
- Failed email sends (SES errors)
- Error types (bounce, complaint, rejection)
- Retry attempts

**Implementation**:
- Log all failed sends in database
- Show in monitoring dashboard
- Alert on high failure rate (> 10%)

## Priority Order

**High Priority (Do First)**:
1. Exact email count tracking
2. Cost alerts
3. Bounce/complaint tracking

**Medium Priority**:
4. Suspicious pattern detection
5. Time-based rate limiting
6. Failed send tracking

**Low Priority (Nice to Have)**:
7. Recipient email validation
8. User agent tracking
9. Geographic anomaly detection
10. Poll-to-invite ratio

## Quick Wins

**Easiest to Implement**:
1. Add `recipient_count` to calendar invite recording (5 min)
2. Add cost calculation to dashboard (already done!)
3. Add hourly rate limit check (10 min)

**Most Impact**:
1. Bounce/complaint tracking (prevents SES suspension)
2. Cost alerts (prevents surprise bills)
3. Exact email tracking (accurate monitoring)

