import {MEAL_PLAN_ANNOUNCEMENT_SEPARATOR} from '@constants/strings'

import {
  AnnouncementScope,
  composeAnnouncement,
  resolveAnnouncementDecision,
  shouldSpeakOnPlatform,
  shouldSuppressRepeat
} from '../AccessibilityAnnouncementUtility'

const GOAL_ERROR = 'Choose an option to continue'
const AGE_ERROR = 'Enter your age to continue'
const FEET_ERROR = 'Enter feet to continue'

describe('composeAnnouncement', () => {
  it('returns null when given nothing', () => {
    expect(composeAnnouncement([])).toBeNull()
  })

  it('returns null when every fragment is absent or blank', () => {
    expect(composeAnnouncement([null, undefined, '', '   ', '\n\t'])).toBeNull()
  })

  it('returns a single fragment unchanged, without a separator', () => {
    expect(composeAnnouncement([GOAL_ERROR])).toBe(GOAL_ERROR)
  })

  it('joins several fragments in the order given', () => {
    expect(composeAnnouncement([AGE_ERROR, FEET_ERROR])).toBe(
      `${AGE_ERROR}${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}${FEET_ERROR}`
    )
  })

  it('keeps the given order rather than sorting, so the utterance follows the screen', () => {
    expect(composeAnnouncement([FEET_ERROR, AGE_ERROR])).toBe(
      `${FEET_ERROR}${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}${AGE_ERROR}`
    )
  })

  it('drops the absent fragments from between the spoken ones', () => {
    expect(composeAnnouncement([null, AGE_ERROR, undefined, '  ', FEET_ERROR, null])).toBe(
      `${AGE_ERROR}${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}${FEET_ERROR}`
    )
  })

  it('says a repeated fragment once, keeping its first position', () => {
    expect(composeAnnouncement([GOAL_ERROR, AGE_ERROR, GOAL_ERROR])).toBe(
      `${GOAL_ERROR}${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}${AGE_ERROR}`
    )
  })

  it('treats fragments differing only in surrounding space as the same fragment', () => {
    expect(composeAnnouncement([`  ${GOAL_ERROR}  `, GOAL_ERROR])).toBe(GOAL_ERROR)
  })

  it('trims each fragment it keeps', () => {
    expect(composeAnnouncement([`  ${AGE_ERROR}`, `${FEET_ERROR}  `])).toBe(
      `${AGE_ERROR}${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}${FEET_ERROR}`
    )
  })

  it('composes all six messages one press can raise on the body step', () => {
    const messages = ['one', 'two', 'three', 'four', 'five', 'six']

    expect(composeAnnouncement(messages)).toBe(messages.join(MEAL_PLAN_ANNOUNCEMENT_SEPARATOR))
  })
})

describe('shouldSpeakOnPlatform', () => {
  const scopes: AnnouncementScope[] = ['voiceOver', 'allScreenReaders']

  it.each(scopes)('speaks on ios for scope %s', scope => {
    expect(shouldSpeakOnPlatform(scope, 'ios')).toBe(true)
  })

  it('stays silent on android for a voiceOver-scoped message, which android reads from its live region', () => {
    expect(shouldSpeakOnPlatform('voiceOver', 'android')).toBe(false)
  })

  it('speaks on android for an allScreenReaders-scoped message, which has no live region to read', () => {
    expect(shouldSpeakOnPlatform('allScreenReaders', 'android')).toBe(true)
  })

  it('treats an unrecognised platform as not-ios for a voiceOver-scoped message', () => {
    expect(shouldSpeakOnPlatform('voiceOver', 'web')).toBe(false)
    expect(shouldSpeakOnPlatform('allScreenReaders', 'web')).toBe(true)
  })
})

