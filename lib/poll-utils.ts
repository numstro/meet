import { supabase } from './supabase'

/**
 * Resolves a poll identifier (short_id or UUID) to the actual poll UUID.
 * This allows API routes to work with both short URLs and legacy UUID URLs.
 * 
 * @param pollIdentifier - Either a short_id (6 chars) or UUID (36 chars with hyphens)
 * @returns The poll UUID, or null if not found
 */
export async function resolvePollId(pollIdentifier: string): Promise<string | null> {
  if (!pollIdentifier) return null

  // Check if it's a UUID (contains hyphens and is 36 characters)
  const isUUID = pollIdentifier.includes('-') && pollIdentifier.length === 36

  if (isUUID) {
    // It's a UUID - verify it exists and return it
    const { data } = await supabase
      .from('polls')
      .select('id')
      .eq('id', pollIdentifier)
      .single()
    
    return data?.id || null
  } else {
    // It's a short_id - look it up and return the UUID
    const { data } = await supabase
      .from('polls')
      .select('id')
      .eq('short_id', pollIdentifier)
      .single()
    
    return data?.id || null
  }
}

