'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, isDemoMode } from '@/lib/supabase'
import { format } from 'date-fns'

interface Poll {
  id: string
  title: string
  description: string
  creator_name: string
  location?: string
  deadline?: string
  created_at: string
}

export default function HomePage() {
  const [polls, setPolls] = useState<Poll[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPolls()
  }, [])

  const loadPolls = async () => {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPolls(data || [])
    } catch (err) {
      console.error('Error loading polls:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy')
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading polls...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="text-yellow-800 font-semibold">Demo Mode Active</h3>
              <p className="text-yellow-700 text-sm">
                This is a demonstration with sample data. Polls created here won't be saved permanently. 
                To use this app with real data, configure a Supabase database in your deployment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          📊 Schedule Together
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Create polls to find the perfect time for everyone
        </p>
        <Link
          href="/create"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          ➕ Create New Poll
        </Link>
      </div>

      {/* How it Works */}
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📝</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">1. Create Poll</h3>
          <p className="text-gray-600">Add your event details and suggest multiple date/time options</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✅</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">2. Share & Vote</h3>
          <p className="text-gray-600">Send the link to friends so they can mark their availability</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📅</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">3. Pick Best Time</h3>
          <p className="text-gray-600">See results and choose the time that works for most people</p>
        </div>
      </div>

      {/* Recent Polls */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Polls</h2>
        
        {polls.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No polls yet</h3>
            <p className="text-gray-600 mb-4">Create your first poll to get started!</p>
            <Link
              href="/create"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Poll
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {polls.map((poll) => (
              <Link
                key={poll.id}
                href={`/poll/${poll.id}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border border-gray-200"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {poll.title}
                    </h3>
                    {poll.description && (
                      <p className="text-gray-600 mb-3">{poll.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>👤 {poll.creator_name}</span>
                      <span>📅 {formatDate(poll.created_at)}</span>
                      {poll.location && (
                        <span>📍 {poll.location}</span>
                      )}
                      {poll.deadline && (
                        <span>⏰ Deadline: {formatDate(poll.deadline)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-blue-600 hover:text-blue-800">
                    →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}