# Meet App - Environment Variables Backup

**Important:** Save your actual values somewhere secure before transferring!

---

## 🔑 Required Environment Variables

### **Supabase (Database)**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```
**Where to get:** https://app.supabase.com/project/YOUR_PROJECT/settings/api

---

### **Resend (Email Service)**
```bash
RESEND_API_KEY=re_your_api_key_here
```
**Where to get:** https://resend.com/api-keys

---

### **Admin Dashboard**
```bash
ADMIN_PASSWORD=your_secure_password_here
ADMIN_IP=your.ip.address.here
```
**Notes:**
- ADMIN_PASSWORD: Any secure password you choose
- ADMIN_IP: Your IP address (bypass rate limiting) - Get from https://whatismyipaddress.com/

---

### **Google Analytics**
```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```
**Where to get:** https://analytics.google.com/

---

## 📋 Setup Checklist for New Machine/Account

### **1. Local Development (.env.local)**
- [ ] Create `.env.local` in project root
- [ ] Copy all variables above
- [ ] Fill in actual values
- [ ] Test: `npm run dev`

### **2. Vercel Production**
- [ ] Go to Vercel dashboard → Project Settings → Environment Variables
- [ ] Add each variable above
- [ ] Mark as "Production", "Preview", and "Development"
- [ ] Redeploy

---

## 🔄 If Transferring to New Accounts:

### **Same Supabase Project:**
- ✅ Keep same variables
- ✅ No changes needed

### **New Supabase Project:**
- [ ] Create new Supabase project
- [ ] Run all SQL migrations (see MEET_APP_COMPLETE_DOCUMENTATION.md)
- [ ] Get new URL and anon key
- [ ] Update env vars

### **Same Resend Account:**
- ✅ Keep same API key
- ✅ No changes needed

### **New Resend Account:**
- [ ] Create new Resend account
- [ ] Verify domain (or use their test domain)
- [ ] Get new API key
- [ ] Update env var

---

## 💾 Backup Your Current Values

**Before transferring, save these from your current setup:**

```
# From Vercel Dashboard:
NEXT_PUBLIC_SUPABASE_URL = [COPY VALUE]
NEXT_PUBLIC_SUPABASE_ANON_KEY = [COPY VALUE]
RESEND_API_KEY = [COPY VALUE]
ADMIN_PASSWORD = [COPY VALUE]
ADMIN_IP = [COPY VALUE]
NEXT_PUBLIC_GA_MEASUREMENT_ID = [COPY VALUE]
```

**Store securely** (password manager, encrypted file, etc.)

---

## 🚨 Security Note

**Never commit `.env.local` to git!**
- Already in `.gitignore`
- Contains sensitive keys
- Only store in Vercel + local machine

