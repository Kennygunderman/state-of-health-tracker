import {useEffect, useRef} from 'react'

import {announceForAccessibility} from '@service/accessibility/AccessibilityAnnouncer'
import {AnnouncementScope, resolveAnnouncementDecision} from '@utility/AccessibilityAnnouncementUtility'

export interface AccessibilityAnnouncementOptions {
  scope: AnnouncementScope
  announcesOnMount?: boolean
}

/**
 * Speak `message` when it appears or changes, and say nothing while it stays.
 *
 * `announcesOnMount` is what separates a message that IS the news — a validation error, which exists only
 * because the user just pressed something — from a value that is simply on screen when the reader arrives, such
 * as the selected day's totals, where only a later change is worth interrupting for.
 */
export function useAccessibilityAnnouncement(message: string | null, options: AccessibilityAnnouncementOptions): void {
  const {scope, announcesOnMount = true} = options
  const lastAnnounced = useRef<string | null>(null)
  const hasRun = useRef(false)

  useEffect(() => {
    const decision = resolveAnnouncementDecision({
      message,
      lastAnnounced: lastAnnounced.current,
      isFirstRun: !hasRun.current,
      announcesOnFirstRun: announcesOnMount
    })

    hasRun.current = true
    lastAnnounced.current = decision.lastAnnounced

    announceForAccessibility(decision.announces, scope)
  }, [announcesOnMount, message, scope])
}
