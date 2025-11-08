import { NextRequest, NextResponse } from 'next/server'
import { supabase, isDemoMode } from '@/lib/supabase'

// Force this route to be dynamic since we access headers
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    step: 1,
    tests: [],
    success: false,
    finalMessage: ''
  }

  try {
    // Get IP
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || '127.0.0.1'

    results.ipAddress = ipAddress
    results.isDemoMode = isDemoMode

    // Test 1: Check if demo mode
    results.tests.push({
      test: 'Demo Mode Check',
      passed: !isDemoMode,
      message: isDemoMode ? '❌ Demo mode is active - IP tracking disabled' : '✅ Production mode active'
    })

    if (isDemoMode) {
      results.finalMessage = '🚨 ISSUE FOUND: You\'re in demo mode. IP tracking is disabled in demo mode.'
      return NextResponse.json(results)
    }

    // Test 2: Check table structure
    results.step = 2
    const { data: tableCheck, error: tableError } = await supabase
      .from('rate_limits')
      .select('creator_email, creator_name')
      .limit(1)

    results.tests.push({
      test: 'Rate Limits Table Structure',
      passed: !tableError,
      message: tableError ? `❌ Table issue: ${tableError.message}` : '✅ Table structure is correct'
    })

    if (tableError) {
      results.finalMessage = `🚨 ISSUE FOUND: Database table problem - ${tableError.message}`
      return NextResponse.json(results)
    }

    // Test 3: Try inserting test record
    results.step = 3
    const testEmail = `test-${Date.now()}@example.com`
    const { error: insertError } = await supabase
      .from('rate_limits')
      .insert([{
        ip_address: ipAddress,
        creator_email: testEmail,
        creator_name: 'Auto Test User',
        created_at: new Date().toISOString()
      }])

    results.tests.push({
      test: 'Database Insert Test',
      passed: !insertError,
      message: insertError ? `❌ Insert failed: ${insertError.message}` : '✅ Database insert works'
    })

    if (insertError) {
      results.finalMessage = `🚨 ISSUE FOUND: Can't insert into database - ${insertError.message}`
      return NextResponse.json(results)
    }

    // Test 4: Verify the record was created
    results.step = 4
    const { data: verifyData, error: verifyError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('creator_email', testEmail)
      .single()

    results.tests.push({
      test: 'Database Read Test',
      passed: !verifyError && !!verifyData,
      message: verifyError ? `❌ Read failed: ${verifyError.message}` : '✅ Database read works'
    })

    if (verifyError || !verifyData) {
      results.finalMessage = '🚨 ISSUE FOUND: Database insert succeeded but read failed'
      return NextResponse.json(results)
    }

    // Test 5: Check if rate limit recording API exists
    results.step = 5
    try {
      const testResponse = await fetch(`${request.nextUrl.origin}/api/rate-limit/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorEmail: 'api-test@example.com',
          creatorName: 'API Test'
        })
      })

      results.tests.push({
        test: 'Rate Limit API Test',
        passed: testResponse.ok,
        message: testResponse.ok ? '✅ Rate limit API works' : `❌ API failed: ${testResponse.status}`
      })

      if (!testResponse.ok) {
        results.finalMessage = `🚨 ISSUE FOUND: Rate limit API is broken (${testResponse.status})`
        return NextResponse.json(results)
      }
    } catch (apiError: any) {
      results.tests.push({
        test: 'Rate Limit API Test',
        passed: false,
        message: `❌ API error: ${apiError.message}`
      })
      results.finalMessage = `🚨 ISSUE FOUND: Rate limit API error - ${apiError.message}`
      return NextResponse.json(results)
    }

    // All tests passed!
    results.success = true
    results.finalMessage = '🎉 SUCCESS! IP tracking is working correctly. Try creating a poll now!'

    // Clean up test records
    await supabase
      .from('rate_limits')
      .delete()
      .eq('creator_email', testEmail)

    await supabase
      .from('rate_limits')
      .delete()
      .eq('creator_email', 'api-test@example.com')

    return NextResponse.json(results)

  } catch (error: any) {
    results.finalMessage = `🚨 UNEXPECTED ERROR: ${error.message}`
    return NextResponse.json(results, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // This will fix common permission issues
  try {
    // Fix table permissions
    await supabase.rpc('exec_sql', {
      sql: `
        GRANT ALL ON rate_limits TO anon;
        GRANT ALL ON rate_limits TO authenticated; 
        GRANT ALL ON rate_limits TO service_role;
      `
    })

    return NextResponse.json({ 
      message: '✅ Attempted to fix table permissions. Try the GET endpoint again.' 
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Permission fix failed', 
      details: error.message 
    }, { status: 500 })
  }
}
