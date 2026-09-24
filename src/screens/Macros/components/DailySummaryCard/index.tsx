import React, {useEffect, useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import {MacroTotals} from '@data/models/Macros'
import {Navigation} from '@navigation/types'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {isLegacyTargetEditorOpen, resolveTargetAuthority} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
import {useNavigation} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'
import Svg, {Circle} from 'react-native-svg'

import TargetCaloriesModal from '@components/dialog/TargetCaloriesModal'
import MacroGramRow from '@components/MacroGramRow'
import Text from '@components/Text'

import Screens from '@constants/screens'
import {CARBS_LABEL, FAT_LABEL, OVER_TEXT, PROTEIN_LABEL, REMAINING_TEXT} from '@constants/strings'

import styles from './index.styled'
import {calorieBalance, formatCalories, progressFraction, ResolvedMacroTargets} from '../../index.util'

const RING_SIZE = 116
const RING_STROKE_WIDTH = 10

interface Props {
  totals: MacroTotals
  // The day's own targets, resolved by `Macros/index.util::resolveMacroTargets` from the block
  // `GET /macros/:date` answers with (AAP 0.1.3). The targets read below never decides what this card
  // displays — it decides only which editor a press on the ring opens.
  targets: ResolvedMacroTargets
}

const DailySummaryCard = ({totals, targets}: Props) => {
  const [isTargetModalVisible, setIsTargetModalVisible] = useState(false)
  const navigation = useNavigation<Navigation>()
  const isAuthed = useAuthStore(state => state.isAuthed)
  const nutritionTargetsRead = useNutritionTargetsQuery()

  const targetAuthority = resolveTargetAuthority({read: nutritionTargetsRead, isAuthed})
  const radius = (RING_SIZE - RING_STROKE_WIDTH) / 2
  const circumference = 2 * Math.PI * radius
  const fraction = progressFraction(totals.calories, targets.calories)
  const balance = calorieBalance(totals.calories, targets.calories)

  // Keeps the request from outliving the answer it was made under: while the modal is open the targets read can
  // resolve to server authority, and a request left standing would reopen the local-only writer the next time
  // the device owns the target.
  useEffect(() => {
    if (targetAuthority.editor !== 'legacy') {
      setIsTargetModalVisible(false)
    }
  }, [targetAuthority.editor])

  // Every authority names an editor, so the press always opens one: the canonical full-screen editor when the
  // server owns the target, the legacy modal otherwise — which is what this ring did before the planner existed
  // and what AAP 0.1.4 requires it to keep doing.
  const onEditTargetsPressed = () => {
    if (targetAuthority.editor === 'legacy') {
      setIsTargetModalVisible(true)
    } else {
      // RootStackParamList has no MacrosStack member, so AAP 0.7.4's nested navigate cannot type from inside it
      navigation.navigate(Screens.MEAL_PLAN_EDIT_TARGETS, {mode: 'edit', returnTo: {kind: 'tab', tab: 'MacrosStack'}})
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke={Theme.colors.track}
            strokeWidth={RING_STROKE_WIDTH}
            fill="none"
          />

          {fraction > 0 && (
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={Theme.colors.accentGreen}
              strokeWidth={RING_STROKE_WIDTH}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - fraction)}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          )}
        </Svg>

        <TouchableOpacity style={styles.ringCenter} activeOpacity={Opacity.PRESSED} onPress={onEditTargetsPressed}>
          <Text style={styles.balanceValue}>{formatCalories(balance.amount)}</Text>

          <Text style={[styles.balanceLabel, balance.isOver && styles.balanceLabelOver]}>
            {balance.isOver ? OVER_TEXT : REMAINING_TEXT}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.macroRows}>
        <MacroGramRow label={PROTEIN_LABEL} grams={totals.protein} dotColor={Theme.colors.accentGreen} />

        <MacroGramRow label={CARBS_LABEL} grams={totals.carbs} dotColor={Theme.colors.teal} />

        <MacroGramRow label={FAT_LABEL} grams={totals.fat} dotColor={Theme.colors.lime} isLast />
      </View>

      <TargetCaloriesModal
        isVisible={isLegacyTargetEditorOpen(targetAuthority, isTargetModalVisible)}
        onDismissed={() => setIsTargetModalVisible(false)}
      />
    </View>
  )
}

export default DailySummaryCard
