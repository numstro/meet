'use client'

import { useState, useEffect, useRef } from 'react'
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
  deleted_at?: string | null
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
  comment?: string | null
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
  const [userComments, setUserComments] = useState<Record<string, string>>({}) // optionId -> comment
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({}) // optionId -> isExpanded
  const [openCommentTooltip, setOpenCommentTooltip] = useState<string | null>(null) // optionId -> track which tooltip is open on mobile
  const tooltipRefs = useRef<Record<string, HTMLDivElement | null>>({})
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
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [deleteEmail, setDeleteEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Calendar invite state
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [creatorEmailForInvite, setCreatorEmailForInvite] = useState('')
  const [isSendingInvites, setIsSendingInvites] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ success: boolean; message: string } | null>(null)
  const [customStartTime, setCustomStartTime] = useState('')
  const [customEndTime, setCustomEndTime] = useState('')

  // Creator email verification state
  const [verifiedCreatorEmail, setVerifiedCreatorEmail] = useState<string | null>(null)
  const [showCreatorEmailModal, setShowCreatorEmailModal] = useState(false)
  const [showOrganizerAuthModal, setShowOrganizerAuthModal] = useState(false)
  const [creatorEmailInput, setCreatorEmailInput] = useState('')
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false)
  const [emailVerificationError, setEmailVerificationError] = useState('')
  const [pendingCreatorAction, setPendingCreatorAction] = useState<'invites' | 'delete' | 'share' | null>(null)

  // Track which options have had invites sent, with their timestamps
  const [optionsWithInvites, setOptionsWithInvites] = useState<Set<string>>(new Set())
  const [inviteDetails, setInviteDetails] = useState<Map<string, { created_at: string }>>(new Map())

  // Organizer tools collapsed state
  const [isOrganizerToolsExpanded, setIsOrganizerToolsExpanded] = useState(false)

  // Determine if user is organizer (via admin token in URL or verified creator email)
  const adminTokenFromUrl = searchParams.get('admin')
  const isOrganizer = Boolean(adminTokenFromUrl || verifiedCreatorEmail)

  // Time bucket options
  const timeBuckets = [
    { value: 'morning', label: '🌅 Morning', description: '8 AM - 12 PM' },
    { value: 'afternoon', label: '☀️ Afternoon', description: '12 PM - 5 PM' },
    { value: 'evening', label: '🌙 Evening', description: '5 PM - 9 PM' }
  ] as const

  // Helper function to determine poll status
  const getPollStatus = (poll: Poll) => {
    if (poll.deleted_at) return 'deleted'
    if (poll.deadline) {
      // Set deadline to end of day (23:59:59) for proper comparison
      const deadlineEndOfDay = new Date(poll.deadline + 'T23:59:59')
      if (deadlineEndOfDay < new Date()) return 'expired'
    }
    return 'active'
  }

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
      // Auto-fill creator email for calendar invites if they're the creator
      setCreatorEmailForInvite(creatorEmail)
      
      // Clear the URL params after setting them (optional, for cleaner URLs)
      const url = new URL(window.location.href)
      url.searchParams.delete('creatorName')
      url.searchParams.delete('creatorEmail')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (openCommentTooltip) {
        const tooltipElement = tooltipRefs.current[openCommentTooltip]
        if (tooltipElement && !tooltipElement.contains(event.target as Node)) {
          // Also check if click is on the button that opened it
          const target = event.target as HTMLElement
          if (!target.closest('button[aria-label="View comments"]')) {
            setOpenCommentTooltip(null)
          }
        }
      }
    }

    if (openCommentTooltip) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [openCommentTooltip])

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
      
      // Sort options by date first, then by time of day (morning, afternoon, evening)
      const timeOrder = { 'morning': 1, 'afternoon': 2, 'evening': 3 }
      const sortedOptions = (optionsData || []).sort((a: PollOption, b: PollOption) => {
        // First sort by date
        if (a.option_date !== b.option_date) {
          return a.option_date.localeCompare(b.option_date)
        }
        // Then sort by time of day
        const aTime = timeOrder[a.option_text as keyof typeof timeOrder] || 999
        const bTime = timeOrder[b.option_text as keyof typeof timeOrder] || 999
        return aTime - bTime
      })
      
      setOptions(sortedOptions)

      // Load responses (explicitly include comment field if it exists)
      const { data: responsesData, error: responsesError } = await supabase
        .from('poll_responses')
        .select('id, poll_id, option_id, participant_name, participant_email, response, comment')
        .eq('poll_id', pollId)

      if (responsesError) throw responsesError
      setResponses(responsesData || [])

      // Calculate summary manually (simpler for time buckets)
      calculateSummary(optionsData || [], responsesData || [])

      // Load which options have had invites sent, with timestamps
      if (pollData.creator_email) {
        const { data: invitesData, error: invitesError } = await supabase
          .from('rate_limits')
          .select('option_id, created_at')
          .eq('creator_email', pollData.creator_email)
          .not('option_id', 'is', null)
          .order('created_at', { ascending: false })

        if (!invitesError && invitesData) {
          const optionIdsWithInvites = new Set<string>()
          const detailsMap = new Map<string, { created_at: string }>()
          
          invitesData.forEach((r: any) => {
            if (r.option_id && typeof r.option_id === 'string') {
              optionIdsWithInvites.add(r.option_id)
              // Store the most recent timestamp for each option
              if (!detailsMap.has(r.option_id) || new Date(r.created_at) > new Date(detailsMap.get(r.option_id)!.created_at)) {
                detailsMap.set(r.option_id, { created_at: r.created_at })
              }
            }
          })
          
          setOptionsWithInvites(optionIdsWithInvites)
          setInviteDetails(detailsMap)
        }
      }

      // Check localStorage for verified creator email
      if (typeof window !== 'undefined') {
        const storedVerifiedEmail = localStorage.getItem(`verified_creator_${pollId}`)
        if (storedVerifiedEmail && pollData.creator_email && 
            storedVerifiedEmail.toLowerCase() === pollData.creator_email.toLowerCase()) {
          setVerifiedCreatorEmail(storedVerifiedEmail)
          setIsOrganizerToolsExpanded(true)
        }
      }

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
        .select('id, poll_id, option_id, participant_name, participant_email, response, comment')
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

        // Load their existing responses and comments
        const responseMap: Record<string, 'yes' | 'no' | 'maybe'> = {}
        const commentMap: Record<string, string> = {}
        existingResponses.forEach((response: PollResponse) => {
          responseMap[response.option_id] = response.response as 'yes' | 'no' | 'maybe'
          if (response.comment) {
            commentMap[response.option_id] = response.comment
          }
        })
        setUserResponses(responseMap)
        setUserComments(commentMap)
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
    // Don't auto-expand comment - let user click the button if they want to add one
  }

  const handleCommentChange = (optionId: string, comment: string) => {
    setUserComments(prev => ({
      ...prev,
      [optionId]: comment
    }))
  }

  const toggleCommentField = (optionId: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [optionId]: !prev[optionId]
    }))
  }

  const startEditingVotes = async () => {
    setIsEditingVotes(true)
    setHasVoted(false) // Allow them to see the voting form
    // Reload existing votes and comments to ensure we have the latest data
    if (existingVoterEmail) {
      await checkExistingVotes(existingVoterEmail)
    }
  }

  const cancelEditingVotes = () => {
    setIsEditingVotes(false)
    setHasVoted(true) // Go back to "thank you" state
    // Reload their original responses and comments
    checkExistingVotes(existingVoterEmail)
    // Clear expanded comments
    setExpandedComments({})
  }

  const submitVote = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      // Use upsert (insert or update) to handle existing responses
      // Note: comment field is optional - will be ignored if column doesn't exist in DB
      const responsesToUpsert = Object.entries(userResponses).map(([optionId, response]) => {
        const commentValue = userComments[optionId]?.trim() || null
        const responseData: any = {
          poll_id: pollId,
          option_id: optionId,
          participant_name: participantName,
          participant_email: participantEmail,
          response
        }
        // Only include comment if it has a value (gracefully handle missing DB column)
        if (commentValue) {
          responseData.comment = commentValue
        }
        return responseData
      })

      if (responsesToUpsert.length > 0) {
        let { error: upsertError } = await supabase
          .from('poll_responses')
          .upsert(responsesToUpsert, {
            onConflict: 'poll_id,option_id,participant_email'
          })

        // If error is about missing comment column, retry without comments
        if (upsertError && upsertError.message?.includes('comment')) {
          console.warn('Comment column not found, saving without comments')
          const responsesWithoutComments = responsesToUpsert.map(({ comment, ...rest }) => rest)
          const { error: retryError } = await supabase
            .from('poll_responses')
            .upsert(responsesWithoutComments, {
              onConflict: 'poll_id,option_id,participant_email'
            })
          if (retryError) throw retryError
        } else if (upsertError) {
          throw upsertError
        }
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
      // Reload poll data and refresh user's comments
      await loadPollData()
      // Also reload user's votes to ensure comments are loaded
      await checkExistingVotes(participantEmail)
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
    // Don't highlight winners if there are too few participants (0 or 1)
    const totalParticipants = new Set(responses.map(r => r.participant_email)).size
    if (totalParticipants <= 1) {
      return []
    }

    // Calculate weighted scores: yes=2, maybe=1, no=0
    const optionsWithScores = summary.map(option => ({
      ...option,
      score: (option.yes_count * 2) + (option.maybe_count * 1) + (option.no_count * 0)
    }))

    // Find the highest score
    const maxScore = Math.max(...optionsWithScores.map(opt => opt.score))
    
    // Get all options with the highest score
    const topScoredOptions = optionsWithScores.filter(opt => opt.score === maxScore)
    
    // If there are ties, break by most 'yes' votes
    const maxYesCount = Math.max(...topScoredOptions.map(opt => opt.yes_count))
    const finalWinners = topScoredOptions.filter(opt => opt.yes_count === maxYesCount)
    
    return finalWinners
  }

  // Get default times for a time bucket
  const getDefaultTimes = (timeBucket: string) => {
    if (timeBucket === 'morning') {
      return { start: '08:00', end: '12:00' }
    } else if (timeBucket === 'afternoon') {
      return { start: '13:00', end: '17:00' }
    } else {
      return { start: '17:00', end: '21:00' }
    }
  }

  // Verify creator email
  const verifyCreatorEmail = async (email: string): Promise<boolean> => {
    if (!poll) return false
    return email.toLowerCase().trim() === poll.creator_email.toLowerCase().trim()
  }

  // Handle creator action (invites, delete, share)
  const handleCreatorAction = async (action: 'invites' | 'delete' | 'share') => {
    if (!poll) return

    // If already verified, proceed
    if (verifiedCreatorEmail) {
      if (action === 'invites') {
        setShowCalendarModal(true)
      } else if (action === 'delete') {
        setShowDeleteConfirm(true)
      } else if (action === 'share') {
        // Share is always available, just copy link
        if (typeof window !== 'undefined') {
          navigator.clipboard.writeText(window.location.href)
          // Show feedback
          const button = document.querySelector('[data-share-button]') as HTMLButtonElement
          if (button) {
            const originalText = button.textContent
            button.textContent = '✅ Copied!'
            setTimeout(() => {
              button.textContent = originalText
            }, 2000)
          }
        }
      }
      return
    }

    // Otherwise, show email verification modal
    setPendingCreatorAction(action)
    setShowCreatorEmailModal(true)
    setEmailVerificationError('')
  }

  // Submit email verification (for modal)
  const submitEmailVerification = async () => {
    if (!poll || !creatorEmailInput.trim()) {
      setEmailVerificationError('Please enter your email address')
      return
    }

    setIsVerifyingEmail(true)
    setEmailVerificationError('')

    const isValid = await verifyCreatorEmail(creatorEmailInput.trim())
    
    if (isValid) {
      const verifiedEmail = creatorEmailInput.toLowerCase().trim()
      setVerifiedCreatorEmail(verifiedEmail)
      setShowCreatorEmailModal(false)
      setCreatorEmailInput('')
      
      // Save to localStorage for future visits
      if (typeof window !== 'undefined' && poll) {
        localStorage.setItem(`verified_creator_${poll.id}`, verifiedEmail)
      }
      
      // Expand organizer tools if they were collapsed
      setIsOrganizerToolsExpanded(true)
      
      // Proceed with the pending action
      if (pendingCreatorAction === 'invites') {
        setShowCalendarModal(true)
        setCreatorEmailForInvite(verifiedEmail)
      } else if (pendingCreatorAction === 'delete') {
        setShowDeleteConfirm(true)
        setDeleteEmail(verifiedEmail)
      } else if (pendingCreatorAction === 'share') {
        // Share is always available
        if (typeof window !== 'undefined') {
          navigator.clipboard.writeText(window.location.href)
        }
      }
      
      setPendingCreatorAction(null)
    } else {
      setEmailVerificationError('This poll was not created with that email address.')
    }
    
    setIsVerifyingEmail(false)
  }

  // Handle email verification in collapsed organizer tools section
  const handleOrganizerEmailVerification = async () => {
    if (!poll || !creatorEmailInput.trim()) {
      setEmailVerificationError('Please enter your email address')
      return
    }

    setIsVerifyingEmail(true)
    setEmailVerificationError('')

    const isValid = await verifyCreatorEmail(creatorEmailInput.trim())
    
    if (isValid) {
      const verifiedEmail = creatorEmailInput.toLowerCase().trim()
      setVerifiedCreatorEmail(verifiedEmail)
      setCreatorEmailInput('')
      
      // Save to localStorage for future visits
      if (typeof window !== 'undefined' && poll) {
        localStorage.setItem(`verified_creator_${poll.id}`, verifiedEmail)
      }
      
      // Close the organizer auth modal
      setShowOrganizerAuthModal(false)
    } else {
      setEmailVerificationError('This poll was not created with that email address.')
    }
    
    setIsVerifyingEmail(false)
  }

  const sendCalendarInvites = async () => {
    if (!poll || !selectedOptionId || !verifiedCreatorEmail) {
      setError('Please select a time option')
      return
    }

    // Get the selected option to determine default times
    const selectedOption = options.find(opt => opt.id === selectedOptionId)
    const defaults = selectedOption ? getDefaultTimes(selectedOption.option_text || 'morning') : { start: '08:00', end: '12:00' }
    
    // Use custom times if both are provided and not empty, otherwise use defaults
    const startTime = (customStartTime && customStartTime.trim()) ? customStartTime : defaults.start
    const endTime = (customEndTime && customEndTime.trim()) ? customEndTime : defaults.end

    // Detect user's timezone from browser
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    setIsSendingInvites(true)
    setInviteResult(null)
    setError('')

    try {
      const response = await fetch('/api/send-calendar-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollId: poll.id,
          optionId: selectedOptionId,
          creatorEmail: verifiedCreatorEmail,
          // Always send times (will be defaults if custom times not provided)
          startTime: startTime,
          endTime: endTime,
          timezone: userTimezone
        })
      })

      const result = await response.json()

      if (response.ok) {
        setInviteResult({ success: true, message: result.message })
        // Add the option to optionsWithInvites and store timestamp
        if (selectedOptionId) {
          setOptionsWithInvites(prev => new Set([...Array.from(prev), selectedOptionId]))
          setInviteDetails(prev => {
            const newMap = new Map(prev)
            newMap.set(selectedOptionId, { created_at: new Date().toISOString() })
            return newMap
          })
        }
        // Close modal after 2 seconds
        setTimeout(() => {
          setShowCalendarModal(false)
          setInviteResult(null)
          setSelectedOptionId(null)
          setCustomStartTime('')
          setCustomEndTime('')
        }, 2000)
      } else {
        const errorMsg = result.error || 'Failed to send invites'
        setInviteResult({ success: false, message: errorMsg })
        setErrorMessage(errorMsg)
        setShowErrorModal(true)
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Something went wrong'
      setInviteResult({ success: false, message: errorMsg })
      setErrorMessage(errorMsg)
      setShowErrorModal(true)
    } finally {
      setIsSendingInvites(false)
    }
  }

  const deletePoll = async () => {
    if (!poll || !verifiedCreatorEmail) {
      setErrorMessage('Please verify your creator email first')
      setShowErrorModal(true)
      return
    }

    setIsDeleting(true)
    setError('')

    try {
      // Soft delete: just set deleted_at timestamp
      const { error: pollError } = await supabase
        .from('polls')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', pollId)

      if (pollError) throw pollError

      // Redirect to home page after successful deletion
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message || 'Failed to delete poll')
      setIsDeleting(false)
    }
  }

  // Show error modal if there's an error (must be before any returns to follow Rules of Hooks)
  useEffect(() => {
    if (error && !showErrorModal) {
      setShowErrorModal(true)
      setErrorMessage(error)
    }
  }, [error, showErrorModal])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading poll...</div>
      </div>
    )
  }

  if (!poll && !isLoading) {
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

  // Early return if poll is not loaded yet
  if (!poll) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Poll Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-bold text-gray-900">{poll.title}</h1>
        </div>
        {poll.description && (
          <p className="text-gray-600 mb-4">{poll.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
          <span>👤 Created by {poll.creator_name}</span>
          {poll.location && <span>📍 {poll.location}</span>}
          {poll.deadline && (
            <span>⏰ Respond by {format(new Date(poll.deadline + 'T00:00:00'), 'MMM d, yyyy')}</span>
          )}
        </div>
        {/* Organizer Indicator Badge */}
        {isOrganizer && (
          <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
            <span>🔑</span>
            <span>Organizer access enabled</span>
          </div>
        )}
      </div>

      {/* Organizer Access CTA Box - Only for non-organizers */}
      {!isOrganizer && poll && getPollStatus(poll) === 'active' && (
        <div className="bg-[#E7F0FF] border border-blue-200 rounded-lg p-3 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-xl">🔑</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Organizer access</h3>
              <p className="text-xs text-slate-600 mb-3">
                If you're the organizer, log in to send invites or manage the poll.
              </p>
              <button
                onClick={() => setShowOrganizerAuthModal(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
              >
                Log in as organizer →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share This Poll - Moved to top */}
      {poll && getPollStatus(poll) === 'active' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <h3 className="text-blue-900 font-semibold mb-2">🔗 Share This Poll</h3>
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
              data-share-button
              onClick={() => handleCreatorAction('share')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              📋 Copy Link
            </button>
          </div>
        </div>
      )}

      {/* Poll Status Banner */}
      {poll && getPollStatus(poll) !== 'active' && (
        <div className={`rounded-lg p-4 mb-8 ${
          getPollStatus(poll) === 'expired' 
            ? 'bg-yellow-50 border border-yellow-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center">
            <span className="text-2xl mr-3">
              {getPollStatus(poll) === 'expired' ? '⏰' : '🗑️'}
            </span>
            <div>
              <h3 className={`font-semibold ${
                getPollStatus(poll) === 'expired' ? 'text-yellow-800' : 'text-red-800'
              }`}>
                {getPollStatus(poll) === 'expired' ? 'Poll Expired' : 'Poll Deleted'}
              </h3>
              <p className={`text-sm ${
                getPollStatus(poll) === 'expired' ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {getPollStatus(poll) === 'expired' 
                  ? 'This poll has passed its response deadline, but you can still view the results.'
                  : 'This poll has been deleted by the creator.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Doodle-style Grid Results - HERO (first visible content) */}
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
              <div className="overflow-x-auto border border-gray-200 rounded-lg" style={{ overscrollBehavior: 'contain', height: 'fit-content' }}>
                <table className="border-collapse m-0 w-full" style={{ tableLayout: 'auto', borderSpacing: 0 }}>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 border-r border-gray-200 min-w-[150px] font-medium">
                        {new Set(responses.map(r => r.participant_email)).size} participants
                      </th>
                    {options.map((option) => {
                      const optionSummary = summary.find(s => s.option_id === option.id)
                      const yesCount = optionSummary?.yes_count || 0
                      const bestOptions = getBestOptions()
                      const isTopChoice = bestOptions.some(best => best.option_id === option.id)
                      
                      return (
                        <th key={option.id} className={`text-center p-2 border-r border-gray-200 min-w-[90px] ${isTopChoice ? 'bg-red-100 border-2 border-red-400' : ''}`}>
                          <div className="text-xs text-gray-500 mb-1">
                            {format(new Date(option.option_date + 'T00:00:00'), 'MMM')}
                          </div>
                          <div className="font-bold text-lg">
                            {format(new Date(option.option_date + 'T00:00:00'), 'd')}
                          </div>
                          <div className="text-xs text-gray-500 uppercase mb-1">
                            {format(new Date(option.option_date + 'T00:00:00'), 'EEE')}
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
                    // Get the most recent response for this participant to get their name
                    const participantResponses = responses.filter(r => r.participant_email === email)
                    const participant = participantResponses[0] // Get first response (all should have same name)
                    const displayName = participant?.participant_name?.trim() || email.split('@')[0] || email
                    
                    return (
                      <tr key={email} className="hover:bg-gray-50">
                        <td className="p-3 border-r border-b border-gray-200">
                          <div className="font-medium truncate" style={{ lineHeight: '1.5' }}>{displayName}</div>
                          <div className="text-xs text-gray-500 truncate mt-1">{email}</div>
                        </td>
                        {options.map((option) => {
                          const response = responses.find(r => 
                            r.participant_email === email && r.option_id === option.id
                          )
                          const bestOptions = getBestOptions()
                          const isTopChoice = bestOptions.some(best => best.option_id === option.id)
                          
                          // Check if THIS participant has a comment for this time slot
                          const hasComment = response?.comment?.trim()
                          
                          // Get all comments for this time slot (from all participants) for the hover tooltip
                          const optionComments = responses
                            .filter(r => r.option_id === option.id && r.comment?.trim())
                            .map(r => ({
                              name: r.participant_name,
                              vote: r.response,
                              comment: r.comment!
                            }))
                          const hasComments = optionComments.length > 0
                          
                          return (
                            <td key={option.id} className={`text-center p-2 border-r border-b border-gray-200 ${isTopChoice ? 'bg-red-50' : ''} relative group`}>
                              <div className="flex items-center justify-center gap-1">
                                {response && (
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
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
                                {hasComment && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const tooltipKey = `${option.id}-${email}`
                                      setOpenCommentTooltip(openCommentTooltip === tooltipKey ? null : tooltipKey)
                                    }}
                                    className="text-xs opacity-60 hover:opacity-80 active:opacity-100 touch-manipulation"
                                    aria-label="View comments"
                                  >
                                    💬
                                  </button>
                                )}
                              </div>
                              
                              {/* Hover tooltip for comments - positioned above on mobile, below on desktop */}
                              {hasComment && hasComments && (
                                <div 
                                  ref={(el) => {
                                    const tooltipKey = `${option.id}-${email}`
                                    if (el) {
                                      tooltipRefs.current[tooltipKey] = el
                                    } else {
                                      delete tooltipRefs.current[tooltipKey]
                                    }
                                  }}
                                  className={`absolute left-1/2 bottom-full mb-2 transform -translate-x-1/2 z-50 transition-opacity duration-200 ${
                                    openCommentTooltip === `${option.id}-${email}`
                                      ? 'opacity-100 pointer-events-auto sm:opacity-0 sm:group-hover:opacity-100' 
                                      : 'opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto sm:group-hover:pointer-events-auto'
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px]">
                                    <div className="font-semibold mb-2">💬 Comments:</div>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {optionComments.map((c, idx) => (
                                        <div key={idx} className="border-t border-gray-700 pt-2 first:border-t-0 first:pt-0">
                                          <div className="font-medium">
                                            {c.name}
                                          </div>
                                          <div className="text-gray-300 mt-1 break-words">{c.comment}</div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                  </div>
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
            
            {/* Best Option Status Badge (for organizer) */}
            {isOrganizer && summary.length > 0 && (() => {
              const bestOptions = getBestOptions()
              if (bestOptions.length > 0) {
                const bestOption = bestOptions[0]
                const option = options.find(o => o.id === bestOption.option_id)
                if (option) {
                  const dateStr = format(new Date(option.option_date + 'T00:00:00'), 'MMM d')
                  const timeLabel = option.option_text === 'morning' ? '🌅 Morning' :
                                   option.option_text === 'afternoon' ? '☀️ Afternoon' :
                                   '🌙 Evening'
                  return (
                    <div className="mt-4 text-sm text-slate-700">
                      <span className="font-medium">Best option:</span> {dateStr} — {timeLabel} ({bestOption.yes_count} yes vote{bestOption.yes_count !== 1 ? 's' : ''})
                    </div>
                  )
                }
              }
              return null
            })()}

            {/* Invitation Status - Success box style (organizer only) */}
            {isOrganizer && optionsWithInvites.size > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">📬</span>
                    <h4 className="font-semibold text-green-900">Invitations Sent</h4>
                  </div>
                  <div className="space-y-2">
                    {options
                      .filter(opt => optionsWithInvites.has(opt.id))
                      .map(option => {
                        const dateStr = format(new Date(option.option_date + 'T00:00:00'), 'MMM d')
                        const timeLabel = option.option_text === 'morning' ? '🌅 Morning' :
                                         option.option_text === 'afternoon' ? '☀️ Afternoon' :
                                         '🌙 Evening'
                        
                        // Get default times for this time bucket
                        const defaultTimes = getDefaultTimes(option.option_text || 'morning')
                        const startTime = defaultTimes.start
                        const endTime = defaultTimes.end
                        
                        // Format time (HH:MM to 12-hour format)
                        const formatTime = (time24: string) => {
                          const [hours, minutes] = time24.split(':')
                          const hour = parseInt(hours)
                          const ampm = hour >= 12 ? 'PM' : 'AM'
                          const hour12 = hour % 12 || 12
                          return `${hour12}:${minutes} ${ampm}`
                        }
                        
                        const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`
                        const inviteInfo = inviteDetails.get(option.id)
                        const sentAt = inviteInfo ? format(new Date(inviteInfo.created_at), 'MMM d, h:mm a') : null
                        
                        return (
                          <div key={option.id} className="text-sm text-green-800">
                            <div className="font-medium">
                              {dateStr} — {timeLabel} • {timeRange}
                            </div>
                            {sentAt && (
                              <div className="text-xs text-green-600 mt-1">
                                Sent {sentAt}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            )}
        </div>
      )}
      </div>

      {/* Send Calendar Invites - Organizer only, inline (immediately under Voting Results) */}
      {isOrganizer && poll && getPollStatus(poll) === 'active' && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">📅 Send Calendar Invites</h3>
          <p className="text-sm text-slate-600 mb-4">
            Send calendar invites to all participants who voted "yes" or "maybe" for a selected time option.
          </p>
          {(() => {
            const totalParticipants = new Set(responses.map(r => r.participant_email)).size
            const bestOptions = getBestOptions()
            const hasWinningOption = bestOptions.length > 0
            const canSendInvites = totalParticipants >= 1 && hasWinningOption
            
            if (!canSendInvites) {
              return (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-slate-600">
                    You need at least one "yes" or "maybe" vote before sending calendar invites.
                  </p>
                </div>
              )
            }
            
            return (
              <button
                onClick={() => setShowCalendarModal(true)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-lg"
              >
                📅 Send Calendar Invites
              </button>
            )
          })()}
        </div>
      )}

      {/* Voting Form - Reduced visual weight */}
      {(!hasVoted || isEditingVotes) && poll && getPollStatus(poll) === 'active' ? (
        <div className="bg-[#F3F6FB] rounded-lg border border-gray-200 p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditingVotes ? '✏️ Edit Your Votes' : '☑ Mark Your Availability'}
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
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {/* Time Options - Grid Layout */}
            <div className="mt-4">
              <div className="border-t border-gray-300 pt-4 mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Click to vote:</h3>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white" style={{ overscrollBehavior: 'contain' }}>
                <table className="w-full border-collapse" style={{ minWidth: 'fit-content' }}>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 border-r border-gray-200 min-w-[100px] font-medium">
                        Your Response
                      </th>
                      {options.map((option) => (
                        <th key={option.id} className="text-center p-2 border-r border-gray-200 min-w-[90px]">
                          <div className="text-xs text-gray-500 mb-1">
                            {format(new Date(option.option_date + 'T00:00:00'), 'MMM')}
                          </div>
                          <div className="font-bold text-lg">
                            {format(new Date(option.option_date + 'T00:00:00'), 'd')}
                          </div>
                          <div className="text-xs text-gray-500 uppercase mb-1">
                            {format(new Date(option.option_date + 'T00:00:00'), 'EEE')}
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
                        const hasComment = userComments[option.id]?.trim()
                        const isCommentExpanded = expandedComments[option.id]
                        
                        return (
                          <td key={option.id} className="text-center p-2 border-r border-b border-gray-200">
                            <div className="flex flex-col items-center space-y-1 min-h-[100px]">
                              {/* Voting buttons - always visible */}
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
                              
                              {/* Comment button - reserve space to prevent layout shift */}
                              <div className="h-6 flex items-center justify-center">
                              {currentResponse && (
                                  <button
                                    type="button"
                                    onClick={() => toggleCommentField(option.id)}
                                    className={`text-xs hover:underline flex items-center gap-1 ${
                                      hasComment 
                                        ? 'text-blue-700 font-medium' 
                                        : 'text-blue-600 hover:text-blue-800'
                                    }`}
                                    title={hasComment ? `Comment: ${userComments[option.id]}` : 'Add a comment'}
                                  >
                                    {hasComment ? '💬' : '➕'}
                                    <span className="ml-1">{hasComment ? 'Edit' : 'Add'}</span>
                                  </button>
                                )}
                              </div>
                              
                              {/* Popover for comment - fixed positioning to prevent layout shift */}
                              {isCommentExpanded && currentResponse && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={() => toggleCommentField(option.id)}>
                                  <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-between items-center mb-2">
                                      <label className="text-sm font-medium text-gray-700">Add a comment (optional)</label>
                                          <button
                                            type="button"
                                            onClick={() => toggleCommentField(option.id)}
                                        className="text-gray-400 hover:text-gray-600 text-lg"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                        <textarea
                                          value={userComments[option.id] || ''}
                                          onChange={(e) => handleCommentChange(option.id, e.target.value)}
                                          placeholder="e.g., 'Can do early evening' or 'I have a dinner'"
                                          maxLength={200}
                                          rows={3}
                                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                      autoFocus
                                        />
                                        <div className="flex justify-between items-center mt-2">
                                          <span className="text-xs text-gray-500">
                                            {(userComments[option.id] || '').length}/200
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => toggleCommentField(option.id)}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                          >
                                            Done
                                          </button>
                                        </div>
                                      </div>
                                </div>
                              )}
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
      ) : poll && getPollStatus(poll) === 'active' ? (
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
      ) : null}

      {/* Already Voted? - Moved below voting form */}
      {!hasVoted && !isEditingVotes && poll && getPollStatus(poll) === 'active' && (
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
              className="flex-1 px-3 py-2 bg-white text-gray-900 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Propose New Time */}
      {poll && getPollStatus(poll) === 'active' && (
      <div className="bg-white rounded-lg shadow p-6 mb-8">
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
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Proposed Date and Time Options *
              </label>
              <div className="overflow-x-auto border border-gray-200 rounded-lg" style={{ overscrollBehavior: 'contain' }}>
                <table className="w-full border-collapse" style={{ minWidth: 'fit-content' }}>
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
                            {format(new Date(proposedDate + 'T00:00:00'), 'EEEE')}
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
      )}

      {/* Delete Poll - Organizer only, standalone at bottom (danger section) */}
      {isOrganizer && poll && getPollStatus(poll) === 'active' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-red-900 mb-2">🗑 Delete Poll</h3>
          <p className="text-sm text-slate-600 mb-4">
            Permanently delete this poll. This action cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Delete Poll
          </button>
        </div>
      )}

      {/* Organizer Tools (Restricted) - Collapsed card for non-organizers */}
      {!isOrganizer && poll && getPollStatus(poll) === 'active' && (
        <div className="bg-white rounded-lg shadow border border-gray-200 mb-8">
          <button
            onClick={() => setIsOrganizerToolsExpanded(!isOrganizerToolsExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">Organizer tools (restricted)</h3>
              <p className="text-sm text-gray-600 mt-1">Send calendar invites or delete this poll.</p>
            </div>
            <span className="text-gray-400 text-xl">
              {isOrganizerToolsExpanded ? '▼' : '▶'}
            </span>
          </button>

          {/* Expanded Content */}
          {isOrganizerToolsExpanded && (
            <div className="px-6 pb-6 border-t border-gray-200">
              <div className="mt-4">
                <p className="text-sm text-slate-600 mb-4">
                  Only the poll organizer can access these tools. Log in as organizer to unlock.
                </p>
                <button
                  onClick={() => {
                    setIsOrganizerToolsExpanded(false)
                    setShowOrganizerAuthModal(true)
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Log in as organizer
                </button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Send Calendar Invites Modal */}
      {showCalendarModal && poll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">📅 Send Calendar Invites</h3>
                <button
                  onClick={() => {
                    setShowCalendarModal(false)
                    setSelectedOptionId(null)
                    setCreatorEmailForInvite('')
                    setInviteResult(null)
                    setCustomStartTime('')
                    setCustomEndTime('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                Select a date and time option to send calendar invites to all participants who voted "yes" or "maybe" for that option.
              </p>

              {inviteResult && (
                <div className={`mb-4 p-3 rounded-md ${
                  inviteResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={inviteResult.success ? 'text-green-800' : 'text-red-800'}>
                    {inviteResult.message}
                  </p>
                </div>
              )}

              {/* Options Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Date & Time:
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(() => {
                    // Sort options: best options first, then by date
                    const bestOptions = getBestOptions()
                    const bestOptionIds = new Set(bestOptions.map(b => b.option_id))
                    
                    const sortedOptions = [...options].sort((a, b) => {
                      const aIsBest = bestOptionIds.has(a.id)
                      const bIsBest = bestOptionIds.has(b.id)
                      
                      // Best options first
                      if (aIsBest && !bIsBest) return -1
                      if (!aIsBest && bIsBest) return 1
                      
                      // Then sort by date
                      return new Date(a.option_date).getTime() - new Date(b.option_date).getTime()
                    })
                    
                    return sortedOptions.map((option) => {
                    const optionSummary = summary.find(s => s.option_id === option.id)
                    const yesCount = optionSummary?.yes_count || 0
                    const maybeCount = optionSummary?.maybe_count || 0
                    const totalVoters = yesCount + maybeCount
                    const isTopChoice = bestOptionIds.has(option.id)
                    
                    const dateStr = format(new Date(option.option_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')
                    const timeLabel = option.option_text === 'morning' ? '🌅 Morning (8 AM - 12 PM)' :
                                     option.option_text === 'afternoon' ? '☀️ Afternoon (1 PM - 5 PM)' :
                                     '🌙 Evening (5 PM - 9 PM)'

                    return (
                      <div
                        key={option.id}
                        onClick={() => {
                          setSelectedOptionId(option.id)
                          const defaults = getDefaultTimes(option.option_text || 'morning')
                          setCustomStartTime(defaults.start)
                          setCustomEndTime(defaults.end)
                        }}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedOptionId === option.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {selectedOptionId === option.id && (
                                <span className="text-blue-600">✓</span>
                              )}
                              {isTopChoice && (
                                <span className="text-xs font-semibold text-red-600">
                                  BEST OPTION
                                </span>
                              )}
                              <span className={`font-semibold ${isTopChoice ? 'text-red-600' : 'text-gray-900'}`}>{dateStr}</span>
                            </div>
                            <div className="text-sm text-gray-600 mb-2">{timeLabel}</div>
                            <div className="flex gap-4 text-xs text-gray-500">
                              <span>✓ {yesCount} yes</span>
                              <span>? {maybeCount} maybe</span>
                              <span className="font-medium">
                                {totalVoters} {totalVoters === 1 ? 'voter' : 'voters'} will receive invite
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })})()}
                </div>
              </div>

              {/* Custom Time Selection - Only show if option is selected */}
              {selectedOptionId && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Customize Event Time (optional):
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={customStartTime}
                        onChange={(e) => setCustomStartTime(e.target.value)}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">End Time</label>
                      <input
                        type="time"
                        value={customEndTime}
                        onChange={(e) => setCustomEndTime(e.target.value)}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Default times are shown above. Leave blank to use defaults.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCalendarModal(false)
                    setSelectedOptionId(null)
                    setInviteResult(null)
                    setCustomStartTime('')
                    setCustomEndTime('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={sendCalendarInvites}
                  disabled={isSendingInvites || !selectedOptionId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSendingInvites ? 'Sending...' : '📅 Send Invites'}
                </button>
              </div>
            </div>
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
            
            <p className="text-sm text-gray-500 mb-4">
              You are deleting this poll as: <strong>{verifiedCreatorEmail}</strong>
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setError('')
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={deletePoll}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete Poll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creator Email Verification Modal */}
      {showCreatorEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Verify Creator Email</h3>
                <button
                  onClick={() => {
                    setShowCreatorEmailModal(false)
                    setCreatorEmailInput('')
                    setEmailVerificationError('')
                    setPendingCreatorAction(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-gray-600 mb-4">
                Enter the email address you used to create this poll to manage it.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Creator Email:
                </label>
                <input
                  type="email"
                  value={creatorEmailInput}
                  onChange={(e) => setCreatorEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      submitEmailVerification()
                    }
                  }}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                  autoFocus
                />
                {emailVerificationError && (
                  <p className="mt-2 text-sm text-red-600">{emailVerificationError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreatorEmailModal(false)
                    setCreatorEmailInput('')
                    setEmailVerificationError('')
                    setPendingCreatorAction(null)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  disabled={isVerifyingEmail}
                >
                  Cancel
                </button>
                <button
                  onClick={submitEmailVerification}
                  disabled={isVerifyingEmail || !creatorEmailInput.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isVerifyingEmail ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Organizer Authentication Modal */}
      {showOrganizerAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Unlock Organizer Tools</h3>
                <button
                  onClick={() => {
                    setShowOrganizerAuthModal(false)
                    setCreatorEmailInput('')
                    setEmailVerificationError('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                Enter the email address you used to create this poll to unlock organizer tools like sending invites or deleting the poll.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organizer Email:
                  </label>
                  <input
                    type="email"
                    value={creatorEmailInput}
                    onChange={(e) => {
                      setCreatorEmailInput(e.target.value)
                      setEmailVerificationError('')
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && creatorEmailInput.trim()) {
                        await handleOrganizerEmailVerification()
                      }
                    }}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="organizer@email.com"
                    autoFocus
                  />
                  {emailVerificationError && (
                    <p className="mt-2 text-sm text-red-600">{emailVerificationError}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowOrganizerAuthModal(false)
                      setCreatorEmailInput('')
                      setEmailVerificationError('')
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    disabled={isVerifyingEmail}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOrganizerEmailVerification}
                    disabled={isVerifyingEmail || !creatorEmailInput.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isVerifyingEmail ? 'Verifying...' : 'Unlock'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Error</h3>
                <button
                  onClick={() => {
                    setShowErrorModal(false)
                    setErrorMessage('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="text-center mb-6">
                <div className="text-red-600 text-5xl mb-4">❌</div>
                <p className="text-gray-600">{errorMessage || 'Something went wrong. Please try again.'}</p>
              </div>
              <button
                onClick={() => {
                  setShowErrorModal(false)
                  setErrorMessage('')
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
