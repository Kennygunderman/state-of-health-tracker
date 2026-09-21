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
// The blocking scrim the forced-update sheet lays over the app. Distinct from `overlayBackdrop`, which is
// opaque black that react-native-modal composes with its own `backdropOpacity`; a scrim painted as a single
// `backgroundColor` carries its alpha in the colour, so it needs its own value.
const sheetScrim = 'rgba(0,0,0,0.7)'

// BLITZY [A11Y] — accessible-colour register.
//
// STATUS, in two parts, because they have different owners and different states.
//
// ENGINEERING: COMPLETE. Every pair below implements the value Figma draws, which is what this feature's
// precedence requires — see "Why they were not simply raised" for the citation — so none of them is a
// judgement left open in code. The accessibility work that is engineering's alone is applied throughout the
// feature and is what keeps each control below reachable and named: an `accessibilityRole` and an
// `accessibilityLabel` on every pressable (Agent Action Plan 0.7.2) and 44px targets (0.6.5). Raising a
// rendered colour is the one remedy engineering cannot apply on its own, because it would break the 1:1
// Figma mapping the same sections require of every token here.
//
// `BLITZY [A11Y]` is this repository's own marker for a Figma-exact pairing that sits under the WCAG AA
// default, not a requirement of the plan, which names neither the marker nor a contrast rule of its own. It
// is emitted here and at each point of use — `grep -rn 'BLITZY \[A11Y\]' src` lists them — so the debt is
// findable from the code rather than only from a report, and the deferral itself is recorded in the
// checkpoint report.
//
// DESIGN: OPEN. Only a design decision can change a rendered value here, and none has been supplied, so
// each pair remains accepted, tracked accessibility debt rather than a compliant treatment. This register
// does not make the pairs compliant. What it does is make the decision cheap: every ratio below is
// measured at the composited values and every remedy is pre-computed, so applying an approved decision is
// mechanical rather than investigative. Anyone raising one of these values should read the paragraph below
// first — the reach is wider than the token.
//
// Why they were not simply raised: each pair was re-verified node by node against Figma file
// ZytSsn2tKVpMCSoibMJ274 and is drawn there exactly as the app renders it. The precedence governing this
// feature is token compliance, then Figma fidelity, then accessibility — Agent Action Plan 0.6.5, which is
// supplied to implementers as the project directive rather than as a file in this repository — with Figma
// named the visual source of truth (0.1.2) and every one of these colours recorded as an exact 1:1 token
// match (0.2.2, 0.6.3). The WCAG default therefore governs where Figma is silent, and here it is not.
// Raising a value would also reach far outside this feature, because this is the app-wide palette rather
// than a meal-planning one: `green` alone backs `accentGreen`, `success`, `secondaryLighter` and
// `barActive`, which paint shipped surfaces this feature never touches — including the bottom tab bar that
// 0.8.2 holds out of scope — so an edit here would break the 1:1 Figma mapping everywhere else. The reach
// is left countable rather than quoted, since any number written here would rot: count the modules that
// read these constants with `grep -rl '@styles/theme' src | wc -l`, and the ones that paint with the green
// family with `grep -rlE 'accentGreen|colors\.success|secondaryLighter|barActive' src | wc -l`.
//
// What design needs to decide, per entry: accept the Figma value, or adopt the remedy named with it. The
// remedies keep each control's visual language intact and are given as existing palette tokens wherever one
// already clears the threshold, so most require no new colour. Ratios are measured at the composited values;
// Figma applies no opacity to any of these layers.
//
// 1. `white` on `green` — 2.45:1, needing 4.5:1 as button and pill text, 3:1 as a required glyph. This is
//    the widest-reaching entry here: it is one pair rendered by the shared PrimaryButton, the shared
//    InfoBanner, the shared OptionCard and the shared CheckboxSquare, so it is a single decision and not a
//    per-screen one. Figma 46:120 + 46:121 and 34:420 and 34:511 (CTA label, 600/16px, not large text —
//    34:420 is "Try again" on the generation-failure frame and 34:511 "Edit preferences" on the no-match
//    frame, both drawn with the same white-on-accent label as every other primary CTA), 38:396 + 38:397
//    (banner action pill, 600/13px), 49:282 + 49:283 (banner disc tick), 46:172 + 46:173 and 38:121 +
//    38:122 (option indicator — the setup option cards and the log screen's slot picker draw the same
//    accent disc under the same white tick), 37:262 + 37:263 and 47:387 + 47:388 (checked-emphasis box).
//    Two surfaces carry this pair without a Figma node of their own, because they are inferred states built
//    from the drawn language rather than from a frame: the Meal Plan tab's inline retry pill follows
//    38:396 + 38:397, and the checked-muted tick 37:277 + 37:278 is the same drawing recoloured and sits
//    well clear of the threshold. White is already maximum contrast, so only the accent can move: `page` on
//    `green` measures 7.67:1 and `greenTint` on `green` 5.52:1, or darken the accent to relative luminance
//    <= 0.183 for text and <= 0.300 for glyphs. Apply an approved remedy at the token, never at one call
//    site: doing it at a single surface is what makes two identical pills or two identical discs diverge.
// 2. `textFaint` as placeholder — 3.31:1 on `inset` and 3.28:1 on `dangerTint`, needing 4.5:1. Figma 47:275 +
//    47:280 and 46:446 + 46:448 (400/18px, which does not qualify as large text). Set once as the shared
//    TextInput's `placeholderTextColor` prop, so it is the same paint in every shipped form. `textMuted`
//    reaches only 4.12:1 on `inset`; `textSecondary` reaches 6.01:1 there and 5.95:1 on `dangerTint`.
//    Scope of the actual gap: no field's identity rests on this paint. `TextField` requires an
//    `accessibilityLabel` and forwards it to the input, so assistive technology reads a field's purpose
//    from that label and never from the placeholder — the invisible half of the accessibility rule, applied
//    as it requires. What is left is the sighted low-vision case: a hint that is harder to read than it
//    should be beside a label that is not.
// 3. `textMuted` on `tile` — 4.40:1, needing 4.5:1; short by 0.10, the narrowest miss here. Figma 49:39 +
//    49:41 and the unit toggles 46:315 and 46:344. The unselected segment has no fill of its own, so the
//    track is the operative backdrop and both labels share one 600/13px style. `textSecondary` gives 6.40:1.
// 4. `danger` on `dangerTint` — 4.41:1, needing 4.5:1 — in DeltaPill's grocery delta pill, and only there.
//    Figma draws that pill and this pair at 37:273 + 37:274 (600/13px). The same label on `card` measures
//    5.12:1, so the pill's own tint is what drops it below the threshold; `textSecondary` on `dangerTint`
//    measures 5.95:1 but gives up the red semantic that marks an increase. BadgePill's warning tone no
//    longer shares the pair: it is an inferred state with no Figma counterpart, so nothing drawn governs
//    its label and it uses `text` on the same `dangerTint` fill at 12.91:1 — the pairing Figma draws for
//    the error banner's title on that fill (see `@components/BadgePill/index.styled`).
// 5. `textDisabled` as a hollow outline — 2.23:1 on `card` and 2.49:1 on `page`, needing 3:1. Figma 46:180
//    and 38:129 (option indicator) and 37:218 (unchecked box) are stroke-only with no fill, so the parent
//    surface shows through and `card` is the operative backdrop. `textMuted` gives 4.75:1 on `card`.
// 6. `inputBorder` on `inset` — 1.12:1, needing 3:1, with the field itself 1.28:1 on `page`, so an unfocused
//    field has no identifiable boundary. Figma 46:302, 46:323, 46:330, 46:351 and 47:275. Every
//    surface-to-surface pair in this palette is below 1.5:1 by design and boundaries are carried by strokes,
//    so only the stroke can move: `textFaint` as the border measures 3.31:1 and `textMuted` 4.12:1.
// 7. `textDisabled` disc under a `page` glyph — 1.94:1 disc-to-field and 2.49:1 glyph-to-disc, both needing
//    3:1. Figma 47:369 + 47:370. Inverting the glyph to `white` on the existing disc measures 7.56:1.
// 8. `textFaint` and `textDisabled` as muted row text — 3.81:1 and 2.23:1 on `card`, both needing 4.5:1.
//    Figma 37:282 and 37:285 author these as opaque fills rather than an opacity, so there is no alpha to
//    remove and any remedy changes a colour. `textMuted` clears the threshold at 4.75:1 but collapses the
//    two-tone mute into a single grey.
// 9. `textMuted` on `inset` — 4.12:1, needing 4.5:1. Two surfaces render it, and Figma authors both small
//    and regular, so neither qualifies as large text. The first is SummaryRows' `label` inside
//    PlanConfirmDialog's `summaryPanel` — the F14 regenerate-confirm dialog's summary rows. Figma draws the
//    dialog 38:520 on `card` and its panel 38:531 on `inset` (radius 20, padding 16), with all three labels
//    400 13/18.85 and no opacity on any layer, so the composited pair is the declared one. Its `overline`
//    carries the same `textMuted`, so a panel call site that passes one draws the same pair; the dialog
//    passes none today. The second is the shared `TextField`'s `unit` suffix (400 15), which sits inside the
//    field's own `container` at `inset` — Figma 46:197, 34:220, 34:246 and 47:639 — so it is one paint in
//    every form that renders a unit-bearing field rather than a screen's own, like the placeholder in
//    entry 2. The panel's fill is what drops the label here, not the component: the three other SummaryRows
//    call sites (MealPlanTargets, MealPlanCookingBudget, MealPlanGenerating) and the two screen-local rows
//    that draw the same muted label (PlanSettings' `SettingsRow`, MealPlanGenerating's
//    `LimitingConstraintRows`) all sit on `card`, where it measures 4.75:1 and clears the threshold — so
//    moving the panel fill is an alternative to moving the text colour, and either is design's decision.
//    `textSecondary` on `inset` measures 6.01:1 and stays in the same grey family; the other measured
//    neighbours are `text` on `inset` at 13.02:1 and `textMuted` on `card` at 4.75:1. As in entry 2 the
//    pair also ships outside this feature and predates it — FoodDetail's "this adds" row, LogWithAI's
//    summary card, and CreateFood's macro-cell unit suffixes and calories row — and that reach is left
//    countable rather than quoted: `grep -rl 'colors\.inset' src --include=*.styled.ts | xargs grep -l
//    'colors\.textMuted' | wc -l` bounds the stylesheets carrying both.

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
    sheetScrim,
    barMuted: '#33453B',
    barMid: '#57A67F',
    barActive: green,
    loginGradientStart: '#0B120E',
    loginGradientEnd: '#0E1712'
  }
}
