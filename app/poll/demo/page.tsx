'use client'

import { useState } from 'react'
import { format } from 'date-fns'

// Static demo data - guaranteed to work
const demoPoll = {
  id: 'demo',
  title: 'Team Coffee Meeting',
  description: 'Let\'s grab coffee and catch up!',
  creator_name: 'Kenny',
  creator_email: 'kenny@example.com',
  location: 'Blue Bottle Coffee',
  deadline: '2024-11-20'
}

const demoOptions = [
  { id: '1', option_date: '2024-11-15', option_text: 'morning' },
  { id: '2', option_date: '2024-11-15', option_text: 'afternoon' },
  { id: '3', option_date: '2024-11-16', option_text: 'morning' }
]

const demoResponses = [
  { id: '1', option_id: '1', participant_name: 'Alice', participant_email: 'alice@example.com', response: 'yes' },
  { id: '2', option_id: '2', participant_name: 'Alice', participant_email: 'alice@example.com', response: 'maybe' },
  { id: '3', option_id: '1', participant_name: 'Bob', participant_email: 'bob@example.com', response: 'no' }
]

const timeBuckets = [
  { value: 'morning', label: '🌅 Morning', description: '8 AM - 12 PM' },
  { value: 'afternoon', label: '☀️ Afternoon', description: '12 PM - 5 PM' },
  { value: 'evening', label: '🌙 Evening', description: '5 PM - 9 PM' }
] as const

export default function DemoPollPage() {
  const [userResponses, setUserResponses] = useState<Record<string, 'yes' | 'no' | 'maybe'>>({})
  const [participantName, setParticipantName] = useState('')
  const [participantEmail, setParticipantEmail] = useState('')
  const [hasVoted, setHasVoted] = useState(false)

  const formatDateTime = (date: string, timeBucket?: string) => {
    const dateObj = new Date(date)
    const bucketInfo = timeBuckets.find(b => b.value === timeBucket)
    
    return {
      date: format(dateObj, 'EEE, MMM d'),
      time: bucketInfo ? bucketInfo.label : (timeBucket || 'Unknown time')
    }
  }

  const handleResponseChange = (optionId: string, response: 'yes' | 'no' | 'maybe') => {
    setUserResponses(prev => ({
      ...prev,
      [optionId]: response
    }))
  }

  const submitVote = (e: React.FormEvent) => {
    e.preventDefault()
    setHasVoted(true)
    alert('Vote submitted! (This is just a demo)')
  }

  const getResponseIcon = (response: 'yes' | 'no' | 'maybe') => {
    switch (response) {
      case 'yes': return '✅'
      case 'no': return '❌'
      case 'maybe': return '❓'
    }
  }

  const getResponseColor = (response: 'yes' | 'no' | 'maybe') => {
    switch (response) {
      case 'yes': return 'bg-green-100 text-green-800 border-green-300'
      case 'no': return 'bg-red-100 text-red-800 border-red-300'
      case 'maybe': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Poll Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{demoPoll.title}</h1>
        <p className="text-gray-600 mb-4">{demoPoll.description}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span>👤 Created by {demoPoll.creator_name}</span>
          <span>📍 {demoPoll.location}</span>
          <span>⏰ Respond by {format(new Date(demoPoll.deadline), 'MMM d, yyyy')}</span>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">📊 Voting Results</h2>
        
        <div className="space-y-6">
          {demoOptions.map((option) => {
            const { date, time } = formatDateTime(option.option_date, option.option_text)
            const optionResponses = demoResponses.filter(r => r.option_id === option.id)
            const yesVotes = optionResponses.filter(r => r.response === 'yes')
            const maybeVotes = optionResponses.filter(r => r.response === 'maybe')
            const noVotes = optionResponses.filter(r => r.response === 'no')
            
            return (
              <div key={option.id} className="border rounded-lg p-4 border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium text-lg">{date}</div>
                    <div className="text-gray-600">{time}</div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-green-600 font-medium">✅ {yesVotes.length}</span>
                    <span className="text-yellow-600 font-medium">❓ {maybeVotes.length}</span>
                    <span className="text-red-600 font-medium">❌ {noVotes.length}</span>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  {yesVotes.length > 0 && (
                    <div>
                      <div className="font-medium text-green-700 mb-1">✅ Available:</div>
                      <div className="space-y-1">
                        {yesVotes.map(vote => (
                          <div key={vote.id} className="text-green-600">{vote.participant_name}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {maybeVotes.length > 0 && (
                    <div>
                      <div className="font-medium text-yellow-700 mb-1">❓ Maybe:</div>
                      <div className="space-y-1">
                        {maybeVotes.map(vote => (
                          <div key={vote.id} className="text-yellow-600">{vote.participant_name}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {noVotes.length > 0 && (
                    <div>
                      <div className="font-medium text-red-700 mb-1">❌ Not Available:</div>
                      <div className="space-y-1">
                        {noVotes.map(vote => (
                          <div key={vote.id} className="text-red-600">{vote.participant_name}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Voting Form */}
      {!hasVoted ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">✅ Mark Your Availability</h2>
          
          <form onSubmit={submitVote} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Email *</label>
                <input
                  type="email"
                  required
                  value={participantEmail}
                  onChange={(e) => setParticipantEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">Select your availability for each option:</h3>
              <div className="space-y-3">
                {demoOptions.map((option) => {
                  const { date, time } = formatDateTime(option.option_date, option.option_text)
                  const currentResponse = userResponses[option.id]
                  
                  return (
                    <div key={option.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium">{date}</div>
                        <div className="text-sm text-gray-600">{time}</div>
                      </div>
                      
                      <div className="flex space-x-2">
                        {(['yes', 'maybe', 'no'] as const).map((response) => (
                          <button
                            key={response}
                            type="button"
                            onClick={() => handleResponseChange(option.id, response)}
                            className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                              currentResponse === response
                                ? getResponseColor(response)
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {getResponseIcon(response)} {response.charAt(0).toUpperCase() + response.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={Object.keys(userResponses).length === 0}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit My Availability
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-green-600 text-4xl mb-2">✅</div>
          <h3 className="text-lg font-semibold text-green-900 mb-2">Thank you for voting!</h3>
          <p className="text-green-700">Your availability has been recorded (demo mode).</p>
        </div>
      )}
    </div>
  )
}

