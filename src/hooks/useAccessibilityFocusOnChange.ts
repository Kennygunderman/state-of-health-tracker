import {RefObject, useEffect, useRef} from 'react'

import {AccessibilityFocusTarget, moveAccessibilityFocus} from '@service/accessibility/AccessibilityAnnouncer'
import {AnnouncementScope, resolveAnnouncementDecision} from '@utility/AccessibilityAnnouncementUtility'

export interface AccessibilityFocusOptions {
  scope: AnnouncementScope
  focusesOnMount?: boolean
}

/**
 * Put the reader's cursor on `target` each time `changeKey` becomes a new value.
 *
 * For a screen that swaps its body without navigating — a generation that resolves into its outcome, a wait
 * that resolves into a list — the node the reader was on is unmounted and its cursor is left on nothing. The
 * key is what the screen considers a different body: while it holds, a re-render must not drag the cursor back.
 *
 * `focusesOnMount` defaults to false because arriving at a screen is the platform's business; this hook exists
 * for what happens after.
 *
 * The decision is `resolveAnnouncementDecision` because it is the same decision — a value that is present, new,
 * and not the one already acted on — and one tested rule serving both keeps focus and speech from drifting
 * apart.
 */
export function useAccessibilityFocusOnChange<TTarget extends AccessibilityFocusTarget>(
  target: RefObject<TTarget | null>,
  changeKey: string | null,
  options: AccessibilityFocusOptions
): void {
  const {scope, focusesOnMount = false} = options
  const lastFocusedKey = useRef<string | null>(null)
  const hasRun = useRef(false)

  useEffect(() => {
    const decision = resolveAnnouncementDecision({
      message: changeKey,
      lastAnnounced: lastFocusedKey.current,
      isFirstRun: !hasRun.current,
      announcesOnFirstRun: focusesOnMount
    })

    hasRun.current = true
    lastFocusedKey.current = decision.lastAnnounced

    if (decision.announces === null) {
      return
    }

    moveAccessibilityFocus(target.current, scope)
  }, [changeKey, focusesOnMount, scope, target])
}
