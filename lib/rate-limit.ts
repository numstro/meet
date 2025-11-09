import { supabase, isDemoMode } from './supabase'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
  reason?: string // Why it was blocked (banned, rate limited, etc.)
}

const RATE_LIMIT_MAX = 5 // Maximum polls per day
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// Admin IPs that bypass rate limiting
const ADMIN_IPS = ['75.54.101.187'] // Kenny's IP

export async function checkRateLimit(ipAddress: string): Promise<RateLimitResult> {
  // In demo mode, always allow
  if (isDemoMode) {
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetTime: new Date(Date.now() + RATE_LIMIT_WINDOW)
    }
  }

  // Admin IPs bypass rate limiting
  if (ADMIN_IPS.includes(ipAddress)) {
    return {
      allowed: true,
      remaining: 999,
      resetTime: new Date(Date.now() + RATE_LIMIT_WINDOW)
    }
  }

  try {
    // First, check if IP is banned
    const { data: banData } = await supabase
      .from('banned_ips')
      .select('*')
      .eq('ip_address', ipAddress)
      .eq('is_active', true)
      .single()

    if (banData) {
      // Check if ban is expired
      if (banData.expires_at && new Date(banData.expires_at) <= new Date()) {
        // Ban expired, deactivate it
        await supabase
          .from('banned_ips')
          .update({ is_active: false })
          .eq('id', banData.id)
      } else {
        // IP is banned
        return {
          allowed: false,
          remaining: 0,
          resetTime: banData.expires_at ? new Date(banData.expires_at) : new Date(Date.now() + RATE_LIMIT_WINDOW * 365), // 1 year for permanent
          reason: `IP banned: ${banData.reason || 'No reason provided'}`
        }
      }
    }

    const now = new Date()
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW)

  // Count actual polls created by this IP in the last 24 hours
  console.log(`🔍 RATE LIMIT CHECK: IP ${ipAddress}, window start: ${windowStart.toISOString()}`)
  
  const { data, error } = await supabase
    .from('polls')
    .select('*')
    .eq('creator_ip', ipAddress)
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: false })

  console.log(`🔍 RATE LIMIT QUERY RESULT: error=${!!error}, data count=${data?.length || 0}`)

  if (error) {
    console.error('🚨 RATE LIMIT CHECK ERROR:', error)
    // If we can't check rate limits, allow the request but log the error
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetTime: new Date(now.getTime() + RATE_LIMIT_WINDOW)
    }
  }

  const pollsCreated = data?.length || 0
  const allowed = pollsCreated < RATE_LIMIT_MAX

  console.log(`🔍 RATE LIMIT DECISION: ${pollsCreated}/${RATE_LIMIT_MAX} polls, allowed=${allowed}`)

  // Simple violation logging for repeat offenders
  if (!allowed) {
    console.log(`🚨 RATE LIMIT VIOLATION: IP ${ipAddress} attempted poll creation (${pollsCreated}/${RATE_LIMIT_MAX} polls in 24h)`)
  }

  const remaining = Math.max(0, RATE_LIMIT_MAX - pollsCreated)

    // Calculate reset time (24 hours from the first request in current window)
    const firstRequestTime = data && data.length > 0 
      ? new Date(data[data.length - 1].created_at)
      : now
    const resetTime = new Date(firstRequestTime.getTime() + RATE_LIMIT_WINDOW)

    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining, // Subtract 1 if this request will be allowed
      resetTime,
      reason: allowed ? undefined : `Rate limit exceeded (${pollsCreated}/${RATE_LIMIT_MAX} polls in 24h)`
    }
  } catch (err) {
    console.error('Rate limit check failed:', err)
    // On error, allow the request
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetTime: new Date(Date.now() + RATE_LIMIT_WINDOW)
    }
  }
}

