import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    // Get the most recent unused magic link for this email
    const { data, error } = await supabase
      .from('magic_links')
      .select('token, expires_at, created_at')
      .eq('email', email.toLowerCase())
      .is('used_at', null) // Not used yet
      .gt('expires_at', new Date().toISOString()) // Not expired
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json({ 
        error: 'No valid magic link found. Please request a new one.' 
      }, { status: 404 })
    }

    // Create the magic link URL
    const magicUrl = `${request.nextUrl.origin}/auth/magic?token=${data.token}`
    
    return NextResponse.json({ 
      success: true,
      magicUrl,
      expiresAt: data.expires_at,
      createdAt: data.created_at
    })

  } catch (error) {
    console.error('Get magic link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
