'use client'

import { useState, useEffect } from 'react'
import { supabase, isDemoMode } from '@/lib/supabase'
import { format } from 'date-fns'

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

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [polls, setPolls] = useState<Poll[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Simple password protection (you can make this more secure)
  const ADMIN_PASSWORD = 'kennyadmin2024'

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      loadPolls()
    } else {
      alert('Incorrect password')
    }
  }

  const loadPolls = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPolls(data || [])
    } catch (err) {
      console.error('Error loading polls:', err)
      alert('Error loading polls')
    } finally {
      setIsLoading(false)
    }
  }

  const deletePoll = async (pollId: string) => {
    if (deleteConfirm !== pollId) {
      setDeleteConfirm(pollId)
      return
    }

    setIsDeleting(pollId)
    try {
      // Delete poll options first
      const { error: optionsError } = await supabase
        .from('poll_options')
        .delete()
        .eq('poll_id', pollId)

      if (optionsError) throw optionsError

      // Delete poll responses
      const { error: responsesError } = await supabase
        .from('poll_responses')
        .delete()
        .eq('poll_id', pollId)

      if (responsesError) throw responsesError

      // Delete the poll
      const { error: pollError } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId)

      if (pollError) throw pollError

      // Remove from local state
      setPolls(polls.filter(poll => poll.id !== pollId))
      alert('Poll deleted successfully')
    } catch (err) {
      console.error('Error deleting poll:', err)
      alert('Error deleting poll')
    } finally {
      setIsDeleting(null)
      setDeleteConfirm(null)
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
        <div className="text-sm text-gray-500">
          {polls.length} total poll{polls.length !== 1 ? 's' : ''}
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

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">All Polls</h2>
            <button
              onClick={loadPolls}
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
                        className={`${
                          deleteConfirm === poll.id
                            ? 'text-red-800 font-bold'
                            : 'text-red-600 hover:text-red-900'
                        } disabled:opacity-50`}
                      >
                        {isDeleting === poll.id 
                          ? 'Deleting...' 
                          : deleteConfirm === poll.id 
                          ? 'Click again to confirm' 
                          : 'Delete'
                        }
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
