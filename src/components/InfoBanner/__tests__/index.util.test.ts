import {STATUS_ANNOUNCEMENT_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import {composeStatusMessage, resolveDefaultStatusRole, resolveStatusSemantics} from '../index.util'

const TITLE = "We couldn't confirm that"

const BODY = 'Check your connection and try again.'

describe('composeStatusMessage', () => {
  it('speaks a titled banner as one sentence built from the shared template', () => {
    expect(composeStatusMessage({title: TITLE, body: BODY})).toBe(
      stringWithNamedParameters(STATUS_ANNOUNCEMENT_TEMPLATE, {title: TITLE, body: BODY})
    )
    expect(composeStatusMessage({title: TITLE, body: BODY})).toBe(`${TITLE}. ${BODY}`)
  })

  it('speaks a body-only banner as the body alone, with no leading separator', () => {
    expect(composeStatusMessage({body: BODY})).toBe(BODY)
    expect(composeStatusMessage({title: undefined, body: BODY})).toBe(BODY)
  })

  it('treats a blank or whitespace-only title as absent rather than joining an empty fragment', () => {
    expect(composeStatusMessage({title: '', body: BODY})).toBe(BODY)
    expect(composeStatusMessage({title: '   ', body: BODY})).toBe(BODY)
    expect(composeStatusMessage({title: '\n\t', body: BODY})).toBe(BODY)
  })

  it('keeps the title exactly as the banner draws it, including its own punctuation and spacing', () => {
    expect(composeStatusMessage({title: ' Still pending ', body: BODY})).toBe(` Still pending . ${BODY}`)
    expect(composeStatusMessage({title: 'Some meals changed.', body: BODY})).toBe(`Some meals changed.. ${BODY}`)
  })

  it('composes an empty body into the sentence rather than inventing copy for it', () => {
    expect(composeStatusMessage({title: TITLE, body: ''})).toBe(`${TITLE}. `)
    expect(composeStatusMessage({body: ''})).toBe('')
  })

  // A read error states one sentence and draws no body, so the title is the whole message: joining an absent
  // body would leave a screen reader trailing a bare '. ' after it.
  it('speaks a title-only banner as the title alone, with no trailing separator', () => {
    expect(composeStatusMessage({title: TITLE})).toBe(TITLE)
    expect(composeStatusMessage({title: TITLE, body: undefined})).toBe(TITLE)
    expect(composeStatusMessage({title: TITLE})).not.toContain('. ')
  })

  it('composes nothing at all for a banner that draws neither member', () => {
    expect(composeStatusMessage({})).toBe('')
    expect(composeStatusMessage({title: undefined, body: undefined})).toBe('')
  })

  // The blank-title rule and the absent-body rule meet here: neither member is a fragment to join, so there is
  // no sentence to speak rather than a separator standing in for one.
  it('composes nothing for a blank title with no body, never a bare separator', () => {
    expect(composeStatusMessage({title: ''})).toBe('')
    expect(composeStatusMessage({title: '   '})).toBe('')
    expect(composeStatusMessage({title: '\n\t'})).toBe('')
  })
})

describe('resolveStatusSemantics', () => {
  it('makes an alert interrupt: the alert role on an assertive live region', () => {
    expect(resolveStatusSemantics('alert')).toEqual({role: 'alert', liveRegion: 'assertive'})
  })

  it('makes a status wait its turn: the status role on a polite live region', () => {
    expect(resolveStatusSemantics('status')).toEqual({role: 'status', liveRegion: 'polite'})
  })

  it('resolves no semantics at all for an omitted role, so no accessibility props are rendered', () => {
    expect(resolveStatusSemantics(undefined)).toBeNull()
    expect(resolveStatusSemantics(null)).toBeNull()
  })
})

describe('resolveDefaultStatusRole', () => {
  it('announces the grocery list post-swap confirmation, which the tick is drawn only for', () => {
    expect(resolveDefaultStatusRole('tick')).toBe('status')
  })

  it('announces the grocery list amount-increase banner, which the warning triangle is drawn only for', () => {
    expect(resolveDefaultStatusRole('warning')).toBe('status')
  })

  it('leaves the info glyph silent, because it carries on-screen prose rather than an event', () => {
    expect(resolveDefaultStatusRole('info')).toBeNull()
  })

  it('leaves the disc silent, because 11b announces its post-log banner itself', () => {
    expect(resolveDefaultStatusRole('disc')).toBeNull()
  })

  it('leaves the alert glyph silent, so an untyped error banner keeps announcing only where asked', () => {
    expect(resolveDefaultStatusRole('alert')).toBeNull()
  })
})
