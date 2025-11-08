'use client'

import { useState, useEffect } from 'react'
import { supabase, isDemoMode } from '@/lib/supabase'
import { getBannedIPs, banIP, unbanIP } from '@/lib/rate-limit'
import { format, addDays } from 'date-fns'
import Link from 'next/link'

interface Poll {
  id: string
  title: string
  description: string
  creator_name: string
  creator_email: string
  location?: string
  deadline?: string
  created_at: string
}

interface BannedIP {
  id: string
  ip_address: string
  reason?: string
  banned_by: string
  created_at: string
  expires_at?: string
  is_active: boolean
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [polls, setPolls] = useState<Poll[]>([])
  const [bannedIPs, setBannedIPs] = useState<BannedIP[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  
  // Ban form state
  const [showBanForm, setShowBanForm] = useState(false)
  const [banFormData, setBanFormData] = useState({
    ip_address: '',
    reason: '',
    duration: '24' // hours
  })

  // Simple password protection (you can make this more secure)
  const ADMIN_PASSWORD = 'kennyadmin2024'

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      loadData()
    } else {
      alert('Incorrect password')
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load polls
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })

      if (pollsError) throw pollsError
      setPolls(pollsData || [])

      // Load banned IPs
      const bannedIPsData = await getBannedIPs()
      setBannedIPs(bannedIPsData)
      
    } catch (err) {
      console.error('Error loading data:', err)
      alert('Error loading data')
    } finally {
      setIsLoading(false)
    }
  }

  const deletePoll = async (pollId: string) => {
    if (!confirm(`Are you sure you want to delete this poll? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(pollId)
    try {
      // Just delete the poll - CASCADE should handle the rest
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId)

      if (error) throw error

      // Remove from UI immediately
      setPolls(prevPolls => prevPolls.filter(poll => poll.id !== pollId))
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Delete failed: ' + (err as Error).message)
    } finally {
      setIsDeleting(null)
    }
  }

  const handleBanIP = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!banFormData.ip_address) {
      alert('IP address is required')
      return
    }

    try {
      const expiresAt = banFormData.duration === 'permanent' 
        ? undefined 
        : addDays(new Date(), parseInt(banFormData.duration) / 24)

      await banIP(
        banFormData.ip_address,
        banFormData.reason || 'Banned from admin dashboard',
        'Admin',
        expiresAt
      )

      // Refresh banned IPs list
      const bannedIPsData = await getBannedIPs()
      setBannedIPs(bannedIPsData)

      // Reset form
      setBanFormData({ ip_address: '', reason: '', duration: '24' })
      setShowBanForm(false)
      
      alert('IP address banned successfully')
    } catch (err) {
      console.error('Error banning IP:', err)
      alert('Error banning IP address')
    }
  }

  const handleUnbanIP = async (ipAddress: string) => {
    try {
      await unbanIP(ipAddress)
      
      // Refresh banned IPs list
      const bannedIPsData = await getBannedIPs()
      setBannedIPs(bannedIPsData)
      
      alert('IP address unbanned successfully')
    } catch (err) {
      console.error('Error unbanning IP:', err)
      alert('Error unbanning IP address')
    }
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm')
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center mb-6">🔒 Admin Login</h1>
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
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage all polls and moderate content</p>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/monitoring"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            📊 View Monitoring
          </Link>
          <div className="text-sm text-gray-500">
            {polls.length} total poll{polls.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {isDemoMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="text-yellow-400 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="text-yellow-800 font-medium">Demo Mode Active</h3>
              <p className="text-yellow-700 text-sm mt-1">
                You're viewing demo data. Connect Supabase to see real polls.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* IP Ban Management */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">IP Ban Management</h2>
            <button
              onClick={() => setShowBanForm(!showBanForm)}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              🚫 Ban New IP
            </button>
          </div>
        </div>

        {showBanForm && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <form onSubmit={handleBanIP} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={banFormData.ip_address}
                    onChange={(e) => setBanFormData({ ...banFormData, ip_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g., 192.168.1.100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ban Duration
                  </label>
                  <select
                    value={banFormData.duration}
                    onChange={(e) => setBanFormData({ ...banFormData, duration: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="24">24 Hours</option>
                    <option value="168">1 Week</option>
                    <option value="720">30 Days</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Ban
                </label>
                <input
                  type="text"
                  value={banFormData.reason}
                  onChange={(e) => setBanFormData({ ...banFormData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., Spam, Abuse, Rate limit violations"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                >
                  Ban IP Address
                </button>
                <button
                  type="button"
                  onClick={() => setShowBanForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-x-auto">
          {bannedIPs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-4xl mb-4">🚫</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No banned IPs</h3>
              <p className="text-gray-600">No IP addresses have been banned yet.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Banned By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ban Date / Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bannedIPs.map((ban) => (
                  <tr key={ban.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">
                      {ban.ip_address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ban.reason || 'No reason provided'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ban.banned_by}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>Banned: {formatDate(ban.created_at)}</div>
                      {ban.expires_at ? (
                        <div>Expires: {formatDate(ban.expires_at)}</div>
                      ) : (
                        <div className="text-red-600 font-medium">Permanent</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleUnbanIP(ban.ip_address)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Unban
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">All Polls</h2>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading polls...</div>
            </div>
          ) : polls.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No polls found</h3>
              <p className="text-gray-600">No polls have been created yet.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Poll Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Creator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {polls.map((poll) => (
                  <tr key={poll.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {poll.title}
                          </div>
                          {poll.description && (
                            <div className="text-sm text-gray-500 mt-1 max-w-xs truncate">
                              {poll.description}
                            </div>
                          )}
                          {poll.location && (
                            <div className="text-xs text-gray-400 mt-1">
                              📍 {poll.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{poll.creator_name}</div>
                      <div className="text-xs text-gray-500">{poll.creator_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(poll.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                      <a
                        href={`/poll/${poll.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </a>
                      <button
                        onClick={() => deletePoll(poll.id)}
                        disabled={isDeleting === poll.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        {isDeleting === poll.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Access this dashboard at: <code>meet.numstro.com/admin</code></p>
        <p className="mt-1">Keep this URL private and secure!</p>
      </div>
    </div>
  )
}
