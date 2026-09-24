import React from 'react'

import {ActivityIndicator, Image, Linking, ScrollView, TouchableOpacity, View} from 'react-native'

import {useWeightUnitLabel} from '@hooks/userData/useWeightUnitLabel'
import {HomeTabsParamList} from '@navigation/HomeTabs'
import {mutationKeys} from '@queries/keys'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {resolveTargetAuthority, targetAuthorityKey} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
import {useRunsTotalQuery} from '@queries/runs/useRunsTotalQuery'
import {useUserAvatarQuery} from '@queries/user/useUserAvatarQuery'
import {useWeighInsQuery} from '@queries/weighIns/useWeighInsQuery'
import {useWorkoutSummariesInfiniteQuery} from '@queries/workouts/useWorkoutSummariesInfiniteQuery'
import {NavigationProp, useNavigation} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useUserData from '@store/userData/useUserData'
import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {useIsMutating} from '@tanstack/react-query'
import LinearGradient from 'react-native-linear-gradient'
import {SafeAreaView} from 'react-native-safe-area-context'

import {openGlobalBottomSheet} from '@components/GlobalBottomSheet'
import BarbellIcon from '@components/icons/BarbellIcon'
import CameraIcon from '@components/icons/CameraIcon'
import DocumentIcon from '@components/icons/DocumentIcon'
import DumbbellIcon from '@components/icons/DumbbellIcon'
import FlameIcon from '@components/icons/FlameIcon'
import RunIcon from '@components/icons/RunIcon'
import ScaleIcon from '@components/icons/ScaleIcon'
import StarIcon from '@components/icons/StarIcon'
import StepsIcon from '@components/icons/StepsIcon'
import Text from '@components/Text'

import Screens from '@constants/screens'
import {
  ACCOUNT_AUTH_SECTION_TITLE,
  ACCOUNT_DAILY_CALORIES_LABEL,
  ACCOUNT_DAILY_STEPS_LABEL,
  ACCOUNT_GOAL_WEIGHT_LABEL,
  ACCOUNT_LOGGED_IN_AS_GUEST,
  GUEST_AVATAR_INITIAL,
  ACCOUNT_PRIVACY_POLICY,
  ACCOUNT_RATE_APP_LABEL,
  ACCOUNT_SETTINGS_SECTION_TITLE,
  ACCOUNT_STATS_SECTION_TITLE,
  ACCOUNT_TARGETS_SECTION_TITLE,
  ACCOUNT_TOTAL_RUNS_LABEL,
  ACCOUNT_TOTAL_WEIGH_INS_LABEL,
  ACCOUNT_TOTAL_WORKOUT_DAYS_LABEL,
  ACCOUNT_WEIGHT_UNIT_LABEL,
  ACCOUNT_WELCOME_TEXT,
  ACCOUNT_WORKOUTS_PER_WEEK_LABEL,
  PROGRESS_BODY_SET_GOAL_LABEL
} from '@constants/strings'
import {urls} from '@constants/urls'

import AccountListItem from './components/AccountListItem'
import AuthListItem from './components/AuthListItem'
import DeleteAccountListItem from './components/DeleteAccountListItem'
import ProfilePhotoBottomSheet from './components/ProfilePhotoBottomSheet'
import WeightUnitBottomSheet from './components/WeightUnitBottomSheet'
import styles from './index.styled'

const TILE_ICON_SIZE = 17
const AVATAR_CAMERA_ICON_SIZE = 26

