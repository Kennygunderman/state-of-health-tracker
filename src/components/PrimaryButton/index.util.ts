export const isPressBlocked = (isLoading: boolean, disabled: boolean): boolean => isLoading || disabled

export const isDimmed = (isLoading: boolean, disabled: boolean): boolean => disabled

// Figma authors this CTA's height explicitly — `46:118` on the component and `34:285`, `34:420`, `34:511`
// and `49:671` on the footers that use it all declare 52 — while its content box resolves to about 50:
// `Spacing.MEDIUM` above and below a 16px/600 label. The box is therefore pinned rather than derived, and
// pinned to whichever is greater of the authored height and the touch-target floor, so neither token
// moving can leave the primary action smaller than a reachable target.
export const ctaMinHeight = (ctaHeight: number, touchTargetFloor: number): number =>
  Math.max(ctaHeight, touchTargetFloor)
