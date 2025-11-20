import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolvePollId } from '@/lib/poll-utils'

export const dynamic = 'force-dynamic'

/**
 * API route for organizers to remove a participant (soft delete: set is_deleted = true)
 * This hides the participant's row from voting results and excludes their votes from counts
 * Only the poll creator can remove participants
 */
export async function POST(request: NextRequest) {
  try {
    const { pollId: pollIdentifier, participantEmail, creatorEmail } = await request.json()
    
    if (!pollIdentifier || !participantEmail || !creatorEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: pollId, participantEmail, creatorEmail' },
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

    // Verify creator email matches poll creator
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('creator_email')
      .eq('id', pollId)
      .eq('creator_email', creatorEmail.toLowerCase().trim())
      .single()

    if (pollError || !poll) {
      return NextResponse.json(
        { error: 'Unauthorized: Only the poll creator can remove participants.' },
        { status: 403 }
      )
    }

    // Soft delete: set is_deleted = true for all responses from this participant
    const { error } = await supabase
      .from('poll_responses')
      .update({ is_deleted: true })
      .eq('poll_id', pollId)
      .eq('participant_email', participantEmail.toLowerCase().trim())

    if (error) {
      console.error('[Remove Participant] Error:', error)
      return NextResponse.json(
        { error: 'Failed to remove participant' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Participant removed. Their votes are no longer visible or counted.'
    })

  } catch (error: any) {
    console.error('Remove participant error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

