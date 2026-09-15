import React from 'react'

import {ScrollView, View} from 'react-native'

import type {SetupStatus} from '@data/models/MealPlanPreferences'
import {Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNavigation} from '@react-navigation/native'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import {SafeAreaView} from 'react-native-safe-area-context'

import ContentColumn from '@components/ContentColumn'
import PrimaryButton from '@components/PrimaryButton'
import SectionOverline from '@components/SectionOverline'
import SetupFooter from '@components/SetupFooter'
import TertiaryTextButton from '@components/TertiaryTextButton'
import Text from '@components/Text'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_CONTINUE_SETUP_BUTTON_TEXT,
  MEAL_PLAN_INTRO_BODY,
  MEAL_PLAN_INTRO_DISMISS_BUTTON_TEXT,
  MEAL_PLAN_INTRO_PRIMARY_BUTTON_TEXT,
  MEAL_PLAN_INTRO_TITLE,
  MEAL_PLAN_OVERLINE
} from '@constants/strings'

import SampleWeekCard from './components/SampleWeekCard'
import styles from './index.styled'

const RESUMABLE_SETUP_STATUSES: readonly SetupStatus[] = Object.freeze(['in_progress', 'ready_for_review'] as const)

const MealPlanIntroScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  const {data: preferences} = useMealPlanPreferencesQuery()

  const isSetupResumable = preferences != null && RESUMABLE_SETUP_STATUSES.includes(preferences.setupStatus)
  const ctaLabel = isSetupResumable ? MEAL_PLAN_CONTINUE_SETUP_BUTTON_TEXT : MEAL_PLAN_INTRO_PRIMARY_BUTTON_TEXT

  const onBuildPlanPressed = (): void => {
    navigation.navigate(Screens.MEAL_PLAN_GOAL, {mode: 'setup'})
  }

  // `popTo` rather than `goBack`: this route is pushed from the Meal Plan segment inside Macros and from the
  // grocery list's no-plan state, so going back would return the second caller to the grocery list instead of
  // the diary it asked for.
  const onNotNowPressed = (): void => {
    setMacrosSegment('diary')
    navigation.popTo(Screens.MACROS)
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.overlineWrapper}>
            <SectionOverline text={MEAL_PLAN_OVERLINE} tone="green" />
          </View>

          <Text style={styles.headline}>{MEAL_PLAN_INTRO_TITLE}</Text>

          <Text style={styles.body}>{MEAL_PLAN_INTRO_BODY}</Text>

          <View style={styles.sampleCardWrapper}>
            <SampleWeekCard />
          </View>
        </ScrollView>
      </ContentColumn>

      <SetupFooter>
        <PrimaryButton label={ctaLabel} onPress={onBuildPlanPressed} />

        <TertiaryTextButton label={MEAL_PLAN_INTRO_DISMISS_BUTTON_TEXT} onPress={onNotNowPressed} />
      </SetupFooter>
    </SafeAreaView>
  )
}

export default MealPlanIntroScreen
