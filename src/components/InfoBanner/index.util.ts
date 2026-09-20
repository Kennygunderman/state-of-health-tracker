import {STATUS_ANNOUNCEMENT_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

export type BannerGlyph = 'info' | 'tick' | 'disc' | 'warning' | 'alert'

export type StatusRole = 'alert' | 'status'

export type StatusLiveRegion = 'assertive' | 'polite'

export interface StatusSemantics {
  role: StatusRole
  liveRegion: StatusLiveRegion
}

export interface StatusMessageParts {
  title?: string
  body?: string
}

// A banner's title and body are two text nodes on screen, so a screen reader reaches them as two unrelated
// fragments; the pair is spoken as one sentence instead. Either member may be the only one the banner draws —
// a read error states its headline alone, and an untitled note states its body alone — and joining an absent
// one would open the sentence with a bare '. ' or close it with a trailing one, so the member that is present
// is the whole message and a banner drawing neither announces nothing. A title that is blank or whitespace is
// absent on the same terms: it is not a fragment to join.
export const composeStatusMessage = ({title, body}: StatusMessageParts): string => {
  const spoken = title !== undefined && title.trim().length > 0 ? title : null

  if (spoken === null) {
    return body ?? ''
  }

  return body === undefined ? spoken : stringWithNamedParameters(STATUS_ANNOUNCEMENT_TEMPLATE, {title: spoken, body})
}

// An 'alert' interrupts what is being read because the status it carries refused or lost the action the user
// just asked for; a 'status' waits its turn. Null for an absent role, so a caller that asked for no status
// semantics renders no accessibility props at all rather than an inert role or a silent live region.
export const resolveStatusSemantics = (statusRole: StatusRole | null | undefined): StatusSemantics | null => {
  if (statusRole === null || statusRole === undefined) {
    return null
  }

  return {role: statusRole, liveRegion: statusRole === 'alert' ? 'assertive' : 'polite'}
}

// 'tick' and 'warning' are drawn only by the grocery list's post-swap banners, which arrive with the screen as
// the outcome of a swap the user made elsewhere: news, and so announced by default rather than only when a call
// site remembers to ask. The other three glyphs stay opt-in on purpose. 'disc' is 11b's post-log banner, which
// its own screen already wraps in a live region and announces — a default would say it twice. 'alert' is what an
// untyped error banner resolves to, so defaulting it would re-point many banners at once, and its call sites
// already pass `statusRole` where the status is news. 'info' is ordinary on-screen prose, not an event.
export const resolveDefaultStatusRole = (glyph: BannerGlyph): StatusRole | null =>
  glyph === 'tick' || glyph === 'warning' ? 'status' : null
