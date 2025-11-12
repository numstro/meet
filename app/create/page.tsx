'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format, addDays, parseISO } from 'date-fns'

interface TimeOption {
  date: string
  timeBuckets: ('morning' | 'afternoon' | 'evening')[]
}

export default function CreatePollPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdPollId, setCreatedPollId] = useState<string | null>(null)
  
  const [pollData, setPollData] = useState({
    title: '',
    description: '',
    creatorName: '',
    creatorEmail: '',
    location: '',
    deadline: format(addDays(new Date(), 7), 'yyyy-MM-dd') // Default to 1 week from today
  })
  
  const [timeOptions, setTimeOptions] = useState<TimeOption[]>([
    {
      date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      timeBuckets: []
    }
  ])

  // Ref for scrolling to new rows
  const tableRef = useRef<HTMLTableElement>(null)

  // Time bucket options
  const timeBuckets = [
    { value: 'morning', label: '🌅 Morning', description: '8 AM - 12 PM' },
    { value: 'afternoon', label: '☀️ Afternoon', description: '12 PM - 5 PM' },
    { value: 'evening', label: '🌙 Evening', description: '5 PM - 9 PM' }
  ] as const

  const addTimeOption = () => {
    // Find the latest date from existing options
    // Parse dates correctly by treating them as local dates (not UTC)
    const existingDates = timeOptions.map(option => {
      const [year, month, day] = option.date.split('-').map(Number)
      return new Date(year, month - 1, day) // month is 0-indexed
    })
    
    const latestDate = existingDates.length > 0 
      ? new Date(Math.max(...existingDates.map(d => d.getTime())))
      : new Date()
    
    // Add one day after the latest date
    const nextDate = addDays(latestDate, 1)
    const dateString = format(nextDate, 'yyyy-MM-dd')
    
    setTimeOptions([
      ...timeOptions,
      {
        date: dateString,
        timeBuckets: []
      }
    ])

    // Scroll to the bottom of the table after adding a new row
    setTimeout(() => {
      if (tableRef.current) {
        const tableContainer = tableRef.current.closest('.overflow-x-auto')
        if (tableContainer) {
          // Scroll the page to show the new row, with more offset
          const newRow = tableRef.current.querySelector('tbody tr:last-child')
          if (newRow) {
            newRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
          } else {
            // Fallback: scroll the container
            tableContainer.scrollIntoView({ behavior: 'smooth', block: 'end' })
          }
        }
      }
    }, 150)
  }

  const updateTimeOption = (index: number, field: keyof TimeOption, value: string) => {
    const updated = [...timeOptions]
    updated[index] = { ...updated[index], [field]: value }
    setTimeOptions(updated)
  }

  const toggleTimeBucket = (index: number, bucket: 'morning' | 'afternoon' | 'evening') => {
    const updated = [...timeOptions]
    const currentBuckets = updated[index].timeBuckets
    
    if (currentBuckets.includes(bucket)) {
      // Remove the bucket
      updated[index].timeBuckets = currentBuckets.filter(b => b !== bucket)
    } else {
      // Add the bucket
      updated[index].timeBuckets = [...currentBuckets, bucket]
    }
    
    setTimeOptions(updated)
  }

  const removeTimeOption = (index: number) => {
    if (timeOptions.length > 1) {
      setTimeOptions(timeOptions.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    // Basic validation - max 200 chars for title, 500 for description
    if (pollData.title.length > 200) {
      setError('Poll title must be 200 characters or less')
      setIsSubmitting(false)
      return
    }

    if (pollData.description.length > 500) {
      setError('Poll description must be 500 characters or less')
      setIsSubmitting(false)
      return
    }

    if (pollData.creatorName.length > 100) {
      setError('Creator name must be 100 characters or less')
      setIsSubmitting(false)
      return
    }

    // Validate that each date has at least one time bucket selected
    const hasEmptyBuckets = timeOptions.some(option => option.timeBuckets.length === 0)
    if (hasEmptyBuckets) {
      setError('Please select at least one time of day for each date')
      setIsSubmitting(false)
      return
    }

    // Validate deadline is not in the past
    if (pollData.deadline) {
      const deadlineDate = new Date(pollData.deadline)
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Reset to start of day for comparison
      
      if (deadlineDate < today) {
        setError('Response deadline must be in the future')
        setIsSubmitting(false)
        return
      }
    }

    // Validate that poll option dates are not in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset to start of day for comparison
    
    const hasPastDates = timeOptions.some(option => {
      const optionDate = new Date(option.date)
      return optionDate < today
    })
    
    if (hasPastDates) {
        setError('Poll option dates must be in the future')
      setIsSubmitting(false)
      return
    }

    // Check rate limit and get IP address
    let userIpAddress = '127.0.0.1' // fallback
    try {
      const response = await fetch('/api/rate-limit')
      const rateLimitData = await response.json()
      
      // Store IP address for poll creation
      userIpAddress = rateLimitData.ipAddress || '127.0.0.1'
      
      if (!response.ok || !rateLimitData.allowed) {
        // Record violation in database
        try {
          await supabase
            .from('rate_limit_violations')
            .insert({
              ip_address: userIpAddress,
              violation_type: 'rate_limit_exceeded',
              attempted_action: 'create_poll',
              current_count: 9, // We know they're over limit
              limit_exceeded: 5,
              created_at: new Date().toISOString()
            })
        } catch (err) {
          console.error('Failed to record violation:', err)
        }
        
        const resetDate = new Date(rateLimitData.resetTime).toLocaleString()
        const reason = rateLimitData.reason || 'Rate limit exceeded'
        setError(`${reason}. Rate limit resets at ${resetDate}`)
        setIsSubmitting(false)
        return
      }
    } catch (rateLimitError) {
      console.error('Rate limit check failed:', rateLimitError)
      // SECURITY: Do not allow poll creation if rate limit check fails
      setError('Rate limit check failed. Please try again in a moment.')
      setIsSubmitting(false)
      return
    }

    try {
      // Create the poll
      const { data: pollResult, error: pollError } = await supabase
        .from('polls')
        .insert({
          title: pollData.title,
          description: pollData.description,
          creator_name: pollData.creatorName,
          creator_email: pollData.creatorEmail,
          creator_ip: userIpAddress,
          location: pollData.location || null,
          deadline: pollData.deadline || null
        })
        .select()
        .single()

      if (pollError) throw pollError

      const pollId = pollResult.id

      // Create the time options - one for each selected time bucket
      const optionsToInsert = timeOptions.flatMap(option => 
        option.timeBuckets.map(bucket => ({
          poll_id: pollId,
          option_date: option.date,
          start_time: null, // No specific time, just bucket
          end_time: null,
          option_text: bucket // Store the time bucket as text
        }))
      )

      const { error: optionsError } = await supabase
        .from('poll_options')
        .insert(optionsToInsert)

      if (optionsError) throw optionsError

      // No need to record rate limits separately - polls table is now the source of truth!

      // Redirect directly to the poll with creator info for auto-population
      const params = new URLSearchParams({
        creatorName: pollData.creatorName,
        creatorEmail: pollData.creatorEmail
      })
      router.push(`/poll/${pollId}?${params.toString()}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create poll')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDateTime = (date: string, selectedBuckets: string[]) => {
    const dateObj = new Date(date)
    const bucketLabels = selectedBuckets.map(bucket => {
      const bucketInfo = timeBuckets.find(b => b.value === bucket)
      return bucketInfo?.label || bucket
    }).join(', ')
    
    return `${dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })} - ${bucketLabels}`
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Create New Poll
        </h1>
        <p className="text-gray-600">
          Set up a poll to find the best time for everyone
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Success - Share Link */}
      {createdPollId && (
        <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center mb-4">
            <div className="text-green-400 text-2xl mr-3">🎉</div>
            <h3 className="text-green-800 font-semibold text-lg">Poll Created Successfully!</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-green-800 mb-2">Share this link with participants:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}/poll/${createdPollId}`}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-md font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/poll/${createdPollId}`)
                    // You could add a toast notification here
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  📋 Copy
                </button>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push(`/poll/${createdPollId}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                View Poll
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatedPollId(null)
                  setPollData({
                    title: '',
                    description: '',
                    creatorName: '',
                    creatorEmail: '',
                    location: '',
                deadline: format(addDays(new Date(), 7), 'yyyy-MM-dd')
              })
              setTimeOptions([{
                date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
                timeBuckets: []
              }])
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Create Another Poll
              </button>
            </div>
          </div>
        </div>
      )}

      {!createdPollId && (

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Event Details</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                id="title"
                required
                maxLength={200}
                value={pollData.title}
                onChange={(e) => setPollData({ ...pollData, title: e.target.value })}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Team Coffee Meeting"
              />
              <div className="text-xs text-gray-500 mt-1">{pollData.title.length}/200 characters</div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                maxLength={500}
                value={pollData.description}
                onChange={(e) => setPollData({ ...pollData, description: e.target.value })}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description or agenda"
              />
              <div className="text-xs text-gray-500 mt-1">{pollData.description.length}/500 characters</div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="creatorName" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  id="creatorName"
                  required
                  maxLength={100}
                  value={pollData.creatorName}
                  onChange={(e) => setPollData({ ...pollData, creatorName: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
                <div className="text-xs text-gray-500 mt-1">{pollData.creatorName.length}/100 characters</div>
              </div>

              <div>
                <label htmlFor="creatorEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Email *
                </label>
                <input
                  type="email"
                  id="creatorEmail"
                  required
                  value={pollData.creatorEmail}
                  onChange={(e) => setPollData({ ...pollData, creatorEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  value={pollData.location}
                  onChange={(e) => setPollData({ ...pollData, location: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Blue Bottle Coffee"
                />
              </div>

              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
                  Response Deadline
                </label>
                <input
                  type="date"
                  id="deadline"
                  value={pollData.deadline}
                  onChange={(e) => setPollData({ ...pollData, deadline: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Time Options */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Time Options</h2>
            <button
              type="button"
              onClick={addTimeOption}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Date
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table ref={tableRef} className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 border-r border-gray-200 font-medium" style={{ minWidth: '180px' }}>
                    Date
                  </th>
                  <th className="text-center p-3 border-r border-gray-200 font-medium" style={{ minWidth: '120px' }}>
                    🌅 Morning
                  </th>
                  <th className="text-center p-3 border-r border-gray-200 font-medium" style={{ minWidth: '120px' }}>
                    ☀️ Afternoon
                  </th>
                  <th className="text-center p-3 border-r border-gray-200 font-medium" style={{ minWidth: '120px' }}>
                    🌙 Evening
                  </th>
                  <th className="text-center p-3 font-medium" style={{ minWidth: '60px' }}>
                  </th>
                </tr>
              </thead>
              <tbody>
                {timeOptions.map((option, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-3 border-r border-b border-gray-200">
                      <input
                        type="date"
                        value={option.date}
                        onChange={(e) => updateTimeOption(index, 'date', e.target.value)}
                        className="w-full px-3 py-2 bg-white text-gray-900 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {option.date && (
                        <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                          {format(new Date(option.date + 'T00:00:00'), 'EEEE')}
                        </div>
                      )}
                    </td>
                    <td className="p-3 border-r border-b border-gray-200 text-center">
                      <input
                        type="checkbox"
                        checked={option.timeBuckets.includes('morning')}
                        onChange={() => toggleTimeBucket(index, 'morning')}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-3 border-r border-b border-gray-200 text-center">
                      <input
                        type="checkbox"
                        checked={option.timeBuckets.includes('afternoon')}
                        onChange={() => toggleTimeBucket(index, 'afternoon')}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-3 border-r border-b border-gray-200 text-center">
                      <input
                        type="checkbox"
                        checked={option.timeBuckets.includes('evening')}
                        onChange={() => toggleTimeBucket(index, 'evening')}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-3 border-b border-gray-200 text-center">
                      {timeOptions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTimeOption(index)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded text-sm sm:text-base"
                          title="Remove this date"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Poll'}
          </button>
        </div>
      </form>
      )}
    </div>
  )
}
