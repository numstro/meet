import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    // Find and validate the magic link
    const { data: magicLink, error } = await supabase
      .from('magic_links')
      .select('*')
      .eq('token', token)
      .is('used_at', null) // Not already used
      .gt('expires_at', new Date().toISOString()) // Not expired
      .single()

    if (error || !magicLink) {
      return NextResponse.json({ 
        error: 'Invalid or expired magic link',
        valid: false 
      }, { status: 401 })
    }

    // Mark the token as used
    const { error: updateError } = await supabase
      .from('magic_links')
      .update({ used_at: new Date().toISOString() })
      .eq('id', magicLink.id)

    if (updateError) {
      console.error('Failed to mark token as used:', updateError)
    }

    // Return the authenticated email
    return NextResponse.json({ 
      valid: true,
      email: magicLink.email,
      message: 'Authentication successful'
    })

  } catch (error) {
    console.error('Magic link validation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
