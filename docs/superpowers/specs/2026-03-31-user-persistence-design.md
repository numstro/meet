# User Persistence Design

**Date:** 2026-03-31
**Status:** Approved

## Problem

The app does not remember users across page visits. Returning poll creators must re-enter their name and email on the create page. Returning voters are not auto-recognized when they revisit a poll they already voted on — they must manually use the "Check Votes" input to reload their responses.

## Goal

Silently persist user identity (name + email) in `localStorage` so that:
1. The poll creation form auto-fills name and email for returning creators
2. Returning voters are automatically recognized on a poll page, with their prior responses loaded silently

## Approach

**Option A — Direct localStorage calls in each component** (chosen)

Two shared keys stored in `localStorage`:
- `meetup_user_name`
- `meetup_user_email`

No new files, no new abstractions. Small targeted additions in 2 existing files.

## Changes

### 1. `/app/create/page.tsx`

**On mount (via `useEffect` with empty dependency array `[]`):**
- Read `meetup_user_name` and `meetup_user_email` from `localStorage` (must be inside `useEffect` — not initial state — because `localStorage` is unavailable server-side in Next.js)
- "Present" means the value is a non-empty string (`value && value.trim() !== ''`)
- If both are present, call `setPollData(prev => ({ ...prev, creatorName: name, creatorEmail: email }))`

**On successful poll creation (inside the existing submit handler, after the API call resolves successfully):**
- Write `meetup_user_name` and `meetup_user_email` to `localStorage` using `pollData.creatorName` and `pollData.creatorEmail` — these are stable closures captured at the time the handler runs
- `localStorage.setItem` is synchronous; call `router.push(...)` immediately after

### 2. `/app/poll/[id]/page.tsx`

**`checkExistingVotes` behavior reference (existing function — do not modify):**
- Signature: `checkExistingVotes(email: string, skipSetHasVoted: boolean = false)`
- Uses only the `email` argument for its Supabase query; reads `poll?.id` from closure — does NOT read `participantEmail` or `participantName` state
- Success + votes found: sets `participantName` from DB value, sets `participantEmail` to the passed email, sets `hasVoted = true`, sets `userResponses`, `userComments`
- Success + no votes: sets nothing, returns silently
- Error: logs to console, returns silently, sets nothing

**On mount — one-time check after poll data loads:**
- Add a new `useEffect` with dependency array `[poll]` (separate from the existing fetch effect which depends on `pollId`)
- Add a `useRef<boolean>` (e.g. `localStorageCheckedRef`) initialized to `false`. Guard the logic:
  ```
  if (poll && !localStorageCheckedRef.current) {
    localStorageCheckedRef.current = true
    // ... localStorage logic
  }
  ```
  Ref is set only inside the `if (poll)` block — fires exactly once after poll is first non-null
- Read `meetup_user_email` and `meetup_user_name` from `localStorage`. "Present" means non-empty string
- If an email is found:
  1. **Pre-fill first:** call `setParticipantEmail(storedEmail)`. If a stored name is also present, call `setParticipantName(storedName)`. This populates the form even if the network call fails
  2. **Then call** `checkExistingVotes(storedEmail)` with no second argument (default `skipSetHasVoted = false` — `hasVoted` will be set to `true` if votes are found, which is the desired behavior)
  3. Because `checkExistingVotes` reads only the passed `email` argument (not state), the async state updates from step 1 do not affect the Supabase query
  4. If votes found: function sets `participantName` from DB (authoritative, may differ from stored name), `participantEmail` to passed email, `hasVoted = true` — no extra work needed
  5. If no votes or error: pre-fill from step 1 remains — user sees their name/email in the form and proceeds to vote
- If no email found in localStorage: do nothing

**After successful vote submission (inside the existing async submit handler):**
- At the top of the handler (before any `await`), capture: `const nameToSave = participantName; const emailToSave = participantEmail`
- After the API call confirms success, write to localStorage only if both are non-empty: `if (nameToSave.trim() && emailToSave.trim()) { localStorage.setItem('meetup_user_name', nameToSave); localStorage.setItem('meetup_user_email', emailToSave) }`

## Constraints

- Do not conflict with existing `verified_creator_${pollId}` key (creator organizer status — unrelated)
- Do not conflict with `meetup_auth_email` / `meetup_auth_expiry` (magic link session — unrelated)
- No UI shown to the user during recognition — fully silent

## Out of Scope

- Expiry/TTL on the stored name/email (persist indefinitely until browser clears storage)
- A "forget me" / sign-out flow
- Per-poll voter storage (one global identity covers all polls)
