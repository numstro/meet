import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    
    if (!token) {
      return NextResponse.json({ error: 'Token parameter required' }, { status: 400 })
    }

    // Check if token exists and get details
    const { data: magicLink, error } = await supabase
      .from('magic_links')
      .select('*')
      .eq('token', token)
      .single()

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      token: token,
      found: !!magicLink,
      error: error?.message || null,
      tokenData: magicLink || null,
      isExpired: magicLink ? new Date(magicLink.expires_at) < new Date() : null,
      isUsed: magicLink ? !!magicLink.used_at : null
    })

  } catch (err) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: 'Unexpected error: ' + (err as Error).message
    })
  }
}
