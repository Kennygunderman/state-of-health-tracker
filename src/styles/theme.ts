import {DefaultTheme} from '@react-navigation/native'

// "Clean & Calm" dark palette — deep sage blacks, charcoal cards, one green
// accent family. Legacy color keys are kept and remapped so older screens
// stay coherent until they are migrated.
const page = '#0C1310'
const card = '#161F1A'
const inset = '#202B25'
const tile = '#1B2620'
const track = '#232F28'

const hairline = '#222D26'
const inputBorder = '#28332C'
const grid = '#1E2822'
const dashedBorder = '#4B5750'

const textPrimary = '#EDF3EF'
const textSecondary = '#9CA9A2'
const textMuted = '#7E8B84'
const textFaint = '#6E7B74'
const textDisabled = '#4B5750'

const green = '#16BC85'
const teal = '#1CB6BF'
const lime = '#7ECC53'
const greenTint = '#13342A'
const greenOnTint = '#5FDCAC'
const tealTint = '#14282E'
const danger = '#E2685E'
const dangerTint = '#39241F'
const dangerBorder = 'rgba(226,104,94,0.4)'

const white = '#fff'
const heroScrim = 'rgba(8,13,10,0.6)'

export const Theme = {
  dark: true,
  fonts: DefaultTheme.fonts,
  colors: {
    ...DefaultTheme.colors,
    background: page,
    // Fully transparent `background` — pair with it in fade-out gradients
    backgroundTransparent: `${page}00`,
    primary: page,
    tertiary: card,
    secondary: hairline,
    secondaryLighter: green,
    white,
    text: textPrimary,
    navBar: '#101814',
    chip: tile,
    border: hairline,
    fireOrange: '#FF9502',
    error: danger,
    errorLight: dangerTint,
    success: green,
    overlayBackdrop: '#000',

    card,
    inset,
    tile,
    track,
    onInverse: page,
    hairline,
    inputBorder,
    grid,
    dashedBorder,
    textSecondary,
    textMuted,
    textFaint,
    textDisabled,
    accentGreen: green,
    teal,
    lime,
    greenTint,
    greenOnTint,
    tealTint,
    danger,
    dangerTint,
    dangerBorder,
    heroScrim,
    barMuted: '#33453B',
    barMid: '#57A67F',
    barActive: green,
    loginGradientStart: '#0B120E',
    loginGradientEnd: '#0E1712'
  }
}
