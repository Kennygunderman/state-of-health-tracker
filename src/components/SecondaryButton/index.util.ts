export type SecondaryButtonVariant = 'default' | 'dark'

export const showsPlusIcon = (variant: SecondaryButtonVariant): boolean => variant === 'default'

export const isDarkVariant = (variant: SecondaryButtonVariant): boolean => variant === 'dark'

// The dark variant is the Figma secondary CTA, whose height is authored explicitly at 52 on every footer
// that draws it (`34:426`, `34:517`, `49:674`) while its content box resolves to about 50: `Spacing.MEDIUM`
// above and below a 16px/600 label. That variant alone is pinned, to whichever is greater of the authored
// height and the touch-target floor; the default variant is the "+" affordance Figma does not draw as a
// CTA, and it keeps the content-derived height it ships with.
export const darkCtaMinHeight = (ctaHeight: number, touchTargetFloor: number): number =>
  Math.max(ctaHeight, touchTargetFloor)
