'use client'

import Link from 'next/link'
import { isDemoMode } from '@/lib/supabase'

export default function HomePage() {

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
          📊 Meetup
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Create polls to find the perfect time for everyone
        </p>
        <Link
          href="/create"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors mr-4"
        >
          ➕ Create New Poll
        </Link>
        <Link
          href="/find-polls"
          className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          🪄 Find My Polls
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

      {/* Footer */}
      <div className="text-center pt-8 border-t border-gray-200 mt-12">
        <p className="text-gray-600 mb-2">
          Need help? Have feedback?{' '}
          <Link href="/contact" className="text-blue-600 hover:text-blue-700 font-medium">
            Contact Us
          </Link>
        </p>
      </div>

    </div>
  )
}