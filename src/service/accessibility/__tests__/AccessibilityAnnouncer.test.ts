import {AccessibilityInfo, Platform} from 'react-native'

import {MEAL_PLAN_ANNOUNCEMENT_SEPARATOR} from '@constants/strings'

import {
  ANNOUNCEMENT_REPEAT_WINDOW_MS,
  announceForAccessibility,
  moveAccessibilityFocus
} from '../AccessibilityAnnouncer'

/**
 * The announcer keeps one queue and one "already said" memory for the whole app, which is what lets two
 * unrelated surfaces raising a message in the same pass be spoken as one sentence. That state outlives a test,
 * so each one starts by draining whatever the last left pending and moving the clock clear of the repeat
 * window — otherwise a suppression from a previous case would silence the next.
 *
 * Scope is asserted against the platform the preset actually reports rather than a mocked `Platform.OS`: the
 * platform half of the decision is a pure function covered exhaustively in
 * `src/utility/__tests__/AccessibilityAnnouncementUtility.test.ts`, and what matters here is that the announcer
 * consults it at all.
 */
const IS_IOS = Platform.OS === 'ios'
const FIRST = 'Enter your age to continue'
const SECOND = 'Enter feet to continue'

describe('AccessibilityAnnouncer', () => {
  let announce: jest.SpyInstance
  let focus: jest.SpyInstance

  beforeAll(() => {
    jest.useFakeTimers()
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined)
    focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined)
  })

  afterAll(() => {
    announce.mockRestore()
    focus.mockRestore()
    jest.useRealTimers()
  })

  beforeEach(() => {
    jest.advanceTimersByTime(ANNOUNCEMENT_REPEAT_WINDOW_MS * 4)
    announce.mockClear()
    focus.mockClear()
  })

  describe('announceForAccessibility', () => {
    it('says nothing until the pass that raised the message has settled', () => {
      announceForAccessibility(FIRST, 'allScreenReaders')

      expect(announce).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1)

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenCalledWith(FIRST)
    })

    it('speaks two messages from one pass as a single utterance in the order raised', () => {
      announceForAccessibility(FIRST, 'allScreenReaders')
      announceForAccessibility(SECOND, 'allScreenReaders')
      jest.advanceTimersByTime(1)

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenCalledWith(`${FIRST}${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}${SECOND}`)
    })

    it('speaks all six messages one press can raise on the body step as one utterance', () => {
      const messages = ['one', 'two', 'three', 'four', 'five', 'six']

      messages.forEach(message => announceForAccessibility(message, 'allScreenReaders'))
      jest.advanceTimersByTime(1)

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenCalledWith(messages.join(MEAL_PLAN_ANNOUNCEMENT_SEPARATOR))
    })

    it('says a message raised twice in one pass once', () => {
      announceForAccessibility(FIRST, 'allScreenReaders')
      announceForAccessibility(FIRST, 'voiceOver')
      jest.advanceTimersByTime(1)

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenCalledWith(FIRST)
    })

    it('drops an absent or blank message without scheduling anything', () => {
      announceForAccessibility(null, 'allScreenReaders')
      announceForAccessibility(undefined, 'allScreenReaders')
      announceForAccessibility('', 'allScreenReaders')
      announceForAccessibility('   ', 'allScreenReaders')
      jest.advanceTimersByTime(ANNOUNCEMENT_REPEAT_WINDOW_MS)

      expect(announce).not.toHaveBeenCalled()
    })

    it('keeps the spoken messages when a blank one is raised beside them', () => {
      announceForAccessibility(FIRST, 'allScreenReaders')
      announceForAccessibility('  ', 'allScreenReaders')
      announceForAccessibility(SECOND, 'allScreenReaders')
      jest.advanceTimersByTime(1)

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenCalledWith(`${FIRST}${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}${SECOND}`)
    })

    it('suppresses the same message raised again in a later pass inside the repeat window', () => {
      announceForAccessibility(FIRST, 'allScreenReaders')
      jest.advanceTimersByTime(1)
      announce.mockClear()

      announceForAccessibility(FIRST, 'allScreenReaders')
      jest.advanceTimersByTime(1)

      expect(announce).not.toHaveBeenCalled()
    })

    it('speaks the same message again once the repeat window has elapsed', () => {
      announceForAccessibility(FIRST, 'allScreenReaders')
      jest.advanceTimersByTime(1)
      announce.mockClear()

      jest.advanceTimersByTime(ANNOUNCEMENT_REPEAT_WINDOW_MS)
      announceForAccessibility(FIRST, 'allScreenReaders')
      jest.advanceTimersByTime(1)

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenCalledWith(FIRST)
    })

    it('speaks a different message immediately, without waiting for the window', () => {
      announceForAccessibility(FIRST, 'allScreenReaders')
      jest.advanceTimersByTime(1)
      announce.mockClear()

      announceForAccessibility(SECOND, 'allScreenReaders')
      jest.advanceTimersByTime(1)

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenCalledWith(SECOND)
    })

    it('consults the platform for a voiceOver-scoped message', () => {
      announceForAccessibility(FIRST, 'voiceOver')
      jest.advanceTimersByTime(1)

      expect(announce).toHaveBeenCalledTimes(IS_IOS ? 1 : 0)
    })

    it('keeps only the messages this platform speaks when a pass mixes scopes', () => {
      announceForAccessibility(FIRST, 'voiceOver')
      announceForAccessibility(SECOND, 'allScreenReaders')
      jest.advanceTimersByTime(1)

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenCalledWith(IS_IOS ? `${FIRST}${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}${SECOND}` : SECOND)
    })
  })

  describe('moveAccessibilityFocus', () => {
    it('moves the reader to the node behind a resolved handle', () => {
      moveAccessibilityFocus(41, 'allScreenReaders')

      expect(focus).toHaveBeenCalledTimes(1)
      expect(focus).toHaveBeenCalledWith(41)
    })

    it('does nothing when the target has gone', () => {
      moveAccessibilityFocus(null, 'allScreenReaders')

      expect(focus).not.toHaveBeenCalled()
    })

    it('consults the platform, so a surface android announces is not focused there as well', () => {
      moveAccessibilityFocus(41, 'voiceOver')

      expect(focus).toHaveBeenCalledTimes(IS_IOS ? 1 : 0)
    })

    it('moves the reader without announcing anything, so nothing is said twice', () => {
      moveAccessibilityFocus(41, 'allScreenReaders')
      jest.advanceTimersByTime(ANNOUNCEMENT_REPEAT_WINDOW_MS)

      expect(announce).not.toHaveBeenCalled()
    })
  })
})
