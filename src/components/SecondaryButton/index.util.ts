export type SecondaryButtonVariant = 'default' | 'dark'

export const showsPlusIcon = (variant: SecondaryButtonVariant): boolean => variant === 'default'

export const isDarkVariant = (variant: SecondaryButtonVariant): boolean => variant === 'dark'
