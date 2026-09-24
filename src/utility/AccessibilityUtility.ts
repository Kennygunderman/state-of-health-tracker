import {MEAL_PLAN_ANNOUNCEMENT_SEPARATOR} from '@constants/strings'

// A label and its value are two text nodes on screen and, left ungrouped, two unrelated reading stops: a
// screen reader announces 'Protein' and '116 / 128g' as separate destinations with nothing tying them
// together, and the reader has to remember the first while arriving at the second. Grouping the pair into one
// element fixes the pairing but hands the platform the job of naming it, and the name a platform derives from
// subviews follows drawn order rather than sentence order. Composing the name here is how a grouped pair is
// spoken as the sentence it is, in the order the caller chose.
//
// Parts arrive from data as often as from copy, so a part may legitimately be absent — a summary row whose
// answer has not been given yet, an optional qualifier a screen shows only sometimes. An absent part must
// leave no trace: joining it anyway yields a trailing separator, and keeping it as an empty string yields a
// silent reading stop with no name at all, which is the defect this helper exists to remove.
//
// Undefined rather than an empty string when nothing survives, because that is the value a caller can pass
// straight to `accessibilityLabel`: undefined lets the platform fall back to whatever text the element
// actually draws, while an empty string overrides that fallback with a nameless element.
export function composeAccessibleName(parts: readonly (string | null | undefined)[]): string | undefined {
  const spoken = parts
    .map(part => (typeof part === 'string' ? part.trim() : ''))
    .filter(part => part.length > 0)
    .join(MEAL_PLAN_ANNOUNCEMENT_SEPARATOR)

  return spoken.length > 0 ? spoken : undefined
}
