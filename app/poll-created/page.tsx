'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function PollCreatedPage() {
  const searchParams = useSearchParams()
  const [pollTitle, setPollTitle] = useState('')
  const [pollUrl, setPollUrl] = useState('')

  useEffect(() => {
    // Get poll details from URL params
    const title = searchParams.get('title') || 'Your Poll'
    const id = searchParams.get('id') || 'demo'
    
    setPollTitle(title)
    setPollUrl(`${window.location.origin}/poll/${id}`)
  }, [searchParams])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(pollUrl)
      alert('Poll URL copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center">
        {/* Success Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
          <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🎉 Poll Created Successfully!
        </h1>
        
        <p className="text-xl text-gray-600 mb-8">
          Your poll "<strong>{pollTitle}</strong>" is ready to share
        </p>

        {/* Poll URL */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Share this link with participants:
          </h2>
          
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={pollUrl}
              readOnly
              className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-md text-gray-900 font-mono text-sm"
            />
            <button
              onClick={copyToClipboard}
              className="px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              📋 Copy
            </button>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            What's Next?
          </h3>
          <div className="text-left space-y-2 text-blue-800">
            <p>✅ <strong>Share the link</strong> with your friends via email, text, or social media</p>
            <p>📊 <strong>Track responses</strong> as people vote on their availability</p>
            <p>🏆 <strong>Pick the best time</strong> based on who can make it</p>
            <p>📅 <strong>Send final details</strong> once you've decided</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={`/poll/${searchParams.get('id') || 'demo'}`}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            🔍 View Your Poll
          </Link>
          
          <Link
            href="/create-demo"
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            ➕ Create Another Poll
          </Link>
          
          <Link
            href="/"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            🏠 Back to Home
          </Link>
        </div>

        {/* Demo Note */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            <strong>Demo Mode:</strong> This is a demonstration. In a real deployment, 
            your poll would be saved to a database and accessible via the shared URL.
          </p>
        </div>
      </div>
    </div>
  )
}

