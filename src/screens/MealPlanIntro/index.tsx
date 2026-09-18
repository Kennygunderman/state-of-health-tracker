import React from 'react'

import {ScrollView, View} from 'react-native'

import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import {Navigation} from '@navigation/types'
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
  MEAL_PLAN_INTRO_BODY,
  MEAL_PLAN_INTRO_DISMISS_BUTTON_TEXT,
  MEAL_PLAN_INTRO_PRIMARY_BUTTON_TEXT,
  MEAL_PLAN_INTRO_TITLE,
  MEAL_PLAN_OVERLINE
} from '@constants/strings'

import SampleWeekCard from './components/SampleWeekCard'
import styles from './index.styled'

const MealPlanIntroScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  // A confirmed `503 feature_disabled` from ANY gated route — a setup save, a nested plan read — is terminal
  // for a gated screen: there is nothing here to retry, so the guard leaves for the Meal Plan segment, which
  // states the refusal once (AAP 0.2.5). This screen issues no gated read of its own (AAP 0.7.4 makes it
  // first-entry only), so it mounts the guard for that departure alone.
  useMealPlanCapabilityGuard()

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
        <PrimaryButton label={MEAL_PLAN_INTRO_PRIMARY_BUTTON_TEXT} onPress={onBuildPlanPressed} />

        <TertiaryTextButton label={MEAL_PLAN_INTRO_DISMISS_BUTTON_TEXT} onPress={onNotNowPressed} />
      </SetupFooter>
    </SafeAreaView>
  )
}

export default MealPlanIntroScreen
