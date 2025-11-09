'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface Poll {
  id: string
  title: string
  description: string
  creator_name: string
  creator_email: string
  location?: string
  deadline?: string
}

interface PollOption {
  id: string
  option_date: string
  start_time: string | null
  end_time: string | null
  option_text: string | null
  proposed_by_name?: string | null
}

interface PollResponse {
  id: string
  option_id: string
  participant_name: string
  participant_email: string
  response: 'yes' | 'no' | 'maybe'
}

interface PollSummary {
  option_id: string
  option_date: string
  start_time: string | null
  end_time: string | null
  option_text: string | null
  yes_count: number
  no_count: number
  maybe_count: number
  total_responses: number
}

export default function PollPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const pollId = params.id as string

  const [poll, setPoll] = useState<Poll | null>(null)
  const [options, setOptions] = useState<PollOption[]>([])
  const [responses, setResponses] = useState<PollResponse[]>([])
  const [summary, setSummary] = useState<PollSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Voting state
  const [participantName, setParticipantName] = useState('')
  const [participantEmail, setParticipantEmail] = useState('')
  const [userResponses, setUserResponses] = useState<Record<string, 'yes' | 'no' | 'maybe'>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [isEditingVotes, setIsEditingVotes] = useState(false)
  const [existingVoterEmail, setExistingVoterEmail] = useState('')

  // Propose new time state
  const [showProposeForm, setShowProposeForm] = useState(false)
  const [proposedDate, setProposedDate] = useState('')
  const [proposedTimeBuckets, setProposedTimeBuckets] = useState<('morning' | 'afternoon' | 'evening')[]>([])
  const [proposerName, setProposerName] = useState('')
  const [isProposing, setIsProposing] = useState(false)

  // Delete poll state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Time bucket options
  const timeBuckets = [
    { value: 'morning', label: '🌅 Morning', description: '8 AM - 12 PM' },
    { value: 'afternoon', label: '☀️ Afternoon', description: '12 PM - 5 PM' },
    { value: 'evening', label: '🌙 Evening', description: '5 PM - 9 PM' }
  ] as const

  useEffect(() => {
    if (pollId) {
      loadPollData()
    }
  }, [pollId])

  // Auto-populate creator info from URL params (only when coming from poll creation)
  useEffect(() => {
    const creatorName = searchParams.get('creatorName')
    const creatorEmail = searchParams.get('creatorEmail')
    
    if (creatorName && creatorEmail) {
      setParticipantName(creatorName)
      setParticipantEmail(creatorEmail)
      
      // Clear the URL params after setting them (optional, for cleaner URLs)
      const url = new URL(window.location.href)
      url.searchParams.delete('creatorName')
      url.searchParams.delete('creatorEmail')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  const loadPollData = async () => {
    try {
      // Load poll details
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('id', pollId)
        .single()

      if (pollError) throw pollError
      if (!pollData) {
        throw new Error('Poll not found')
      }
      setPoll(pollData)

      // Load poll options
      const { data: optionsData, error: optionsError } = await supabase
        .from('poll_options')
        .select('*')
        .eq('poll_id', pollId)
        .order('option_date')
        .order('start_time')

      if (optionsError) throw optionsError
      setOptions(optionsData || [])

      // Load responses
      const { data: responsesData, error: responsesError } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('poll_id', pollId)

      if (responsesError) throw responsesError
      setResponses(responsesData || [])

      // Calculate summary manually (simpler for time buckets)
      calculateSummary(optionsData || [], responsesData || [])

    } catch (err: any) {
      setError(err.message || 'Failed to load poll')
    } finally {
      setIsLoading(false)
    }
  }

  const calculateSummary = (opts: PollOption[], resps: PollResponse[]) => {
    const summaryData = opts.map(option => {
      const optionResponses = resps.filter(r => r.option_id === option.id)
      return {
        option_id: option.id,
        option_date: option.option_date,
        start_time: option.start_time,
        end_time: option.end_time,
        option_text: option.option_text,
        yes_count: optionResponses.filter(r => r.response === 'yes').length,
        no_count: optionResponses.filter(r => r.response === 'no').length,
        maybe_count: optionResponses.filter(r => r.response === 'maybe').length,
        total_responses: optionResponses.length
      }
    })
    setSummary(summaryData)
  }

  const checkExistingVotes = async (email: string) => {
    if (!email) return

    try {
      const { data: existingResponses, error } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('poll_id', pollId)
        .eq('participant_email', email)

      if (error) throw error

      if (existingResponses && existingResponses.length > 0) {
        // User has already voted
        const existingVoter = existingResponses[0]
        setParticipantName(existingVoter.participant_name)
        setParticipantEmail(email)
        setExistingVoterEmail(email)
        setHasVoted(true)

        // Load their existing responses
        const responseMap: Record<string, 'yes' | 'no' | 'maybe'> = {}
        existingResponses.forEach((response: PollResponse) => {
          responseMap[response.option_id] = response.response as 'yes' | 'no' | 'maybe'
        })
        setUserResponses(responseMap)
      }
    } catch (err) {
      console.error('Error checking existing votes:', err)
    }
  }

  const handleResponseChange = (optionId: string, response: 'yes' | 'no' | 'maybe') => {
    setUserResponses(prev => ({
      ...prev,
      [optionId]: response
    }))
  }

  const startEditingVotes = () => {
    setIsEditingVotes(true)
    setHasVoted(false) // Allow them to see the voting form
  }

  const cancelEditingVotes = () => {
    setIsEditingVotes(false)
    setHasVoted(true) // Go back to "thank you" state
    // Reload their original responses
    checkExistingVotes(existingVoterEmail)
  }

  const submitVote = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      // Use upsert (insert or update) to handle existing responses
      const responsesToUpsert = Object.entries(userResponses).map(([optionId, response]) => ({
        poll_id: pollId,
        option_id: optionId,
        participant_name: participantName,
        participant_email: participantEmail,
        response
      }))

      if (responsesToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from('poll_responses')
          .upsert(responsesToUpsert, {
            onConflict: 'poll_id,option_id,participant_email'
          })

        if (upsertError) throw upsertError
      }

      // Also delete any responses for options that are no longer selected
      const selectedOptionIds = Object.keys(userResponses)
      if (selectedOptionIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('poll_responses')
          .delete()
          .eq('poll_id', pollId)
          .eq('participant_email', participantEmail)
          .not('option_id', 'in', `(${selectedOptionIds.join(',')})`)

        if (deleteError) {
          console.warn('Failed to delete old responses:', deleteError)
          // Don't fail the whole operation for this
        }
      }

      setHasVoted(true)
      setIsEditingVotes(false)
      setExistingVoterEmail(participantEmail)
      loadPollData() // Refresh data
    } catch (err: any) {
      setError(err.message || 'Failed to submit vote')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleProposedTimeBucket = (bucket: 'morning' | 'afternoon' | 'evening') => {
    if (proposedTimeBuckets.includes(bucket)) {
      setProposedTimeBuckets(proposedTimeBuckets.filter(b => b !== bucket))
    } else {
      setProposedTimeBuckets([...proposedTimeBuckets, bucket])
    }
  }

  const proposeNewTime = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProposing(true)
    setError('')

    if (proposedTimeBuckets.length === 0) {
      setError('Please select at least one time of day')
      setIsProposing(false)
      return
    }

    try {
      // Create separate options for each selected time bucket
      const optionsToInsert = proposedTimeBuckets.map(bucket => ({
        poll_id: pollId,
        option_date: proposedDate,
        start_time: null,
        end_time: null,
        option_text: bucket,
        ...(proposerName && { proposed_by_name: proposerName })
      }))

      // Filter out options that already exist
      const newOptions = []
      for (const option of optionsToInsert) {
        const existingOption = options.find(
          opt => opt.option_date === option.option_date && opt.option_text === option.option_text
        )
        if (!existingOption) {
          newOptions.push(option)
        }
      }

      if (newOptions.length === 0) {
        setError('All selected time options already exist in the poll')
        setIsProposing(false)
        return
      }

      // Add the new time options
      const { error: optionError } = await supabase
        .from('poll_options')
        .insert(newOptions)

      if (optionError) throw optionError

      setShowProposeForm(false)
      setProposedDate('')
      setProposedTimeBuckets([])
      setProposerName('')
      loadPollData() // Refresh data
    } catch (err: any) {
      setError(err.message || 'Failed to propose new time')
    } finally {
      setIsProposing(false)
    }
  }

  const formatDateTime = (date: string, timeBucket?: string) => {
    const dateObj = new Date(date)
    const bucketInfo = timeBuckets.find(b => b.value === timeBucket)
    
    return {
      date: format(dateObj, 'EEE, MMM d'),
      time: bucketInfo ? bucketInfo.label : (timeBucket || 'Unknown time')
    }
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

  const getBestOptions = () => {
    return summary
      .sort((a, b) => b.yes_count - a.yes_count)
      .slice(0, 3)
  }

  const deletePoll = async () => {
    if (!poll || deleteEmail.toLowerCase() !== poll.creator_email.toLowerCase()) {
      setError('Please enter the correct creator email address')
      return
    }

    setIsDeleting(true)
    setError('')

    try {
      // Delete poll options first (due to foreign key constraints)
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

      // Redirect to home page after successful deletion
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message || 'Failed to delete poll')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading poll...</div>
      </div>
    )
  }

  if (error || !poll) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Poll Not Found</h1>
          <p className="text-gray-600">{error || 'This poll does not exist or has been deleted.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Poll Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-bold text-gray-900">{poll.title}</h1>
          <button
            onClick={() => window.location.href = '/find-polls'}
            className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded border border-red-200 hover:border-red-300 transition-colors"
          >
            🗑️ Manage Poll
          </button>
        </div>
        {poll.description && (
          <p className="text-gray-600 mb-4">{poll.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span>👤 Created by {poll.creator_name}</span>
          {poll.location && <span>📍 {poll.location}</span>}
          {poll.deadline && (
            <span>⏰ Respond by {format(new Date(poll.deadline), 'MMM d, yyyy')}</span>
          )}
        </div>
      </div>

      {/* Share Poll Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <h3 className="text-blue-900 font-semibold mb-2">📤 Share This Poll</h3>
        <p className="text-blue-800 text-sm mb-3">Send this link to participants so they can vote:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={typeof window !== 'undefined' ? window.location.href : ''}
            readOnly
            className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-md font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                navigator.clipboard.writeText(window.location.href)
                // Simple feedback - you could add a toast here
                const button = event?.target as HTMLButtonElement
                const originalText = button.textContent
                button.textContent = '✅ Copied!'
                setTimeout(() => {
                  button.textContent = originalText
                }, 2000)
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            📋 Copy Link
          </button>
        </div>
      </div>

      {/* Doodle-style Grid Results */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">📊 Voting Results</h2>
        
        {summary.length === 0 ? (
          <p className="text-gray-500">No responses yet. Be the first to vote!</p>
        ) : (
          <div>
            <div className="text-sm text-gray-600 mb-4">
              {new Set(responses.map(r => r.participant_email)).size} participants
            </div>
            
            {/* Grid Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-r border-gray-200 min-w-[150px] font-medium">
                      <div className="flex items-center space-x-2">
                        <span>{new Set(responses.map(r => r.participant_email)).size} participants</span>
                        <button className="text-blue-600 hover:text-blue-800 text-lg">➕</button>
                      </div>
                    </th>
                    {options.map((option) => {
                      const optionSummary = summary.find(s => s.option_id === option.id)
                      const yesCount = optionSummary?.yes_count || 0
                      const bestOptions = getBestOptions()
                      const isTopChoice = bestOptions.length > 0 && bestOptions[0]?.option_id === option.id
                      
                      return (
                        <th key={option.id} className={`text-center p-2 border-r border-gray-200 min-w-[90px] ${isTopChoice ? 'bg-red-100 border-2 border-red-400' : ''}`}>
                          <div className="text-xs text-gray-500 mb-1">
                            {format(new Date(option.option_date), 'MMM')}
                          </div>
                          <div className="font-bold text-lg">
                            {format(new Date(option.option_date), 'd')}
                          </div>
                          <div className="text-xs text-gray-500 uppercase mb-1">
                            {format(new Date(option.option_date), 'EEE')}
                          </div>
                          <div className="text-xs font-medium text-gray-700">
                            {option.option_text === 'morning' && '🌅 Morning'}
                            {option.option_text === 'afternoon' && '☀️ Afternoon'}
                            {option.option_text === 'evening' && '🌙 Evening'}
                          </div>
                          {option.proposed_by_name && (
                            <div className="text-xs text-gray-500 mt-1">
                              by {option.proposed_by_name}
                            </div>
                          )}
                          {yesCount > 0 && (
                            <div className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 mt-1 inline-block">
                              ✓ {yesCount}
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(responses.map(r => r.participant_email))).map((email, index) => {
                    const participant = responses.find(r => r.participant_email === email)
                    
                    return (
                      <tr key={email} className="hover:bg-gray-50">
                        <td className="p-3 border-r border-b border-gray-200">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm">
                              👤
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{participant?.participant_name}</div>
                            </div>
                            <button className="text-blue-600 hover:text-blue-800 text-sm">✏️</button>
                          </div>
                        </td>
                        {options.map((option) => {
                          const response = responses.find(r => 
                            r.participant_email === email && r.option_id === option.id
                          )
                          const bestOptions = getBestOptions()
                          const isTopChoice = bestOptions.length > 0 && bestOptions[0]?.option_id === option.id
                          
                          return (
                            <td key={option.id} className={`text-center p-2 border-r border-b border-gray-200 ${isTopChoice ? 'bg-red-50' : ''}`}>
                              {response && (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold ${
                                  response.response === 'yes' 
                                    ? 'bg-green-500 text-white' 
                                    : response.response === 'maybe'
                                    ? 'bg-yellow-400 text-white'
                                    : 'bg-gray-300 text-gray-600'
                                }`}>
                                  {response.response === 'yes' 
                                    ? '✓' 
                                    : response.response === 'maybe'
                                    ? '?'
                                    : '✗'
                                  }
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Check Previous Votes */}
      {!hasVoted && !isEditingVotes && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">🔍 Already Voted?</h2>
          <p className="text-blue-800 mb-4">
            Enter your email to check if you've already voted and edit your responses.
          </p>
          <div className="flex space-x-3">
            <input
              type="email"
              placeholder="Enter your email address"
              value={existingVoterEmail}
              onChange={(e) => setExistingVoterEmail(e.target.value)}
              className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => checkExistingVotes(existingVoterEmail)}
              disabled={!existingVoterEmail}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Check Votes
            </button>
          </div>
        </div>
      )}

      {/* Voting Form */}
      {(!hasVoted || isEditingVotes) ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {isEditingVotes ? '✏️ Edit Your Votes' : '✅ Mark Your Availability'}
            </h2>
            {isEditingVotes && (
              <button
                type="button"
                onClick={cancelEditingVotes}
                className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel Edit
              </button>
            )}
          </div>
          
          <form onSubmit={submitVote} className="space-y-6">
            {/* Participant Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Email *
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={participantEmail}
                  onChange={(e) => setParticipantEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {/* Time Options - Grid Layout */}
            <div>
              <h3 className="text-lg font-medium mb-4">Select your availability for each option:</h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 border-r border-gray-200 min-w-[100px] font-medium">
                        Your Response
                      </th>
                      {options.map((option) => (
                        <th key={option.id} className="text-center p-2 border-r border-gray-200 min-w-[90px]">
                          <div className="text-xs text-gray-500 mb-1">
                            {format(new Date(option.option_date), 'MMM')}
                          </div>
                          <div className="font-bold text-lg">
                            {format(new Date(option.option_date), 'd')}
                          </div>
                          <div className="text-xs text-gray-500 uppercase mb-1">
                            {format(new Date(option.option_date), 'EEE')}
                          </div>
                          <div className="text-xs font-medium text-gray-700">
                            {option.option_text === 'morning' && '🌅 Morning'}
                            {option.option_text === 'afternoon' && '☀️ Afternoon'}
                            {option.option_text === 'evening' && '🌙 Evening'}
                          </div>
                          {option.proposed_by_name && (
                            <div className="text-xs text-gray-500 mt-1">
                              by {option.proposed_by_name}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-3 border-r border-b border-gray-200 font-medium">
                        Click to vote:
                      </td>
                      {options.map((option) => {
                        const currentResponse = userResponses[option.id]
                        
                        return (
                          <td key={option.id} className="text-center p-2 border-r border-b border-gray-200">
                            <div className="flex flex-col space-y-1">
                              {(['yes', 'maybe', 'no'] as const).map((response) => (
                                <button
                                  key={response}
                                  type="button"
                                  onClick={() => handleResponseChange(option.id, response)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold transition-colors ${
                                    currentResponse === response
                                      ? response === 'yes' 
                                        ? 'bg-green-500 text-white border-2 border-green-600' 
                                        : response === 'maybe'
                                        ? 'bg-yellow-400 text-white border-2 border-yellow-500'
                                        : 'bg-gray-400 text-white border-2 border-gray-500'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200 border border-gray-300'
                                  }`}
                                >
                                  {response === 'yes' ? '✓' : response === 'maybe' ? '?' : '✗'}
                                </button>
                              ))}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || Object.keys(userResponses).length === 0}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting 
                ? (isEditingVotes ? 'Updating...' : 'Submitting...') 
                : (isEditingVotes ? 'Update My Votes' : 'Submit My Availability')
              }
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-green-600 text-4xl mb-2">✅</div>
          <h3 className="text-lg font-semibold text-green-900 mb-2">Thank you for voting!</h3>
          <p className="text-green-700 mb-4">Your availability has been recorded. You can share this poll with others using the URL above.</p>
          <button
            onClick={startEditingVotes}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            ✏️ Edit My Votes
          </button>
        </div>
      )}

      {/* Propose New Time */}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">💡 Suggest a New Time</h2>
          {!showProposeForm && (
            <button
              onClick={() => setShowProposeForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Propose Time
            </button>
          )}
        </div>

        {showProposeForm ? (
          <form onSubmit={proposeNewTime} className="space-y-4">
            <div>
              <label htmlFor="proposerName" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name *
              </label>
              <input
                type="text"
                id="proposerName"
                required
                value={proposerName}
                onChange={(e) => setProposerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Proposed Date and Time Options *
              </label>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 border-r border-gray-200 font-medium w-48">
                        Date
                      </th>
                      <th className="text-center p-3 border-r border-gray-200 font-medium w-32">
                        🌅 Morning
                      </th>
                      <th className="text-center p-3 border-r border-gray-200 font-medium w-32">
                        ☀️ Afternoon
                      </th>
                      <th className="text-center p-3 font-medium w-32">
                        🌙 Evening
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-gray-50">
                      <td className="p-3 border-r border-b border-gray-200">
                        <input
                          type="date"
                          id="proposedDate"
                          required
                          value={proposedDate}
                          onChange={(e) => setProposedDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {proposedDate && (
                          <div className="text-xs text-gray-500 mt-1">
                            {format(new Date(proposedDate), 'EEEE')}
                          </div>
                        )}
                      </td>
                      <td className="p-3 border-r border-b border-gray-200 text-center">
                        <input
                          type="checkbox"
                          checked={proposedTimeBuckets.includes('morning')}
                          onChange={() => toggleProposedTimeBucket('morning')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="p-3 border-r border-b border-gray-200 text-center">
                        <input
                          type="checkbox"
                          checked={proposedTimeBuckets.includes('afternoon')}
                          onChange={() => toggleProposedTimeBucket('afternoon')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="p-3 border-b border-gray-200 text-center">
                        <input
                          type="checkbox"
                          checked={proposedTimeBuckets.includes('evening')}
                          onChange={() => toggleProposedTimeBucket('evening')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowProposeForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProposing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProposing ? 'Adding...' : 'Add Time Option'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-gray-600">
            Don't see a time that works for you? Suggest a new time option that others can vote on.
          </p>
        )}
      </div>

      {/* Participants List */}
      {responses.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">👥 Participants</h2>
          <div className="space-y-2">
            {Array.from(new Set(responses.map(r => r.participant_email))).map(email => {
              const participant = responses.find(r => r.participant_email === email)
              return (
                <div key={email} className="flex items-center space-x-2">
                  <span className="font-medium">{participant?.participant_name}</span>
                  <span className="text-gray-500 text-sm">({email})</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Poll</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this poll? This action cannot be undone.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter creator email to confirm:
              </label>
              <input
                type="email"
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Creator email address"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteEmail('')
                  setError('')
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={deletePoll}
                disabled={isDeleting || !deleteEmail.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete Poll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
