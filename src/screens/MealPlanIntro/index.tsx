import React from 'react'

import {ScrollView, View} from 'react-native'

import type {SetupStatus} from '@data/models/MealPlanPreferences'
import {useSetupResumeNavigation} from '@hooks/mealPlanning/useSetupResumeNavigation'
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
  MEAL_PLAN_OVERLINE,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT
} from '@constants/strings'

import SampleWeekCard from './components/SampleWeekCard'
import styles from './index.styled'

const RESUMABLE_SETUP_STATUSES: readonly SetupStatus[] = Object.freeze(['in_progress', 'ready_for_review'] as const)

const MealPlanIntroScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {resumeSetup} = useSetupResumeNavigation()
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  const {data: preferences, isPending, isError, refetch} = useMealPlanPreferencesQuery()

  const isSetupResumable = preferences != null && RESUMABLE_SETUP_STATUSES.includes(preferences.setupStatus)

  /**
   * Saved progress is not knowable until the read answers, and this screen's one action depends on it, so the
   * button has three states rather than a label that can outrun its destination.
   *
   * While the read is in flight the CTA is pending: `PrimaryButton` blocks the press, so a returning user who
   * arrives here from the grocery list's no-plan state and presses immediately cannot be restarted at the
   * first question by a race. When it has failed there is no answer to act on either, so the CTA retries the
   * read instead of guessing — pressing it is the recovery, and the ordinary route appears as soon as the
   * answer does. Only a settled read offers Build my plan or Continue setup.
   */
  const onBuildPlanPressed = (): void => {
    if (isError) {
      refetch()

      return
    }

    if (isSetupResumable) {
      resumeSetup(preferences.setupStep, preferences.setupStatus)

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_GOAL, {mode: 'setup'})
  }

  const resolveCtaLabel = (): string => {
    if (isError) {
      return MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT
    }

    return isSetupResumable ? MEAL_PLAN_CONTINUE_SETUP_BUTTON_TEXT : MEAL_PLAN_INTRO_PRIMARY_BUTTON_TEXT
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
        <PrimaryButton label={resolveCtaLabel()} isLoading={isPending} onPress={onBuildPlanPressed} />

        <TertiaryTextButton label={MEAL_PLAN_INTRO_DISMISS_BUTTON_TEXT} onPress={onNotNowPressed} />
      </SetupFooter>
    </SafeAreaView>
  )
}

export default MealPlanIntroScreen
