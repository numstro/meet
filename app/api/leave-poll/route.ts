import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolvePollId } from '@/lib/poll-utils'

export const dynamic = 'force-dynamic'

/**
 * API route for participants to leave a poll (soft delete: set is_active = false)
 * This hides their row from the voting results but preserves the data for auditability
 */
export async function POST(request: NextRequest) {
  try {
    const { pollId: pollIdentifier, participantEmail } = await request.json()
    
    if (!pollIdentifier || !participantEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: pollId, participantEmail' },
        { status: 400 }
      )
    }

    // Resolve poll identifier (short_id or UUID) to actual UUID
    const pollId = await resolvePollId(pollIdentifier)
    if (!pollId) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      )
    }

    // Soft delete: set is_active = false for all responses from this participant
    const { error } = await supabase
      .from('poll_responses')
      .update({ is_active: false })
      .eq('poll_id', pollId)
      .eq('participant_email', participantEmail.toLowerCase().trim())

    if (error) {
      console.error('[Leave Poll] Error:', error)
      return NextResponse.json(
        { error: 'Failed to leave poll' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'You have left this poll. Your votes are no longer visible but are preserved for audit purposes.'
    })

  } catch (error: any) {
    console.error('Leave poll error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

