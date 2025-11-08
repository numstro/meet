'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, isDemoMode } from '@/lib/supabase'
import { format, addDays } from 'date-fns'

interface TimeOption {
  date: string
  timeBuckets: ('morning' | 'afternoon' | 'evening')[]
}

export default function CreatePollPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [pollData, setPollData] = useState({
    title: '',
    description: '',
    creatorName: '',
    creatorEmail: '',
    location: '',
    deadline: ''
  })
  
  const [timeOptions, setTimeOptions] = useState<TimeOption[]>([
    {
      date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      timeBuckets: ['morning']
    }
  ])

  // Time bucket options
  const timeBuckets = [
    { value: 'morning', label: '🌅 Morning', description: '8 AM - 12 PM' },
    { value: 'afternoon', label: '☀️ Afternoon', description: '12 PM - 5 PM' },
    { value: 'evening', label: '🌙 Evening', description: '5 PM - 9 PM' }
  ] as const

  const addTimeOption = () => {
    // Find the next available date that isn't already selected
    const existingDates = new Set(timeOptions.map(option => option.date))
    let nextDate = addDays(new Date(), 1)
    let dateString = format(nextDate, 'yyyy-MM-dd')
    
    // Keep incrementing until we find a date that's not already selected
    while (existingDates.has(dateString)) {
      nextDate = addDays(nextDate, 1)
      dateString = format(nextDate, 'yyyy-MM-dd')
    }
    
    setTimeOptions([
      ...timeOptions,
      {
        date: dateString,
        timeBuckets: ['morning']
      }
    ])
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

    // Check rate limit (skip in demo mode)
    if (!isDemoMode) {
      try {
        const response = await fetch('/api/rate-limit')
        const rateLimitData = await response.json()
        
        if (!response.ok || !rateLimitData.allowed) {
          const resetDate = new Date(rateLimitData.resetTime).toLocaleString()
          const reason = rateLimitData.reason || 'Rate limit exceeded'
          setError(`${reason}. Rate limit resets at ${resetDate}`)
          setIsSubmitting(false)
          return
        }
      } catch (rateLimitError) {
        console.error('Rate limit check failed:', rateLimitError)
        // Continue anyway if rate limit check fails
      }
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

      // Record rate limit usage (only in production mode)
      if (!isDemoMode) {
        try {
          await fetch('/api/rate-limit/record', { 
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              creatorEmail: pollData.creatorEmail,
              creatorName: pollData.creatorName
            })
          })
        } catch (rateLimitError) {
          console.error('Failed to record rate limit:', rateLimitError)
          // Don't fail the poll creation if rate limit recording fails
        }
      }

      // Redirect to the poll page
      if (isDemoMode) {
        // In demo mode, redirect to the existing demo poll instead of the temporary one
        router.push('/poll/1')  // Use the demo poll ID
      } else {
        router.push(`/poll/${pollId}`)
      }
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
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="text-yellow-800 font-semibold">Demo Mode Active</h3>
              <p className="text-yellow-700 text-sm">
                This poll will only be saved temporarily for demonstration. 
                Configure a Supabase database to save polls permanently.
              </p>
            </div>
          </div>
        </div>
      )}

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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              Add Option
            </button>
          </div>

          <div className="space-y-6">
            {timeOptions.map((option, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={option.date}
                      onChange={(e) => updateTimeOption(index, 'date', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {timeOptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTimeOption(index)}
                      className="text-red-600 hover:text-red-800 p-1 ml-4"
                      title="Remove this date"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Time of Day (select all that work)
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {timeBuckets.map((bucket) => (
                      <label
                        key={bucket.value}
                        className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={option.timeBuckets.includes(bucket.value)}
                          onChange={() => toggleTimeBucket(index, bucket.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {bucket.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {bucket.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {option.timeBuckets.length > 0 && (
                  <div className="mt-3 p-2 bg-blue-50 rounded-md">
                    <div className="text-sm text-blue-800">
                      <strong>Preview:</strong> {formatDateTime(option.date, option.timeBuckets)}
                    </div>
                  </div>
                )}
              </div>
            ))}
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
    </div>
  )
}
