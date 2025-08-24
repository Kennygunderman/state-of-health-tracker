import React from 'react'

import {Linking, SafeAreaView, ScrollView} from 'react-native'

import {FontAwesome5, Ionicons, MaterialCommunityIcons} from '@expo/vector-icons'
import useAuthStore from '@store/auth/useAuthStore'
import LocalStore from '@store/LocalStore'
import {useSessionStore} from '@store/session/useSessionStore'
import useUserData from '@store/userData/useUserData'
import useWorkoutSummariesStore from '@store/workoutSummaries/useWorkoutSummariesStore'
import {Text, useStyleTheme} from '@theme/Theme'
import {useSelector} from 'react-redux'

import HorizontalDivider from '@components/HorizontalDivider'

import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'
import {
  ACCOUNT_AUTH_SECTION_TITLE,
  ACCOUNT_CURRENT_WEIGHT_LIST_ITEM,
  ACCOUNT_LOGGED_IN_AS,
  ACCOUNT_PRIVACY_POLICY,
  ACCOUNT_STATS_SECTION_TITLE,
  ACCOUNT_TARGET_CALORIES_LIST_ITEM,
  ACCOUNT_TARGET_WORKOUTS_LIST_ITEM,
  ACCOUNT_TARGETS_SECTION_TITLE,
  ACCOUNT_TOTAL_DAYS_MACROS_LIST_ITEM,
  ACCOUNT_TOTAL_DAYS_WORKOUTS_LIST_ITEM,
  ACCOUNT_WELCOME_TEXT
} from '@constants/Strings'

import AccountListItem from './components/AccountListItem'
import AuthListItem from './components/AuthListItem'
import DeleteAccountListItem from './components/DeleteAccountListItem'
import {DailyMealEntry, getPreviousDailyMealEntriesSelector} from '../../selectors/MealsSelector'
import {formatDayMonthDay} from '../../utility/DateUtility'

const AccountScreen = () => {
  const dailyMealEntries = useSelector<LocalStore, DailyMealEntry[]>((state: LocalStore) =>
    getPreviousDailyMealEntriesSelector(state, 10_000)
  )

  const {currentWeight, targetWorkouts, targetCalories} = useUserData()
  const {sessionStartDate} = useSessionStore()

  const {userEmail, isAuthed} = useAuthStore()
  const {totalSummaries} = useWorkoutSummariesStore()

  const iconSize = 24
  const iconColor = useStyleTheme().colors.white

  const getWelcomeMessage = () => {
    return ACCOUNT_LOGGED_IN_AS + userEmail
  }

  const sectionHeader = (title: string) => (
    <Text
      style={{
        fontSize: FontSize.H2,
        fontWeight: 'bold',
        marginTop: Spacing.X_LARGE,
        marginLeft: Spacing.LARGE,
        marginBottom: Spacing.SMALL
      }}>
      {title}
    </Text>
  )

  const targetsSection = () => (
    <>
      {sectionHeader(ACCOUNT_TARGETS_SECTION_TITLE)}

      <HorizontalDivider />

      <AccountListItem
        type="target-calories"
        text={ACCOUNT_TARGET_CALORIES_LIST_ITEM + targetCalories.toString()}
        icon={<MaterialCommunityIcons name="fire" size={iconSize} color={iconColor} />}
      />

      <AccountListItem
        type="target-workouts"
        text={ACCOUNT_TARGET_WORKOUTS_LIST_ITEM + targetWorkouts.toString()}
        icon={<MaterialCommunityIcons name="weight-lifter" size={iconSize} color={iconColor} />}
      />
    </>
  )

  const statsSection = () => (
    <>
      {sectionHeader(ACCOUNT_STATS_SECTION_TITLE)}

      <HorizontalDivider />

      <AccountListItem
        type="weight"
        text={`${ACCOUNT_CURRENT_WEIGHT_LIST_ITEM} ${currentWeight}`}
        icon={<FontAwesome5 name="weight" size={iconSize - 4} style={{marginTop: 2}} color={iconColor} />}
      />

      <AccountListItem
        type="info"
        clickable={false}
        text={ACCOUNT_TOTAL_DAYS_MACROS_LIST_ITEM + dailyMealEntries.length}
        icon={<MaterialCommunityIcons name="food-variant" size={iconSize} color={iconColor} />}
      />

      <AccountListItem
        type="info"
        clickable={false}
        text={ACCOUNT_TOTAL_DAYS_WORKOUTS_LIST_ITEM + totalSummaries}
        icon={<Ionicons name="barbell" size={iconSize} color={iconColor} />}
      />
    </>
  )

  const openPrivacyPolicy = async () => {
    const privacyPolicy = 'https://www.stateofhealthapp.com/privacy-policy'
    const supported = await Linking.canOpenURL(privacyPolicy)

    if (supported) {
      await Linking.openURL(privacyPolicy)
    }
  }

  const authSection = () => (
    <>
      {sectionHeader(ACCOUNT_AUTH_SECTION_TITLE)}

      <HorizontalDivider />

      <AuthListItem />

      <AccountListItem
        type="info"
        clickable={true}
        text={ACCOUNT_PRIVACY_POLICY}
        icon={<Ionicons name="document" size={iconSize} color={iconColor} />}
        onPressOverride={openPrivacyPolicy}
      />

      {isAuthed && <DeleteAccountListItem />}
    </>
  )

  const header = () => (
    // Wrapping in fragment is necessary here to keep styling
    <>
      {}

      <Text
        style={{
          fontWeight: 'bold',
          backgroundColor: useStyleTheme().colors.background,
          paddingTop: Spacing.MEDIUM,
          paddingLeft: Spacing.LARGE,
          paddingBottom: Spacing.SMALL
        }}>
        {formatDayMonthDay(sessionStartDate)}
      </Text>
    </>
  )

  return (
    <>
      <SafeAreaView>
        <ScrollView style={{height: '100%'}} stickyHeaderIndices={[0]} keyboardShouldPersistTaps={true}>
          {header()}

          <Text
            style={{
              fontSize: FontSize.H1,
              fontWeight: 'bold',
              margin: Spacing.MEDIUM,
              marginBottom: Spacing.XX_SMALL,
              marginLeft: Spacing.LARGE
            }}>
            {ACCOUNT_WELCOME_TEXT}
          </Text>

          <Text
            style={{
              fontWeight: '200',
              marginLeft: Spacing.LARGE
            }}>
            {getWelcomeMessage()}
          </Text>

          {targetsSection()}

          {statsSection()}

          {authSection()}
        </ScrollView>
      </SafeAreaView>
    </>
  )
}

export default AccountScreen
