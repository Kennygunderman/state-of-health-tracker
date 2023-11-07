import React, { useEffect } from 'react';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    Alert, Linking, SafeAreaView, ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import AccountListItem from './components/AccountListItem';
import AuthListItem from './components/AuthListItem';
import DeleteAccountListItem from './components/DeleteAccountListItem';
import HorizontalDivider from '../../components/HorizontalDivider';
import LoadingOverlay from '../../components/LoadingOverlay';
import FontSize from '../../constants/FontSize';
import Spacing from '../../constants/Spacing';
import {
    ACCOUNT_AUTH_SECTION_TITLE,
    ACCOUNT_CURRENT_WEIGHT_LIST_ITEM,
    ACCOUNT_LOGGED_IN_AS,
    ACCOUNT_LOGGED_IN_AS_GUEST,
    ACCOUNT_PRIVACY_POLICY,
    ACCOUNT_STATS_SECTION_TITLE,
    ACCOUNT_TARGET_CALORIES_LIST_ITEM,
    ACCOUNT_TARGET_WORKOUTS_LIST_ITEM,
    ACCOUNT_TARGETS_SECTION_TITLE,
    ACCOUNT_TOTAL_DAYS_MACROS_LIST_ITEM,
    ACCOUNT_TOTAL_DAYS_WORKOUTS_LIST_ITEM,
    ACCOUNT_WELCOME_TEXT,
    LBS_LABEL,
    OKAY_BUTTON_TEXT,
} from '../../constants/Strings';
import { DailyExerciseEntry, getPreviousDailyExerciseEntriesSelector } from '../../selectors/ExercisesSelector';
import { DailyMealEntry, getPreviousDailyMealEntriesSelector } from '../../selectors/MealsSelector';
import { getLastRecordedWeightSelector } from '../../selectors/UserInfoSelector';
import LocalStore from '../../store/LocalStore';
import Account from '../../store/user/models/Account';
import { AuthError } from '../../store/user/models/AuthError';
import AuthStatus from '../../store/user/models/AuthStatus';
import { setAuthStatus } from '../../store/user/UserActions';
import { Text, useStyleTheme } from '../../styles/Theme';
import { formatDayMonthDay, isDateLessThan2SecondsOld } from '../../utility/DateUtility';

const AccountScreen = () => {
    const currentDate = useSelector<LocalStore, string>((state: LocalStore) => state.userInfo.currentDate);
    const targetCalories = useSelector<LocalStore, number>((state: LocalStore) => state.userInfo.targetCalories);
    const targetWorkouts = useSelector<LocalStore, number>((state: LocalStore) => state.userInfo.targetWorkouts);
    const lastWeightEntry = useSelector<LocalStore, string>((state: LocalStore) => getLastRecordedWeightSelector(state));
    const dailyMealEntries = useSelector<LocalStore, DailyMealEntry[]>((state: LocalStore) => getPreviousDailyMealEntriesSelector(state, 10_000));
    const dailyExerciseEntries = useSelector<LocalStore, DailyExerciseEntry[]>((state: LocalStore) => getPreviousDailyExerciseEntriesSelector(state, 10_000));

    const account = useSelector<LocalStore, Account | undefined>((state: LocalStore) => state.user.account);
    const authStatus = useSelector<LocalStore, AuthStatus>((state: LocalStore) => state.user.authStatus);
    const authError = useSelector<LocalStore, AuthError | undefined>((state: LocalStore) => state.user.authError);

    const dispatch = useDispatch();

    useEffect(() => {
        if (authStatus === AuthStatus.SYNCING) {
            dispatch(setAuthStatus(AuthStatus.LOGGED_OUT));
        }
    }, []);

    useEffect(() => {
        if (authError && isDateLessThan2SecondsOld(authError.errorDate)) {
            Alert.alert(
                authError.errorPath,
                authError.errorMessage,
                [
                    {
                        text: OKAY_BUTTON_TEXT,
                    },
                ],
            );
        }
    }, [authError]);

    const iconSize = 24;
    const iconColor = useStyleTheme().colors.white;

    const getWelcomeMessage = () => {
        if (account?.name && account?.name !== '') {
            return ACCOUNT_LOGGED_IN_AS + account.name;
        }

        if (account?.email && account?.email !== '') {
            return ACCOUNT_LOGGED_IN_AS + account.email;
        }

        return ACCOUNT_LOGGED_IN_AS_GUEST;
    };

    const sectionHeader = (title: string) => (
        <Text style={{
            fontSize: FontSize.H2,
            fontWeight: 'bold',
            marginTop: Spacing.X_LARGE,
            marginLeft: Spacing.LARGE,
            marginBottom: Spacing.SMALL,
        }}
        >
            {title}
        </Text>
    );

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
    );

    const statsSection = () => (
        <>
            {sectionHeader(ACCOUNT_STATS_SECTION_TITLE)}
            <HorizontalDivider />
            <AccountListItem
                type="weight"
                text={`${ACCOUNT_CURRENT_WEIGHT_LIST_ITEM} ${lastWeightEntry} ${LBS_LABEL}`}
                icon={<FontAwesome5 name="weight" size={iconSize - 4} style={{ marginTop: 2 }} color={iconColor} />}
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
                text={ACCOUNT_TOTAL_DAYS_WORKOUTS_LIST_ITEM + dailyExerciseEntries.length}
                icon={<Ionicons name="barbell" size={iconSize} color={iconColor} />}
            />
        </>
    );

    const openPrivacyPolicy = async () => {
        const privacyPolicy = 'https://www.thestateofhealth.com/privacy-policy';
        const supported = await Linking.canOpenURL(privacyPolicy);

        if (supported) {
            await Linking.openURL(privacyPolicy);
        }
    };

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
            {authStatus === AuthStatus.LOGGED_IN && <DeleteAccountListItem />}
        </>
    );

    const header = () => (
        // Wrapping in fragment is necessary here to keep styling
        <>
            {}
            <Text style={{
                fontWeight: 'bold',
                backgroundColor: useStyleTheme().colors.background,
                paddingTop: Spacing.MEDIUM,
                paddingLeft: Spacing.LARGE,
                paddingBottom: Spacing.SMALL,
            }}
            >
                {formatDayMonthDay(currentDate)}
            </Text>
        </>
    );

    return (
        <>
            <SafeAreaView>
                <ScrollView
                    style={{ height: '100%' }}
                    stickyHeaderIndices={[0]}
                    keyboardShouldPersistTaps={true}
                >
                    {header()}
                    <Text style={{
                        fontSize: FontSize.H1,
                        fontWeight: 'bold',
                        margin: Spacing.MEDIUM,
                        marginBottom: Spacing.XX_SMALL,
                        marginLeft: Spacing.LARGE,
                    }}
                    >
                        {ACCOUNT_WELCOME_TEXT}
                    </Text>
                    <Text style={{
                        fontWeight: '200',
                        marginLeft: Spacing.LARGE,
                    }}
                    >
                        {getWelcomeMessage()}
                    </Text>
                    {targetsSection()}
                    {statsSection()}
                    {authSection()}
                </ScrollView>
            </SafeAreaView>
            {authStatus === AuthStatus.SYNCING && <LoadingOverlay />}
        </>
    );
};

export default AccountScreen;
