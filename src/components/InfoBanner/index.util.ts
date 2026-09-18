import {STATUS_ANNOUNCEMENT_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

export type StatusRole = 'alert' | 'status'

export type StatusLiveRegion = 'assertive' | 'polite'

export interface StatusSemantics {
  role: StatusRole
  liveRegion: StatusLiveRegion
}

export interface StatusMessageParts {
  title?: string
  body: string
}

// A banner's title and body are two text nodes on screen, so a screen reader reaches them as two unrelated
// fragments; the pair is spoken as one sentence instead. A title that is absent or blank is not a fragment to
// join, and joining it anyway would open the sentence with a bare '. ' — the body alone is the whole message.
export const composeStatusMessage = ({title, body}: StatusMessageParts): string =>
  title !== undefined && title.trim().length > 0
    ? stringWithNamedParameters(STATUS_ANNOUNCEMENT_TEMPLATE, {title, body})
    : body

// An 'alert' interrupts what is being read because the status it carries refused or lost the action the user
// just asked for; a 'status' waits its turn. Null for an absent role, so a caller that asked for no status
// semantics renders no accessibility props at all rather than an inert role or a silent live region.
export const resolveStatusSemantics = (statusRole: StatusRole | null | undefined): StatusSemantics | null => {
  if (statusRole === null || statusRole === undefined) {
    return null
  }

  return {role: statusRole, liveRegion: statusRole === 'alert' ? 'assertive' : 'polite'}
}
