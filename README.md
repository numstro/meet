# Meetup - Find the Perfect Time

A simple, clean polling application built with Next.js and Supabase. Perfect for coordinating meetings with friends and small groups - just like Doodle!

## Features

- 📊 **Create Polls** - Set up events with multiple date/time options
- ✅ **Vote on Availability** - Participants mark Yes/No/Maybe for each option
- 📈 **Visual Results** - See which times work best for everyone
- 👥 **No Accounts Required** - Just names and emails
- 🔗 **Easy Sharing** - Share poll links with anyone
- 📱 **Responsive Design** - Works on desktop and mobile
- 🏆 **Best Time Highlighting** - Automatically shows most popular options

## How It Works

1. **Create a Poll** - Add event details and suggest multiple time options
2. **Share the Link** - Send the poll URL to participants
3. **Collect Votes** - People mark their availability for each option
4. **Pick the Best Time** - See results and choose the time that works for most people

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase (Optional)

For demo mode, the app works without Supabase. For production:

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

4. Run the SQL schema in your Supabase SQL editor:

```sql
-- Copy and paste the contents of supabase/doodle-schema.sql
```

### 3. Run the App

```bash
npm run dev
```

Visit `http://localhost:3000` to see your polling app!

## Usage

### Creating a Poll

1. Click "Create Poll" in the header
2. Fill in event details (title, description, location, etc.)
3. Add multiple date/time options
4. Submit to create the poll
5. Share the poll URL with participants

### Voting on a Poll

1. Visit a poll URL
2. Enter your name and email
3. Mark your availability for each time option:
   - ✅ **Yes** - You're available
   - ❓ **Maybe** - You might be available
   - ❌ **No** - You're not available
4. Submit your responses

### Viewing Results

- See real-time results as people vote
- Best options are highlighted with 🏆
- View participant list and their responses
- Results update automatically

## Demo Mode

The app includes demo data so you can try it immediately:

- **Sample poll**: "Team Coffee Meeting" 
- **Mock responses** from Alice and Bob
- **Full functionality** without database setup

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repo to Vercel
3. Add environment variables in Vercel dashboard (if using Supabase)
4. Deploy!

### Deploy to Other Platforms

This app works on any platform that supports Next.js:
- Railway
- Render  
- DigitalOcean App Platform
- AWS Amplify

## Customization

### Styling

- Edit `app/globals.css` for global styles
- Modify Tailwind classes in components
- Update colors in `tailwind.config.js`

### Features to Add

- **Email notifications** when polls are created/updated
- **Calendar integration** to check actual availability
- **Anonymous voting** option
- **Poll templates** for common meeting types
- **Export results** to calendar apps
- **Deadline reminders**

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + API)
- **Styling**: Tailwind CSS with custom components
- **Deployment**: Vercel
- **Database**: PostgreSQL with Row Level Security

## Database Schema

The app uses three main tables:

- **polls** - Event details and metadata
- **poll_options** - Date/time options for each poll  
- **poll_responses** - Participant votes for each option

## Support

This is a simple project for personal use. Feel free to modify and extend it for your needs!

## License

MIT License - feel free to use this for any purpose.