export async function recordRateLimit(ipAddress: string, creatorEmail?: string, creatorName?: string): Promise<void> {
  // Don't record in demo mode
  if (isDemoMode) return

  try {
    const { error } = await supabase
      .from('rate_limits')
      .insert([{
        ip_address: ipAddress,
        creator_email: creatorEmail || null,
        creator_name: creatorName || null,
        created_at: new Date().toISOString()
      }])

    if (error) {
      console.error('Failed to record rate limit:', error)
    }
  } catch (err) {
    console.error('Rate limit recording failed:', err)
  }
}

// Record a rate limit violation
export async function recordViolation(
  ipAddress: string, 
  creatorEmail?: string, 
  creatorName?: string,
  violationType?: string,
  userAgent?: string,
  attemptedAction?: string,
  currentCount?: number
): Promise<void> {
  if (isDemoMode) return

  try {
    const { error } = await supabase
      .from('rate_limit_violations')
      .insert([{
        ip_address: ipAddress,
        creator_email: creatorEmail || null,
        creator_name: creatorName || null,
        violation_type: violationType || 'rate_limit_exceeded',
        attempted_action: attemptedAction || 'create_poll',
        current_count: currentCount || null,
        limit_exceeded: RATE_LIMIT_MAX,
        user_agent: userAgent || null,
        created_at: new Date().toISOString()
      }])

    if (error) {
      console.error('Failed to record violation:', error)
    }
  } catch (err) {
    console.error('Violation recording failed:', err)
  }
}

// Ban an IP address
export async function banIP(
  ipAddress: string, 
  reason: string, 
  bannedBy: string, 
  expiresAt?: Date
): Promise<void> {
  if (isDemoMode) return

  try {
    const { error } = await supabase
      .from('banned_ips')
      .insert([{
        ip_address: ipAddress,
        reason: reason,
        banned_by: bannedBy,
        expires_at: expiresAt?.toISOString() || null,
        is_active: true,
        created_at: new Date().toISOString()
      }])

    if (error) {
      console.error('Failed to ban IP:', error)
      throw new Error('Failed to ban IP address')
    }
  } catch (err) {
    console.error('IP banning failed:', err)
    throw err
  }
}

// Unban an IP address
export async function unbanIP(ipAddress: string): Promise<void> {
  if (isDemoMode) return

  try {
    const { error } = await supabase
      .from('banned_ips')
      .update({ is_active: false })
      .eq('ip_address', ipAddress)
      .eq('is_active', true)

    if (error) {
      console.error('Failed to unban IP:', error)
      throw new Error('Failed to unban IP address')
    }
  } catch (err) {
    console.error('IP unbanning failed:', err)
    throw err
  }
}

// Get all banned IPs
export async function getBannedIPs(): Promise<any[]> {
  if (isDemoMode) return []

  try {
    const { data, error } = await supabase
      .from('banned_ips')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to get banned IPs:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Getting banned IPs failed:', err)
    return []
  }
}

// Clean up old rate limit records (call this periodically)
export async function resetRateLimit(ipAddress: string): Promise<{ success: boolean; message: string }> {
  if (isDemoMode) {
    return { success: true, message: 'Rate limit reset (demo mode)' }
  }

  try {
    // Delete all polls created by this IP in the last 24 hours to reset their rate limit
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW)
    
    const { error } = await supabase
      .from('polls')
      .delete()
      .eq('creator_ip', ipAddress)
      .gte('created_at', windowStart.toISOString())

    if (error) {
      console.error('Rate limit reset error:', error)
      return { success: false, message: 'Failed to reset rate limit' }
    }

    return { 
      success: true, 
      message: `Rate limit reset for IP ${ipAddress}` 
    }
  } catch (err) {
    console.error('Rate limit reset error:', err)
    return { success: false, message: 'Internal error' }
  }
}

export async function cleanupRateLimits(): Promise<void> {
  if (isDemoMode) return

  try {
    const cutoffDate = new Date(Date.now() - RATE_LIMIT_WINDOW * 2) // Keep 48 hours of data

    const { error } = await supabase
      .from('rate_limits')
      .delete()
      .lt('created_at', cutoffDate.toISOString())

    if (error) {
      console.error('Failed to cleanup rate limits:', error)
    }
  } catch (err) {
    console.error('Rate limit cleanup failed:', err)
  }
}
