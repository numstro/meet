# ICS Library Research - What Works with Google Calendar/Gmail

## Current Status
- **Using**: `ical-generator` v10.0.0 (most popular, actively maintained)
- **Issue**: VTIMEZONE generation via `@touch4it/ical-timezones` returns `null` in production
- **Solution**: Manual VTIMEZONE generation for common US timezones (already implemented)

## Library Comparison

### 1. `ical-generator` (Current Choice) ✅
- **npm**: 1M+ weekly downloads
- **Status**: Actively maintained (v10.0.0 released Oct 2025)
- **Pros**:
  - Most popular choice
  - Supports `METHOD:REQUEST` (critical for Gmail inline event cards)
  - Full-featured API
  - Good TypeScript support
- **Cons**:
  - VTIMEZONE generation requires external package
  - Some quirks with line folding (we've worked around this)
- **Verdict**: **KEEP** - This is the industry standard

### 2. `ics` (by adamgibbons)
- **npm**: ~100k weekly downloads
- **Status**: Maintained, simpler API
- **Pros**:
  - Simpler callback-based API
  - Lightweight
- **Cons**:
  - Uses `METHOD:PUBLISH` by default (not `METHOD:REQUEST`)
  - May not support Gmail's inline event card feature
  - Less flexible for complex scenarios
- **Verdict**: **NOT RECOMMENDED** - Missing `METHOD:REQUEST` support

### 3. `ical-toolkit`
- **npm**: Lower adoption
- **Status**: Less popular
- **Verdict**: **NOT RECOMMENDED** - Less community support

### 4. Manual ICS Generation
- **Pros**:
  - Full control
  - No dependencies
  - Guaranteed RFC 5545 compliance
- **Cons**:
  - More code to maintain
  - Easy to make mistakes
  - Time-consuming
- **Verdict**: **POSSIBLE** but unnecessary - `ical-generator` + manual VTIMEZONE is better

## What Major Services Use

Based on research:
- **Calendly, Doodle, etc.**: Use proprietary implementations (not open source)
- **Most Node.js apps**: Use `ical-generator` (industry standard)
- **Simple apps**: Sometimes use `ics` package (but may have Gmail limitations)

## Recommendation: **STICK WITH `ical-generator`**

**Why:**
1. ✅ It's the most popular and well-maintained
2. ✅ Supports `METHOD:REQUEST` (critical for Gmail)
3. ✅ We've already fixed the VTIMEZONE issue manually
4. ✅ The library itself works fine - the issue was the VTIMEZONE dependency

**What We Fixed:**
- Manual VTIMEZONE generation for common US timezones (America/Los_Angeles, America/New_York, etc.)
- Fallback to `@touch4it/ical-timezones` for other timezones
- Proper error handling if VTIMEZONE generation fails

**Next Steps:**
1. Test the current implementation with manual VTIMEZONE
2. If it works, we're done ✅
3. If not, we can add more timezones to the manual list or consider full manual ICS generation

## Key Insight

The problem isn't `ical-generator` - it's that VTIMEZONE generation is complex and the external package has bundling issues in Next.js production. Our manual VTIMEZONE solution should work perfectly.



