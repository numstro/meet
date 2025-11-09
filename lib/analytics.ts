// Google Analytics 4 helper functions

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

// Track page views
export const pageview = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    })
  }
}

// Track custom events
export const event = ({ action, category, label, value }: {
  action: string
  category: string
  label?: string
  value?: number
}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}

// Common events for Meet app
export const trackPollCreated = (pollId: string) => {
  event({
    action: 'poll_created',
    category: 'engagement',
    label: pollId
  })
}

export const trackVoteSubmitted = (pollId: string) => {
  event({
    action: 'vote_submitted',
    category: 'engagement',
    label: pollId
  })
}

export const trackPollShared = (pollId: string) => {
  event({
    action: 'poll_shared',
    category: 'engagement',
    label: pollId
  })
}

export const trackContactFormSubmitted = () => {
  event({
    action: 'contact_form_submitted',
    category: 'conversion',
    label: 'contact_page'
  })
}

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event',
      targetId: string | undefined,
      config?: Record<string, any>
    ) => void
  }
}

