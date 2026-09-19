import {AccessibilityInfo, findNodeHandle, Platform} from 'react-native'

import {
  AnnouncementScope,
  composeAnnouncement,
  shouldSpeakOnPlatform,
  shouldSuppressRepeat
} from '@utility/AccessibilityAnnouncementUtility'

/**
 * What `findNodeHandle` itself accepts, taken from its own signature rather than restated.
 *
 * RN 0.86 types a host component's ref as `React.Component<P> & HostInstance`, which this covers, while the
 * exported `HostInstance` alone is not assignable to it — so naming that type here instead would force every
 * call site to cast.
 */
export type AccessibilityFocusTarget = Parameters<typeof findNodeHandle>[0]

/**
 * How long the same sentence stays "already said".
 *
 * Long enough to cover the render pass that follows a press, short enough that a user who presses Continue
 * again on a still-invalid screen is answered rather than met with silence.
 */
export const ANNOUNCEMENT_REPEAT_WINDOW_MS = 1_000

interface QueuedAnnouncement {
  message: string
  scope: AnnouncementScope
}

let queued: QueuedAnnouncement[] = []
let flushHandle: ReturnType<typeof setTimeout> | null = null
let lastAnnounced: string | null = null
let lastAnnouncedAtMs = 0

/**
 * One utterance per pass.
 *
 * Every announcement raised while the current work is running is collected and spoken together, because the
 * alternative is what a screen reader actually does with several calls in a row: each one cuts off the one
 * before it, so a press that reveals six validation messages reads as a stutter ending in the last of them.
 * The flush is a timer rather than a microtask so the effects of one render pass — parent and child alike —
 * have all run by the time it fires, and so a test can advance it deterministically.
 */
const flush = (): void => {
  const pass = queued

  queued = []
  flushHandle = null

  const message = composeAnnouncement(
    pass.filter(entry => shouldSpeakOnPlatform(entry.scope, Platform.OS)).map(entry => entry.message)
  )

  if (message === null) {
    return
  }

  const nowMs = Date.now()

  if (
    shouldSuppressRepeat({message, lastAnnounced, lastAnnouncedAtMs, nowMs, windowMs: ANNOUNCEMENT_REPEAT_WINDOW_MS})
  ) {
    return
  }

  lastAnnounced = message
  lastAnnouncedAtMs = nowMs

  AccessibilityInfo.announceForAccessibility(message)
}

/**
 * Speak a message to the readers `scope` names, once the current pass has settled.
 *
 * A blank or absent message is not an announcement and is dropped here, so callers can pass whatever their
 * state resolved to without guarding first.
 */
export function announceForAccessibility(message: string | null | undefined, scope: AnnouncementScope): void {
  if (message === null || message === undefined || message.trim().length === 0) {
    return
  }

  queued.push({message, scope})

  if (flushHandle === null) {
    flushHandle = setTimeout(flush, 0)
  }
}

/**
 * Put the reader's cursor on `target`.
 *
 * For a screen that replaces its body in place there is no navigation event to reposition the reader, so
 * whatever it was on has been unmounted and its cursor is left on nothing. Moving it is the only way the new
 * content becomes where the user is rather than somewhere they must go looking for.
 *
 * Scoped like an announcement because it behaves like one: on iOS the focused element is read aloud, so a
 * surface that Android already announces through a live region must not be focused there as well.
 */
export function moveAccessibilityFocus(target: AccessibilityFocusTarget, scope: AnnouncementScope): void {
  if (!shouldSpeakOnPlatform(scope, Platform.OS)) {
    return
  }

  const reactTag = findNodeHandle(target)

  if (reactTag === null) {
    return
  }

  AccessibilityInfo.setAccessibilityFocus(reactTag)
}
