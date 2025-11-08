// Demo setup - run this to see the app without Supabase
// This creates mock data for local development

const fs = require('fs')

// Create a simple .env.local for demo
const envContent = `# Demo environment - replace with real Supabase keys
NEXT_PUBLIC_SUPABASE_URL=https://demo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=demo_key
SUPABASE_SERVICE_ROLE_KEY=demo_service_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
`

fs.writeFileSync('.env.local', envContent)

console.log('✅ Created demo .env.local file')
console.log('🚀 Now run: npm run dev')
console.log('📝 Note: You\'ll need real Supabase keys for full functionality')

