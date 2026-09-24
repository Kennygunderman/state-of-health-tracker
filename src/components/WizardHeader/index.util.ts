export const filledSegmentCount = (step: number, total: number): number =>
  Math.min(Math.max(step, 0), Math.max(total, 0))

// Whether the header shows the setup flow's progress at all. The segments and the "n of m" counter are one
// claim — "you are at step n of a flow of m" — so they appear and disappear together: a screen reopened on
// its own from a Review or Plan settings row is not in that flow, and drawing either half there asserts
// progress the user is not making (AAP 0.7.4 edit mode, which reopens one step and returns to where it was
// opened from). A non-positive total is refused for the same reason `filledSegmentCount` clamps: an empty
// track beside an "n of 0" counter would be chrome that states nothing.
export const shouldRenderProgress = (isProgressVisible: boolean, totalSteps: number): boolean =>
  isProgressVisible && totalSteps > 0
