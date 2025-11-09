'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Poll {
  id: string
  title: string
  description: string
  creator_name: string
  creator_email: string
  created_at: string
  deadline: string
}

export default function MagicAuth() {
  const [isValidating, setIsValidating] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [polls, setPolls] = useState<Poll[]>([])
  const [error, setError] = useState('')
  const [isLoadingPolls, setIsLoadingPolls] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [showArchive, setShowArchive] = useState(false)

  // Helper function to determine poll status
  const getPollStatus = (poll: Poll) => {
    if (poll.deadline && new Date(poll.deadline) < new Date()) return 'expired'
    return 'active'
  }

  // Filter polls by status
  const activePolls = polls.filter(poll => getPollStatus(poll) === 'active')
  const expiredPolls = polls.filter(poll => getPollStatus(poll) === 'expired')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setError('No authentication token provided')
      setIsValidating(false)
      return
    }

    validateToken()
  }, [token])

  const validateToken = async () => {
    try {
      const response = await fetch('/api/magic-link/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const data = await response.json()

      if (response.ok && data.valid) {
        setIsAuthenticated(true)
        setEmail(data.email)
        loadUserPolls(data.email)
      } else {
        setError(data.error || 'Invalid or expired magic link')
      }
    } catch (err) {
      setError('Failed to validate authentication')
    } finally {
      setIsValidating(false)
    }
  }

  const loadUserPolls = async (userEmail: string) => {
    setIsLoadingPolls(true)
    try {
      // Import supabase dynamically to avoid build issues
      const { supabase } = await import('@/lib/supabase')
      
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('creator_email', userEmail)
        .is('deleted_at', null) // Exclude deleted polls from user view
        .order('created_at', { ascending: false })

      if (error) throw error
      setPolls(data || [])
    } catch (err) {
      console.error('Failed to load polls:', err)
      setError('Failed to load your polls')
    } finally {
      setIsLoadingPolls(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const deletePoll = async (pollId: string) => {
    if (!confirm('Are you sure you want to delete this poll? This action cannot be undone.')) {
      return
    }

    setIsDeleting(pollId)
    try {
      const { supabase } = await import('@/lib/supabase')
      
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId)

      if (error) throw error

      // Remove from UI
      setPolls(prevPolls => prevPolls.filter(poll => poll.id !== pollId))
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Failed to delete poll: ' + (err as Error).message)
    } finally {
      setIsDeleting(null)
    }
  }

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating your access...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          
          <div className="space-y-3">
            <Link
              href="/find-polls"
              className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Request New Magic Link
            </Link>
            <Link
              href="/"
              className="block w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              ✅ Welcome back!
            </h1>
            <p className="text-gray-600">
              Authenticated as: <span className="font-medium">{email}</span>
            </p>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Your Polls</h2>
              <Link
                href="/create"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create New Poll
              </Link>
            </div>

            {/* Active/Archive Toggle */}
            <div className="flex space-x-1 mb-6">
              <button
                onClick={() => setShowArchive(false)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  !showArchive
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                🟢 Active Polls ({activePolls.length})
              </button>
              <button
                onClick={() => setShowArchive(true)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  showArchive
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                🟡 Archived Polls ({expiredPolls.length})
              </button>
            </div>

            {isLoadingPolls ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your polls...</p>
              </div>
            ) : (showArchive ? expiredPolls : activePolls).length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <div className="text-gray-400 text-4xl mb-4">
                  {showArchive ? '📁' : '📊'}
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {showArchive ? 'No archived polls' : 'No active polls'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {showArchive 
                    ? 'Polls that have passed their deadline will appear here'
                    : 'Create your first poll to get started'
                  }
                </p>
                {!showArchive && (
                  <Link
                    href="/create"
                    className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Create Your First Poll
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {(showArchive ? expiredPolls : activePolls).map((poll) => (
                  <div key={poll.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {poll.title}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            getPollStatus(poll) === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {getPollStatus(poll) === 'active' ? '🟢 Active' : '🟡 Expired'}
                          </span>
                        </div>
                        {poll.description && (
                          <p className="text-gray-600 mb-3">{poll.description}</p>
                        )}
                        <div className="text-sm text-gray-500 space-y-1">
                          <p>Created: {formatDate(poll.created_at)}</p>
                          {poll.deadline && (
                            <p>Deadline: {new Date(poll.deadline).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-3 ml-4">
                        <Link
                          href={`/poll/${poll.id}`}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                        >
                          View Poll
                        </Link>
                        <button
                          onClick={() => deletePoll(poll.id)}
                          disabled={isDeleting === poll.id}
                          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                        >
                          {isDeleting === poll.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-center pt-6 border-t border-gray-200">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
