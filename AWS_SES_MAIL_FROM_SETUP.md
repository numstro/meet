# AWS SES MAIL FROM Domain Setup

## What is MAIL FROM?

The MAIL FROM domain is the domain used in the SMTP "envelope sender" (also called "return path" or "bounce address"). For DMARC alignment, this domain should match or be a subdomain of your sending domain (`numstro.com`).

**Current situation:**
- Sending from: `noreply@numstro.com`
- MAIL FROM: Not set (AWS uses default)
- **Problem**: MAIL FROM doesn't align with sending domain → DMARC fails

**Solution:**
- Set MAIL FROM domain to `numstro.com` or `mail.numstro.com`
- Add MX and TXT records to DNS
- This aligns MAIL FROM with your sending domain for DMARC

---

## Step-by-Step Setup

### Step 1: Configure MAIL FROM Domain in AWS SES

1. Go to AWS SES Console: https://console.aws.amazon.com/ses/
2. Make sure you're in the **us-east-2** region (where your domain is verified)
3. Go to **Verified identities** → Click on `numstro.com`
4. Click the **Configuration** tab
5. Scroll to **MAIL FROM domain** section
6. Click **Edit**

### Step 2: Enter MAIL FROM Domain

**Option A: Use root domain (Recommended)**
- Enter: `numstro.com`
- Click **Save**

**Option B: Use subdomain (Alternative)**
- Enter: `mail.numstro.com`
- Click **Save**

**I recommend Option A** (using `numstro.com`) for simplicity.

### Step 3: AWS Will Provide DNS Records

After clicking Save, AWS will show you **2 DNS records** to add:

1. **MX Record**
   - Type: `MX`
   - Name/Host: `numstro.com` (or `mail.numstro.com` if using subdomain)
   - Value: `10 feedback-smtp.us-east-2.amazonses.com`
   - Priority: `10`

2. **TXT Record (SPF)**
   - Type: `TXT`
   - Name/Host: `numstro.com` (or `mail.numstro.com` if using subdomain)
   - Value: `"v=spf1 include:amazonses.com ~all"`

**Important:** AWS will show you the exact values - use those, not the examples above!

---

## Step 4: Add DNS Records in Namecheap

### For MAIL FROM = `numstro.com`:

1. Go to Namecheap: https://www.namecheap.com/
2. Log in → **Domain List** → Click **Manage** next to `numstro.com`
3. Go to **Advanced DNS** tab

4. **Add MX Record:**
   - Click **Add New Record**
   - Type: `MX Record`
   - Host: `@` (or leave blank - Namecheap will auto-add `.numstro.com`)
   - Value: `feedback-smtp.us-east-2.amazonses.com` (use the exact value from AWS)
   - Priority: `10`
   - TTL: Automatic (or 3600)
   - Click **Save**

5. **Add TXT Record (SPF):**
   - Click **Add New Record**
   - Type: `TXT Record`
   - Host: `@` (or leave blank)
   - Value: `v=spf1 include:amazonses.com ~all` (use the exact value from AWS, including quotes if shown)
   - TTL: Automatic (or 3600)
   - Click **Save**

**Note:** If you already have an MX record for `numstro.com`, you may need to:
- Delete the old one, OR
- Add this as an additional MX record (multiple MX records are allowed)

**Note:** If you already have a TXT record with SPF, you'll need to merge them:
- Current: `v=spf1 ...`
- New: `v=spf1 include:amazonses.com ~all`
- Merged: `v=spf1 include:amazonses.com ... ~all` (combine all includes)

### For MAIL FROM = `mail.numstro.com` (if using subdomain):

1. **Add MX Record:**
   - Host: `mail` (Namecheap will auto-add `.numstro.com`)
   - Value: `feedback-smtp.us-east-2.amazonses.com`
   - Priority: `10`

2. **Add TXT Record:**
   - Host: `mail`
   - Value: `v=spf1 include:amazonses.com ~all`

---

## Step 5: Verify in AWS SES

1. Go back to AWS SES Console
2. Navigate to **Verified identities** → `numstro.com` → **Configuration** tab
3. Scroll to **MAIL FROM domain** section
4. Click **Refresh** or wait a few minutes
5. Status should change from **Pending** to **Verified** (green checkmark)

**DNS propagation can take 5-60 minutes.**

---

## Step 6: Verify DMARC Alignment

After MAIL FROM is verified, check DMARC alignment:

1. In AWS SES, go to **Verified identities** → `numstro.com`
2. Click **Authentication** tab
3. Check **DMARC** status
4. It should show **Aligned** or **Passing**

---

## Troubleshooting

**"MAIL FROM domain verification failed"**
- Double-check DNS records are exactly as AWS provided
- Wait 10-15 minutes for DNS propagation
- Use a DNS checker: https://mxtoolbox.com/SuperTool.aspx
- Make sure you're using the correct region (us-east-2)

**"MX record not found"**
- Verify the MX record is added correctly
- Check the priority value matches AWS (usually 10)
- Make sure the host is correct (`@` for root domain, `mail` for subdomain)

**"SPF record conflict"**
- If you have an existing SPF record, merge it with the new one
- Format: `v=spf1 include:amazonses.com include:other-provider.com ~all`
- Only one SPF record per domain

**"Still showing as not aligned"**
- Wait for DNS propagation (can take up to 48 hours, usually 5-60 minutes)
- Clear browser cache and refresh AWS SES console
- Check DNS records with: `dig MX numstro.com` or `nslookup -type=MX numstro.com`

---

## What This Fixes

✅ **DMARC Alignment**: MAIL FROM domain matches sending domain  
✅ **Better Deliverability**: Email providers trust aligned domains more  
✅ **Removes AWS Recommendation**: The "MAIL FROM record is not aligned" warning will disappear  
✅ **Professional Setup**: Matches best practices for transactional email  

---

## Quick Reference: DNS Records Needed

**If using `numstro.com` as MAIL FROM:**

```
Type: MX
Host: @
Value: feedback-smtp.us-east-2.amazonses.com
Priority: 10

Type: TXT
Host: @
Value: v=spf1 include:amazonses.com ~all
```

**If using `mail.numstro.com` as MAIL FROM:**

```
Type: MX
Host: mail
Value: feedback-smtp.us-east-2.amazonses.com
Priority: 10

Type: TXT
Host: mail
Value: v=spf1 include:amazonses.com ~all
```

**Important:** Use the exact values AWS provides in the console, not these examples!

