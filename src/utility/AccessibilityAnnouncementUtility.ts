import {MEAL_PLAN_ANNOUNCEMENT_SEPARATOR} from '@constants/strings'

/**
 * Which readers a message is addressed to, because the two platforms are announced differently.
 *
 * `accessibilityLiveRegion` is Android-only in RN 0.86, so a surface that already carries one is announced
 * imperatively for VoiceOver and ONLY there — otherwise Android says it twice. `voiceOver` is that case.
 * `allScreenReaders` is for surfaces where no live region can do the work: one that mounts together with its
 * text (Android watches a region for changes, so a region that arrives already holding its message is never
 * read out) and one that mounts and unmounts rather than updating in place, such as a toast.
 */
export type AnnouncementScope = 'voiceOver' | 'allScreenReaders'

export interface AnnouncementDecisionInput {
  message: string | null
  lastAnnounced: string | null
  isFirstRun: boolean
  announcesOnFirstRun: boolean
}

export interface AnnouncementDecision {
  announces: string | null
  lastAnnounced: string | null
}

export interface RepeatSuppressionInput {
  message: string
  lastAnnounced: string | null
  lastAnnouncedAtMs: number
  nowMs: number
  windowMs: number
}

const isSpoken = (fragment: string | null | undefined): fragment is string =>
  fragment !== null && fragment !== undefined && fragment.trim().length > 0

/**
 * The fragments raised in one pass, as one utterance.
 *
 * The validation rule this feature ships shows every offending control at once (AAP 0.7.4), which on the body
 * step is up to six messages from a single press. Six utterances is not a reading of that screen, so the
 * fragments are joined in the order they were given — tree order, which is the visual order down the screen —
 * and a repeat inside the same pass is dropped, since two controls failing the same way say it once.
 */
export function composeAnnouncement(fragments: readonly (string | null | undefined)[]): string | null {
  const spoken = fragments.filter(isSpoken).map(fragment => fragment.trim())
  const unique = spoken.filter((fragment, index) => spoken.indexOf(fragment) === index)

  return unique.length === 0 ? null : unique.join(MEAL_PLAN_ANNOUNCEMENT_SEPARATOR)
}

export function shouldSpeakOnPlatform(scope: AnnouncementScope, platformOS: string): boolean {
  return scope === 'allScreenReaders' || platformOS === 'ios'
}

/**
 * Whether an appearing message is new, and what to remember afterwards.
 *
 * Clearing the memory when the message goes away is what lets the same message announce again the next time it
 * appears; holding it while the message stays is what keeps a re-render from repeating it. `isFirstRun` exists
 * for a surface whose value is already on screen when the reader arrives — a plan day's totals — where the
 * first value is part of the screen being read and only a later change is news. That first value is still
 * remembered, or the run after it would announce it as a change.
 */
export function resolveAnnouncementDecision(input: AnnouncementDecisionInput): AnnouncementDecision {
  const {message, lastAnnounced, isFirstRun, announcesOnFirstRun} = input

  if (message === null) {
    return {announces: null, lastAnnounced: null}
  }

  if (isFirstRun && !announcesOnFirstRun) {
    return {announces: null, lastAnnounced: message}
  }

  if (message === lastAnnounced) {
    return {announces: null, lastAnnounced}
  }

  return {announces: message, lastAnnounced: message}
}

/**
 * Whether this text was just said by someone else.
 *
 * Two independent surfaces can raise the same sentence in the same moment — a screen that announces its own
 * validation failure and the error row inside it that now announces too — and neither can see the other. The
 * window is the only thing that can: it takes the clock as an argument rather than reading it, so the decision
 * stays pure and testable.
 */
export function shouldSuppressRepeat(input: RepeatSuppressionInput): boolean {
  const {message, lastAnnounced, lastAnnouncedAtMs, nowMs, windowMs} = input

  if (lastAnnounced === null || lastAnnounced !== message) {
    return false
  }

  return nowMs - lastAnnouncedAtMs < windowMs
}
