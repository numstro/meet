'use client'

import { useState, useEffect } from 'react'
import { supabase, isDemoMode } from '@/lib/supabase'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import Link from 'next/link'

interface RateLimit {
  id: string
  ip_address: string
  creator_email?: string
  creator_name?: string
  created_at: string
}

interface DashboardStats {
  totalPolls: number
  pollsLast24h: number
  pollsLast7d: number
  totalResponses: number
  responsesLast24h: number
  uniqueIpsLast24h: number
  rateLimitHits: number
}

interface DailyStats {
  date: string
  polls_created: number
  responses_submitted: number
  unique_ips: number
}

interface EmailIPCorrelation {
  email: string
  name: string
  ip_addresses: string[]
  poll_count: number
  first_seen: string
  last_seen: string
}

interface RateLimitViolation {
  id: string
  ip_address: string
  creator_email?: string
  creator_name?: string
  violation_type: string
  attempted_action: string
  current_count?: number
  limit_exceeded: number
  user_agent?: string
  created_at: string
}

export default function MonitoringDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [emailIPCorrelations, setEmailIPCorrelations] = useState<EmailIPCorrelation[]>([])
  const [violations, setViolations] = useState<RateLimitViolation[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Simple password protection (same as admin)
  const ADMIN_PASSWORD = 'kennyadmin2024'

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      loadStats()
    } else {
      alert('Incorrect password')
    }
  }

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const now = new Date()
      const yesterday = subDays(now, 1)
      const weekAgo = subDays(now, 7)

      // Get overall poll statistics
      const { data: allPolls } = await supabase
        .from('polls')
        .select('created_at')

      const { data: pollsLast24h } = await supabase
        .from('polls')
        .select('created_at')
        .gte('created_at', yesterday.toISOString())

      const { data: pollsLast7d } = await supabase
        .from('polls')
        .select('created_at')
        .gte('created_at', weekAgo.toISOString())

      // Get response statistics
      const { data: allResponses } = await supabase
        .from('poll_responses')
        .select('created_at')

      const { data: responsesLast24h } = await supabase
        .from('poll_responses')
        .select('created_at')
        .gte('created_at', yesterday.toISOString())

      // Get rate limit statistics
      const { data: rateLimits } = await supabase
        .from('rate_limits')
        .select('ip_address, creator_email, creator_name, created_at')
        .gte('created_at', yesterday.toISOString())

      // Get all rate limits for email-IP correlation analysis - SIMPLIFIED
      const { data: allRateLimits } = await supabase
        .from('rate_limits')
        .select('*')
        .not('creator_email', 'is', null)
        .order('created_at', { ascending: false })

      // Get rate limit violations
      const { data: violationsData } = await supabase
        .from('rate_limit_violations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50) // Latest 50 violations

      setViolations(violationsData || [])

      // Calculate unique IPs in last 24h
      const uniqueIps = new Set(rateLimits?.map((rl: RateLimit) => rl.ip_address) || []).size

      // Count rate limit hits (IPs that hit the rate limit)
      const ipCounts: Record<string, number> = {}
      rateLimits?.forEach((rl: RateLimit) => {
        ipCounts[rl.ip_address] = (ipCounts[rl.ip_address] || 0) + 1
      })
      const rateLimitHits = Object.values(ipCounts).filter(count => count >= 5).length

      const dashboardStats: DashboardStats = {
        totalPolls: allPolls?.length || 0,
        pollsLast24h: pollsLast24h?.length || 0,
        pollsLast7d: pollsLast7d?.length || 0,
        totalResponses: allResponses?.length || 0,
        responsesLast24h: responsesLast24h?.length || 0,
        uniqueIpsLast24h: uniqueIps,
        rateLimitHits
      }

      // SIMPLIFIED email-to-IP correlations - just show the raw data
      const emailIPCorrelations: EmailIPCorrelation[] = []
      
      if (allRateLimits && allRateLimits.length > 0) {
        // Group by email
        const emailGroups: Record<string, any[]> = {}
        
        allRateLimits.forEach((record: any) => {
          if (record.creator_email && record.creator_email.trim()) {
            const email = record.creator_email.trim()
            if (!emailGroups[email]) {
              emailGroups[email] = []
            }
            emailGroups[email].push(record)
          }
        })
        
        // Convert to correlation format
        Object.entries(emailGroups).forEach(([email, records]) => {
          const ips = Array.from(new Set(records.map(r => r.ip_address)))
          const names = records.map(r => r.creator_name).filter(n => n)
          const latestName = names[names.length - 1] || 'Unknown'
          
          emailIPCorrelations.push({
            email,
            name: latestName,
            ip_addresses: ips,
            poll_count: records.length,
            first_seen: records[records.length - 1].created_at,
            last_seen: records[0].created_at
          })
        })
        
        // Sort by poll count
        emailIPCorrelations.sort((a, b) => b.poll_count - a.poll_count)
      }

      setStats(dashboardStats)
      setEmailIPCorrelations(emailIPCorrelations)

      // Get daily statistics for the last 7 days
      const dailyStatsPromises = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(now, i)
        const dayStart = startOfDay(date).toISOString()
        const dayEnd = endOfDay(date).toISOString()

        return Promise.all([
          supabase
            .from('polls')
            .select('created_at')
            .gte('created_at', dayStart)
            .lte('created_at', dayEnd),
          supabase
            .from('poll_responses')
            .select('created_at')
            .gte('created_at', dayStart)
            .lte('created_at', dayEnd),
          supabase
            .from('rate_limits')
            .select('ip_address')
            .gte('created_at', dayStart)
            .lte('created_at', dayEnd)
        ]).then(([polls, responses, rateLimits]) => ({
          date: format(date, 'yyyy-MM-dd'),
          polls_created: polls.data?.length || 0,
          responses_submitted: responses.data?.length || 0,
          unique_ips: new Set(rateLimits.data?.map((rl: RateLimit) => rl.ip_address) || []).size
        }))
      })

      const dailyStatsResults = await Promise.all(dailyStatsPromises)
      setDailyStats(dailyStatsResults.reverse()) // Most recent first

    } catch (err) {
      console.error('Error loading stats:', err)
      alert('Error loading statistics')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center mb-6">📊 Monitoring Login</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter admin password"
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Usage Monitoring</h1>
          <p className="text-gray-600 mt-2">Monitor app usage and performance metrics</p>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/admin"
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            🏠 Admin Dashboard
          </Link>
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {isDemoMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="text-yellow-400 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="text-yellow-800 font-medium">Demo Mode Active</h3>
              <p className="text-yellow-700 text-sm mt-1">
                You're viewing demo data. Connect Supabase to see real usage metrics.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <span className="text-2xl">📊</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{stats.totalPolls}</h3>
                <p className="text-gray-600">Total Polls</p>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              +{stats.pollsLast24h} in last 24h
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <span className="text-2xl">✅</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{stats.totalResponses}</h3>
                <p className="text-gray-600">Total Responses</p>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              +{stats.responsesLast24h} in last 24h
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{stats.uniqueIpsLast24h}</h3>
                <p className="text-gray-600">Unique Users (24h)</p>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Active IP addresses
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${stats.rateLimitHits > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <span className="text-2xl">{stats.rateLimitHits > 0 ? '🚫' : '✅'}</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{stats.rateLimitHits}</h3>
                <p className="text-gray-600">Rate Limit Hits</p>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              IPs hitting 5+ polls/day
            </div>
          </div>
        </div>
      )}

      {/* Daily Statistics Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Daily Statistics (Last 7 Days)</h2>
        </div>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading statistics...</div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Polls Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responses
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unique IPs
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyStats.map((day) => (
                  <tr key={day.date} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {format(new Date(day.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {day.polls_created}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {day.responses_submitted}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {day.unique_ips}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Email-to-IP Correlation Analysis */}
      <div className="bg-white rounded-lg shadow mt-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Email-to-IP Correlation Analysis</h2>
          <p className="text-sm text-gray-600 mt-1">Identify potential abuse patterns by correlating email addresses with IP addresses</p>
        </div>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading correlation data...</div>
            </div>
          ) : emailIPCorrelations.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No correlation data yet</h3>
              <p className="text-gray-600">Email-IP correlations will appear as users create polls</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Creator Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Addresses Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Polls Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Level
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {emailIPCorrelations.map((correlation, index) => {
                  // Determine risk level based on patterns
                  const multipleIPs = correlation.ip_addresses.length > 1
                  const highVolume = correlation.poll_count > 3
                  const riskLevel = multipleIPs && highVolume ? 'HIGH' : 
                                   multipleIPs || highVolume ? 'MEDIUM' : 'LOW'
                  const riskColor = riskLevel === 'HIGH' ? 'text-red-600' :
                                   riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
                  
                  return (
                    <tr key={`${correlation.email}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {correlation.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {correlation.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {correlation.ip_addresses.map((ip, ipIndex) => (
                            <div key={`${ip}-${ipIndex}`} className="text-sm text-gray-900 bg-gray-100 px-2 py-1 rounded text-center font-mono">
                              {ip}
                            </div>
                          ))}
                          {correlation.ip_addresses.length > 1 && (
                            <div className="text-xs text-orange-600 font-medium">
                              ⚠️ Multiple IPs
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-lg font-semibold">{correlation.poll_count}</span>
                          {correlation.poll_count > 3 && (
                            <span className="ml-2 text-xs text-orange-600">📈 High volume</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div>First: {format(new Date(correlation.first_seen), 'MMM d, HH:mm')}</div>
                          <div>Last: {format(new Date(correlation.last_seen), 'MMM d, HH:mm')}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          riskLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                          riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {riskLevel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Rate Limit Violations */}
      <div className="bg-white rounded-lg shadow mt-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Rate Limit Violations</h2>
          <p className="text-sm text-gray-600 mt-1">Track attempts to exceed rate limits and identify potential abuse</p>
        </div>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading violations...</div>
            </div>
          ) : violations.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-green-400 text-4xl mb-4">✅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No violations detected</h3>
              <p className="text-gray-600">All users are respecting the rate limits</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Violation Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {violations.map((violation, index) => (
                  <tr key={`${violation.id}-${index}`} className="hover:bg-red-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(violation.created_at), 'MMM d, HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">
                      {violation.ip_address}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-red-600">
                          RATE LIMIT EXCEEDED
                        </div>
                        <div className="text-sm text-gray-500">
                          Had {violation.current_count}/{violation.limit_exceeded} polls
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Access this dashboard at: <code>meet.numstro.com/admin/monitoring</code></p>
        <p className="mt-1">Statistics update in real-time when refreshed</p>
      </div>
    </div>
  )
}