const AccountScreen = () => {
  const navigation = useNavigation<NavigationProp<HomeTabsParamList>>()

  const targetWorkouts = useUserData(state => state.targetWorkouts)
  const targetCalories = useUserData(state => state.targetCalories)
  const stepGoal = useUserData(state => state.stepGoal)
  const goalWeight = useUserData(state => state.goalWeight)
  const weightUnitLabel = useWeightUnitLabel()

  const userEmail = useAuthStore(state => state.userEmail)
  const isAuthed = useAuthStore(state => state.isAuthed)
  const {data: summariesData} = useWorkoutSummariesInfiniteQuery()
  const {data: weighIns = []} = useWeighInsQuery()
  const {data: totalRuns = 0} = useRunsTotalQuery()
  const {data: avatarBase64} = useUserAvatarQuery(isAuthed)
  const targetsQuery = useNutritionTargetsQuery()
  const isUploadingAvatar = useIsMutating({mutationKey: mutationKeys.updateAvatar}) > 0

  const totalSummaries = summariesData?.pages[0]?.pagination.total ?? 0

  const initials = userEmail?.slice(0, 2).toUpperCase() ?? GUEST_AVATAR_INITIAL

  const targetAuthority = resolveTargetAuthority({read: targetsQuery, isAuthed})
  const displayedTargetCalories = targetAuthority.serverCalories ?? targetCalories

  const openTargetsEditor = () => {
    navigation.navigate('MacrosStack', {
      screen: Screens.MEAL_PLAN_EDIT_TARGETS,
      params: {mode: 'edit', returnTo: {kind: 'tab', tab: Screens.ACCOUNT}}
    })
  }

  const openAppStoreReview = async () => {
    const supported = await Linking.canOpenURL(urls.iosStoreReview)

    if (supported) {
      await Linking.openURL(urls.iosStoreReview)
    }
  }

  const openPrivacyPolicy = async () => {
    const supported = await Linking.canOpenURL(urls.privacyPolicy)

    if (supported) {
      await Linking.openURL(urls.privacyPolicy)
    }
  }

  const avatarContent = () => {
    if (isUploadingAvatar) return <ActivityIndicator color={Theme.colors.white} />

    if (avatarBase64) {
      return <Image source={{uri: `data:image/jpeg;base64,${avatarBase64}`}} style={styles.avatarImage} />
    }

    if (isAuthed) return <CameraIcon color={Theme.colors.white} size={AVATAR_CAMERA_ICON_SIZE} />

    return <Text style={styles.avatarInitials}>{initials}</Text>
  }

  const header = () => (
    <View style={styles.headerRow}>
      <TouchableOpacity
        activeOpacity={Opacity.PRESSED_SUBTLE}
        disabled={!isAuthed || isUploadingAvatar}
        onPress={() => openGlobalBottomSheet(<ProfilePhotoBottomSheet />)}>
        <LinearGradient
          colors={[Theme.colors.lime, Theme.colors.teal]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.avatar}>
          {avatarContent()}
        </LinearGradient>
      </TouchableOpacity>

      <View>
        <Text style={styles.greeting}>{ACCOUNT_WELCOME_TEXT}</Text>

        <Text style={styles.email}>{isAuthed ? userEmail : ACCOUNT_LOGGED_IN_AS_GUEST}</Text>
      </View>
    </View>
  )

  const targetsSection = () => (
    <>
      <Text style={styles.sectionHeader}>{ACCOUNT_TARGETS_SECTION_TITLE}</Text>

      <View style={styles.groupCard}>
        <AccountListItem
          // AccountListItem owns its modal's visibility and AAP 0.8.2 freezes it, so an authority change
          // remounts the row to close a legacy modal the device no longer owns the target for
          key={targetAuthorityKey(targetAuthority)}
          type="target-calories"
          label={ACCOUNT_DAILY_CALORIES_LABEL}
          value={displayedTargetCalories.toLocaleString()}
          tileVariant="danger"
          icon={<FlameIcon color={Theme.colors.danger} size={TILE_ICON_SIZE} />}
          // Overridden only for the canonical editor. Leaving it undefined is what keeps the row's shipped
          // behaviour intact for every other authority: the frozen `AccountListItem` then opens the legacy
          // `TargetCaloriesModal` it renders itself, which is the `otherwise` of AAP 0.1.4 and exactly what this
          // row did before the planner existed. The row stays `clickable` in both cases, so it always shows its
          // chevron and always responds to a press.
          onPressOverride={targetAuthority.editor === 'canonical' ? openTargetsEditor : undefined}
        />

        <AccountListItem
          type="target-workouts"
          label={ACCOUNT_WORKOUTS_PER_WEEK_LABEL}
          value={targetWorkouts.toString()}
          tileVariant="green"
          icon={<BarbellIcon color={Theme.colors.accentGreen} size={TILE_ICON_SIZE} />}
        />

        <AccountListItem
          type="step-goal"
          label={ACCOUNT_DAILY_STEPS_LABEL}
          value={stepGoal.toLocaleString()}
          tileVariant="teal"
          icon={<StepsIcon color={Theme.colors.teal} size={TILE_ICON_SIZE} />}
        />

        <AccountListItem
          type="goal-weight"
          label={ACCOUNT_GOAL_WEIGHT_LABEL}
          value={goalWeight !== null ? `${goalWeight} ${weightUnitLabel}` : PROGRESS_BODY_SET_GOAL_LABEL}
          tileVariant="teal"
          isLastInGroup={true}
          icon={<ScaleIcon color={Theme.colors.teal} size={TILE_ICON_SIZE} />}
        />
      </View>
    </>
  )

  const settingsSection = () => (
    <>
      <Text style={styles.sectionHeader}>{ACCOUNT_SETTINGS_SECTION_TITLE}</Text>

      <View style={styles.groupCard}>
        <AccountListItem
          type="info"
          label={ACCOUNT_WEIGHT_UNIT_LABEL}
          value={weightUnitLabel}
          icon={<ScaleIcon color={Theme.colors.textSecondary} size={TILE_ICON_SIZE} />}
          onPressOverride={() => openGlobalBottomSheet(<WeightUnitBottomSheet />)}
        />

        <AccountListItem
          type="info"
          label={ACCOUNT_RATE_APP_LABEL}
          isLastInGroup={true}
          icon={<StarIcon color={Theme.colors.textSecondary} size={TILE_ICON_SIZE} />}
          onPressOverride={openAppStoreReview}
        />
      </View>
    </>
  )

  const statsSection = () => (
    <>
      <Text style={styles.sectionHeader}>{ACCOUNT_STATS_SECTION_TITLE}</Text>

      <View style={styles.groupCard}>
        <AccountListItem
          type="info"
          clickable={false}
          label={ACCOUNT_TOTAL_WEIGH_INS_LABEL}
          value={weighIns.length.toString()}
          icon={<ScaleIcon color={Theme.colors.textSecondary} size={TILE_ICON_SIZE} />}
        />

        <AccountListItem
          type="info"
          clickable={false}
          label={ACCOUNT_TOTAL_RUNS_LABEL}
          value={totalRuns.toString()}
          icon={<RunIcon color={Theme.colors.textSecondary} size={TILE_ICON_SIZE} />}
        />

        <AccountListItem
          type="info"
          clickable={false}
          label={ACCOUNT_TOTAL_WORKOUT_DAYS_LABEL}
          value={totalSummaries.toString()}
          isLastInGroup={true}
          icon={<DumbbellIcon color={Theme.colors.textSecondary} size={TILE_ICON_SIZE} />}
        />
      </View>
    </>
  )

  const authSection = () => (
    <>
      <Text style={styles.sectionHeader}>{ACCOUNT_AUTH_SECTION_TITLE}</Text>

      <View style={styles.groupCard}>
        <AuthListItem />

        <AccountListItem
          type="info"
          label={ACCOUNT_PRIVACY_POLICY}
          isLastInGroup={!isAuthed}
          icon={<DocumentIcon color={Theme.colors.textSecondary} size={TILE_ICON_SIZE} />}
          onPressOverride={openPrivacyPolicy}
        />

        {isAuthed && <DeleteAccountListItem />}
      </View>
    </>
  )

  return (
    <SafeAreaView edges={['top']}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps={true}>
        {header()}

        {targetsSection()}

        {statsSection()}

        {settingsSection()}

        {authSection()}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

export default AccountScreen
