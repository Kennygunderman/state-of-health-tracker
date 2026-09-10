export const isPressBlocked = (isLoading: boolean, disabled: boolean): boolean => isLoading || disabled

export const isDimmed = (isLoading: boolean, disabled: boolean): boolean => disabled
