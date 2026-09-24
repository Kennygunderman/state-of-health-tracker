import FontSize, {FontWeight, LetterSpacing, LineHeight} from '../fontSize'

// The line-height map is the one place the design's own leading is written down, and it is the shared root
// cause behind a whole class of reported defects: a box left unset falls back to the platform font's
// multiplier, and a box pinned at the wrong value collapses two distinct text styles into one. Both failures
// are invisible in a diff and invisible in a type check — the only thing that catches them is an assertion
// naming the size, the box Figma resolves for it, and which of the two it is.
//
// Figma leaves a line height automatic on some styles and authors one on others. Its automatic leading
// resolves to a whole pixel at every size in the meal-plan file, read from the nodes' declared dimensions and
// from the painted wrappers that hug them. React Native's default is the font's own multiplier instead —
// 1.21 for iOS Helvetica Neue — which lands on none of those boxes. Each pair below is therefore one size
// with two legitimate boxes, and using either for the other is the defect.
const PLATFORM_MULTIPLIER = 1.21

interface AutomaticBox {
  readonly token: keyof typeof LineHeight
  readonly size: number
  readonly box: number
  // The Figma node the box was measured from, so a future reader can re-check it rather than trust this file.
  readonly evidence: string
}

const AUTOMATIC_BOXES: readonly AutomaticBox[] = [
  {
    token: 'TAB_LABEL',
    size: FontSize.TAB_LABEL,
    box: 12,
    evidence: 'label 49:358 in badge 49:357, painted 16 over 2px insets'
  },
  {
    token: 'OVERLINE',
    size: FontSize.OVERLINE,
    box: 13,
    evidence: 'wrappers 37:50 (33 over 20) and 37:86/114/134 (29 over 16)'
  },
  {
    token: 'LABEL',
    size: FontSize.LABEL,
    box: 16,
    evidence: 'captions 46:359, 47:218, 47:323 and 47:451 in fixed 24 wrappers'
  },
  {token: 'BODY_COMPACT', size: FontSize.BODY, box: 18, evidence: 'inline summary value 34:335; diary name run 38:264'},
  {
    token: 'STAT_LG_FIGURE',
    size: FontSize.STAT_LG,
    box: 34,
    evidence: 'figure 36:199, which declares its own height as 34'
  }
]

// The boxes Figma states outright. These are quoted from the file and must not drift toward a multiplier
// either: STAT_LG and META in particular are cited by the Agent Action Plan and consumed widely.
const AUTHORED_BOXES: readonly {token: keyof typeof LineHeight; box: number}[] = [
  {token: 'SCREEN_TITLE', box: 34.5},
  {token: 'STAT_LG', box: 32.2},
  {token: 'GREETING', box: 25.3},
  {token: 'BODY', box: 21.75},
  {token: 'STEP_BODY', box: 21},
  {token: 'ROW_VALUE', box: 19.5},
  {token: 'META', box: 18.85},
  {token: 'OPTION_SUBCOPY', box: 17.55}
]

// One size, two boxes: the automatic one and the one Figma authors. A style that reaches for the wrong member
// of a pair is the reported collapse — a 13px caption drawn at the 13px multiline leading, a 15px inline value
// drawn at the 15px stacked leading, a 28px figure drawn at the 28px title leading.
const SIZE_PAIRS: readonly {size: number; automatic: keyof typeof LineHeight; authored: keyof typeof LineHeight}[] = [
  {size: FontSize.LABEL, automatic: 'LABEL', authored: 'META'},
  {size: FontSize.BODY, automatic: 'BODY_COMPACT', authored: 'ROW_VALUE'},
  {size: FontSize.STAT_LG, automatic: 'STAT_LG_FIGURE', authored: 'STAT_LG'}
]

describe('the automatic line boxes', () => {
  it.each(AUTOMATIC_BOXES)('draws $size px text in the $box px box Figma resolves ($evidence)', entry => {
    expect(LineHeight[entry.token]).toBe(entry.box)
  })

  // Figma's automatic leading is a whole pixel at every size in this file. A fractional value in this group
  // means someone has computed a ratio rather than read the drawn box.
  it.each(AUTOMATIC_BOXES)('states $token as a whole pixel rather than a computed ratio', entry => {
    expect(Number.isInteger(LineHeight[entry.token])).toBe(true)
  })

  // The specific regression: OVERLINE shipped as 13.31, which is 11 x 1.21 — the platform multiplier, not
  // anything drawn. The same arithmetic would put LABEL at 15.73 and STAT_LG_FIGURE at 33.88.
  it.each(AUTOMATIC_BOXES)('does not fall back to the platform multiplier for $size px text', entry => {
    expect(LineHeight[entry.token]).not.toBeCloseTo(entry.size * PLATFORM_MULTIPLIER, 2)
  })
})

describe('the authored line boxes', () => {
  it.each(AUTHORED_BOXES)('keeps $token at the $box Figma states', entry => {
    expect(LineHeight[entry.token]).toBe(entry.box)
  })
})

describe('the sizes that carry two boxes', () => {
  it.each(SIZE_PAIRS)('keeps $automatic and $authored distinct at $size px', pair => {
    expect(LineHeight[pair.automatic]).not.toBe(LineHeight[pair.authored])
  })
})

describe('the shape of the map', () => {
  // Ordered by box, largest first, so a new token has exactly one correct place to land and a reader can see
  // at a glance which boxes sit either side of it.
  it('lists every line height in descending order', () => {
    const boxes = Object.values(LineHeight)

    expect(boxes).toEqual([...boxes].sort((first, second) => second - first))
  })

  it('states a line height for every size that has one, and no orphans', () => {
    const named = Object.keys(LineHeight)

    expect(named).toEqual([...new Set(named)])
    expect(named.length).toBe(AUTOMATIC_BOXES.length + AUTHORED_BOXES.length)
  })
})

describe('the metrics beside it', () => {
  // Letter spacing is pixels here because React Native measures it in pixels, while Figma states em: the two
  // overline sizes both land on their em value times their size, which is what makes the conversion checkable.
  it('states letter spacing in pixels rather than Figma em values', () => {
    expect(LetterSpacing.OVERLINE).toBeCloseTo(FontSize.OVERLINE * 0.0545, 1)
    expect(LetterSpacing.NONE).toBe(0)
  })

  // Figma uses three weights across the meal-plan file, and React Native takes them as strings.
  it('states the weights the design uses as strings', () => {
    expect(FontWeight.REGULAR).toBe('400')
    expect(FontWeight.SEMIBOLD).toBe('600')
    expect(FontWeight.BOLD).toBe('700')
  })

  // No family, on purpose: Agent Action Plan 0.1.4 and 0.6.3 adopt the platform default and match the metrics
  // instead. A family appearing here means option B was taken without the licence review it requires.
  it('carries no font family, which is what makes the metrics above load-bearing', () => {
    expect(Object.keys(FontSize)).not.toContain('FAMILY')
  })
})
