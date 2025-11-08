'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FindPolls() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/magic-link/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('✅ Magic link sent! Check your email to access your polls.')
        setEmail('')
        
        // In development, show the magic link
        if (data.magicUrl && process.env.NODE_ENV === 'development') {
          console.log('Development magic link:', data.magicUrl)
        }
      } else {
        setError(data.error || 'Failed to send magic link')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">🪄 Find My Polls</h1>
          <p className="text-gray-600">
            Enter your email to get a secure link to access and manage your polls
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-600 text-sm">{message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-3">
            Don't have any polls yet?
          </p>
          <button
            onClick={() => router.push('/create')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create Your First Poll →
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
