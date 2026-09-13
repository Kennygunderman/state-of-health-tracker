import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'

import BigNumberRow from '@components/BigNumberRow'
import MacroLegendRow from '@components/MacroLegendRow'
import SectionOverline from '@components/SectionOverline'
import Text from '@components/Text'

import {MEAL_PLAN_TARGETS_ACTION_ACCESSIBILITY_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import styles, {TARGETS_EDIT_HIT_SLOP, TARGETS_HEADER_ROW_HIT_SLOP} from './index.styled'

export type TargetsCardMacroKey = 'protein' | 'carbs' | 'fat'

export interface TargetsCardMacro {
  readonly key: TargetsCardMacroKey
  readonly label: string
  readonly valueText: string
}

const MACRO_DOT_COLORS: Record<TargetsCardMacroKey, string> = {
  protein: Theme.colors.accentGreen,
  carbs: Theme.colors.teal,
  fat: Theme.colors.lime
}

interface Props {
  readonly label: string
  readonly calorieFigure: string
  readonly unitLabel: string
  readonly macros: TargetsCardMacro[]
  readonly caption: string
  readonly editLabel: string
  readonly estimateFigure?: string
  readonly onEditPress: () => void
}

const TargetsCard = ({
  label,
  calorieFigure,
  unitLabel,
  macros,
  caption,
  editLabel,
  estimateFigure,
  onEditPress
}: Props) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow} hitSlop={TARGETS_HEADER_ROW_HIT_SLOP}>
        <View style={styles.labelSlot}>
          <SectionOverline text={label} />
        </View>

        <TouchableOpacity
          style={styles.editAction}
          activeOpacity={Opacity.PRESSED}
          hitSlop={TARGETS_EDIT_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_TARGETS_ACTION_ACCESSIBILITY_TEMPLATE, {
            action: editLabel
          })}
          onPress={onEditPress}>
          <Text style={styles.editLink}>{editLabel}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.figureWrapper, estimateFigure ? styles.estimatePairRow : undefined]}>
        <BigNumberRow figure={calorieFigure} unit={unitLabel} size="hero" />

        {estimateFigure ? <Text style={styles.estimateFigure}>{estimateFigure}</Text> : null}
      </View>

      <View style={styles.dividerWrapper}>
        <View style={styles.divider} />
      </View>

      <View style={styles.legendWrapper}>
        {macros.map((macro, index) => (
          <MacroLegendRow
            key={macro.key}
            label={macro.label}
            valueText={macro.valueText}
            dotColor={MACRO_DOT_COLORS[macro.key]}
            isFirst={index === 0}
          />
        ))}
      </View>

      <View style={styles.captionWrapper}>
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </View>
  )
}

export default TargetsCard
