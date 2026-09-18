import {STATUS_ANNOUNCEMENT_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import {composeStatusMessage, resolveStatusSemantics} from '../index.util'

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
