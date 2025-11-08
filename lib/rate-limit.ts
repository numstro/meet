import { supabase, isDemoMode } from './supabase'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
}

const RATE_LIMIT_MAX = 5 // Maximum polls per day
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export async function checkRateLimit(ipAddress: string): Promise<RateLimitResult> {
  // In demo mode, always allow
  if (isDemoMode) {
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetTime: new Date(Date.now() + RATE_LIMIT_WINDOW)
    }
  }

  try {
    const now = new Date()
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW)

    // Count polls created by this IP in the last 24 hours
    const { data, error } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('ip_address', ipAddress)
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Rate limit check error:', error)
      // If we can't check rate limits, allow the request but log the error
      return {
        allowed: true,
        remaining: RATE_LIMIT_MAX - 1,
        resetTime: new Date(now.getTime() + RATE_LIMIT_WINDOW)
      }
    }

    const pollsCreated = data?.length || 0
    const allowed = pollsCreated < RATE_LIMIT_MAX
    const remaining = Math.max(0, RATE_LIMIT_MAX - pollsCreated)

    // Calculate reset time (24 hours from the first request in current window)
    const firstRequestTime = data && data.length > 0 
      ? new Date(data[data.length - 1].created_at)
      : now
    const resetTime = new Date(firstRequestTime.getTime() + RATE_LIMIT_WINDOW)

    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining, // Subtract 1 if this request will be allowed
      resetTime
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

// Clean up old rate limit records (call this periodically)
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
