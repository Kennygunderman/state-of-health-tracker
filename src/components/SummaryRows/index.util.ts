import {PLAN_SETTINGS_NOT_SET_VALUE} from '@constants/strings'

// A caller composes a row's value from data that may not have arrived — a targets read still in flight, a
// preference the user has not answered — and hands over an empty string for it. Drawn as-is that is a label
// over a blank line, which collapses the row below its drawn height and says nothing about why. The row
// states 'Not set' instead: the same answer Plan Settings already gives for the same condition, so the two
// surfaces never disagree, and no new copy is introduced for it.
export const summaryRowDisplayValue = (value: string): string =>
  value.trim().length > 0 ? value : PLAN_SETTINGS_NOT_SET_VALUE
