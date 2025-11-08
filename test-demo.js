// Quick test of demo data
const { createDemoSupabase } = require('./lib/demo-data.ts')

async function testDemo() {
  const supabase = createDemoSupabase()
  
  console.log('Testing demo supabase...')
  
  try {
    const result = await supabase
      .from('polls')
      .select('*')
      .eq('id', '1')
      .single()
    
    console.log('Result:', result)
  } catch (err) {
    console.error('Error:', err)
  }
}

testDemo()

