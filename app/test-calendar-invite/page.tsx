'use client'

import { useState } from 'react'

export default function TestCalendarInvite() {
  const [pollId, setPollId] = useState('')
  const [optionId, setOptionId] = useState('')
  const [creatorEmail, setCreatorEmail] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('12:00')
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleTest = async () => {
    if (!pollId || !optionId || !creatorEmail) {
      alert('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/send-calendar-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollId,
          optionId,
          creatorEmail,
          startTime,
          endTime
        })
      })

      const data = await response.json()
      setResult({ success: response.ok, data })
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Test Calendar Invite API</h1>
      
      <div className="space-y-4 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Poll ID *
          </label>
          <input
            type="text"
            value={pollId}
            onChange={(e) => setPollId(e.target.value)}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter poll UUID"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Option ID *
          </label>
          <input
            type="text"
            value={optionId}
            onChange={(e) => setOptionId(e.target.value)}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter poll option UUID"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Creator Email *
          </label>
          <input
            type="email"
            value={creatorEmail}
            onChange={(e) => setCreatorEmail(e.target.value)}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="creator@example.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={handleTest}
          disabled={isLoading || !pollId || !optionId || !creatorEmail}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending...' : 'Test Send Calendar Invites'}
        </button>

        {result && (
          <div className={`mt-4 p-4 rounded-md ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <h3 className={`font-semibold mb-2 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? '✅ Success' : '❌ Error'}
            </h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(result.data || result.error, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h3 className="font-semibold mb-2">How to get Poll ID and Option ID:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            <li>Go to <code className="bg-gray-200 px-1 rounded">/create</code> and create a poll</li>
            <li>Vote on the poll (or have someone vote)</li>
            <li>Open browser DevTools (F12) → Network tab</li>
            <li>Click "Send Calendar Invites" on the poll page</li>
            <li>Look at the request to see the pollId and optionId</li>
            <li>Or check the poll page URL: <code className="bg-gray-200 px-1 rounded">/poll/[poll-id]</code></li>
          </ol>
        </div>
      </div>
    </div>
  )
}