describe('resolveAnnouncementDecision', () => {
  it('announces a message appearing for the first time', () => {
    expect(
      resolveAnnouncementDecision({
        message: GOAL_ERROR,
        lastAnnounced: null,
        isFirstRun: true,
        announcesOnFirstRun: true
      })
    ).toEqual({announces: GOAL_ERROR, lastAnnounced: GOAL_ERROR})
  })

  it('stays silent on a re-render carrying the same message', () => {
    expect(
      resolveAnnouncementDecision({
        message: GOAL_ERROR,
        lastAnnounced: GOAL_ERROR,
        isFirstRun: false,
        announcesOnFirstRun: true
      })
    ).toEqual({announces: null, lastAnnounced: GOAL_ERROR})
  })

  it('announces a message that replaced a different one', () => {
    expect(
      resolveAnnouncementDecision({
        message: AGE_ERROR,
        lastAnnounced: GOAL_ERROR,
        isFirstRun: false,
        announcesOnFirstRun: true
      })
    ).toEqual({announces: AGE_ERROR, lastAnnounced: AGE_ERROR})
  })

  it('clears the memory when the message goes away', () => {
    expect(
      resolveAnnouncementDecision({
        message: null,
        lastAnnounced: GOAL_ERROR,
        isFirstRun: false,
        announcesOnFirstRun: true
      })
    ).toEqual({announces: null, lastAnnounced: null})
  })

  it('announces the same message again once it has been cleared and reappears', () => {
    const cleared = resolveAnnouncementDecision({
      message: null,
      lastAnnounced: GOAL_ERROR,
      isFirstRun: false,
      announcesOnFirstRun: true
    })

    expect(
      resolveAnnouncementDecision({
        message: GOAL_ERROR,
        lastAnnounced: cleared.lastAnnounced,
        isFirstRun: false,
        announcesOnFirstRun: true
      })
    ).toEqual({announces: GOAL_ERROR, lastAnnounced: GOAL_ERROR})
  })

  it('stays silent on the first run when the value is already on screen, but remembers it', () => {
    expect(
      resolveAnnouncementDecision({
        message: 'Planned for Saturday',
        lastAnnounced: null,
        isFirstRun: true,
        announcesOnFirstRun: false
      })
    ).toEqual({announces: null, lastAnnounced: 'Planned for Saturday'})
  })

  it('announces the run after a skipped first run, because that one is a change', () => {
    const first = resolveAnnouncementDecision({
      message: 'Planned for Saturday',
      lastAnnounced: null,
      isFirstRun: true,
      announcesOnFirstRun: false
    })

    expect(
      resolveAnnouncementDecision({
        message: 'Planned for Sunday',
        lastAnnounced: first.lastAnnounced,
        isFirstRun: false,
        announcesOnFirstRun: false
      })
    ).toEqual({announces: 'Planned for Sunday', lastAnnounced: 'Planned for Sunday'})
  })

  it('does not announce an unchanged value after a skipped first run', () => {
    const first = resolveAnnouncementDecision({
      message: 'Planned for Saturday',
      lastAnnounced: null,
      isFirstRun: true,
      announcesOnFirstRun: false
    })

    expect(
      resolveAnnouncementDecision({
        message: 'Planned for Saturday',
        lastAnnounced: first.lastAnnounced,
        isFirstRun: false,
        announcesOnFirstRun: false
      })
    ).toEqual({announces: null, lastAnnounced: 'Planned for Saturday'})
  })

  it('clears rather than remembers when the first run carries no message at all', () => {
    expect(
      resolveAnnouncementDecision({
        message: null,
        lastAnnounced: null,
        isFirstRun: true,
        announcesOnFirstRun: false
      })
    ).toEqual({announces: null, lastAnnounced: null})
  })
})

describe('shouldSuppressRepeat', () => {
  it('does not suppress when nothing has been announced yet', () => {
    expect(
      shouldSuppressRepeat({
        message: GOAL_ERROR,
        lastAnnounced: null,
        lastAnnouncedAtMs: 0,
        nowMs: 0,
        windowMs: 1_000
      })
    ).toBe(false)
  })

  it('does not suppress a different message inside the window', () => {
    expect(
      shouldSuppressRepeat({
        message: AGE_ERROR,
        lastAnnounced: GOAL_ERROR,
        lastAnnouncedAtMs: 500,
        nowMs: 600,
        windowMs: 1_000
      })
    ).toBe(false)
  })

  it('suppresses the same message raised again inside the window', () => {
    expect(
      shouldSuppressRepeat({
        message: GOAL_ERROR,
        lastAnnounced: GOAL_ERROR,
        lastAnnouncedAtMs: 500,
        nowMs: 600,
        windowMs: 1_000
      })
    ).toBe(true)
  })

  it('suppresses a repeat raised in the very same millisecond', () => {
    expect(
      shouldSuppressRepeat({
        message: GOAL_ERROR,
        lastAnnounced: GOAL_ERROR,
        lastAnnouncedAtMs: 500,
        nowMs: 500,
        windowMs: 1_000
      })
    ).toBe(true)
  })

  it('stops suppressing once the window has exactly elapsed', () => {
    expect(
      shouldSuppressRepeat({
        message: GOAL_ERROR,
        lastAnnounced: GOAL_ERROR,
        lastAnnouncedAtMs: 500,
        nowMs: 1_500,
        windowMs: 1_000
      })
    ).toBe(false)
  })

  it('stops suppressing after the window has elapsed', () => {
    expect(
      shouldSuppressRepeat({
        message: GOAL_ERROR,
        lastAnnounced: GOAL_ERROR,
        lastAnnouncedAtMs: 500,
        nowMs: 5_000,
        windowMs: 1_000
      })
    ).toBe(false)
  })

  it('never suppresses when the window is zero', () => {
    expect(
      shouldSuppressRepeat({
        message: GOAL_ERROR,
        lastAnnounced: GOAL_ERROR,
        lastAnnouncedAtMs: 500,
        nowMs: 500,
        windowMs: 0
      })
    ).toBe(false)
  })
})
