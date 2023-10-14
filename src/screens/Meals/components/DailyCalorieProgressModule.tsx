import React, { useState } from 'react';
import { Entypo } from '@expo/vector-icons';
import { Dimensions, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSelector } from 'react-redux';
import Chip from '../../../components/Chip';
import TargetCaloriesModal from '../../../components/dialog/TargetCaloriesModal';
import BorderRadius from '../../../constants/BorderRadius';
import Spacing from '../../../constants/Spacing';
import {
    CAL_LABEL_PLURAL,
    G_CARBS_LABEL,
    G_FAT_LABEL,
    G_PROTEIN_LABEL,
    OVER_TARGET_TEXT,
    REMAINING_TEXT,
    TARGET_CALS_LABEL,
} from '../../../constants/Strings';
import { getTotalsForDaySelector, Totals } from '../../../selectors/MealsSelector';
import LocalStore from '../../../store/LocalStore';
import Shadow from '../../../styles/Shadow';
import { Text, useStyleTheme } from '../../../styles/Theme';

const DailyCalorieProgressModule = () => {
    const radius = 30;
    const circumference = radius * 2 * Math.PI;

    const margin = Spacing.MEDIUM;
    const width = Dimensions.get('window').width - margin * 2;

    const totals = useSelector<LocalStore, Totals>((state: LocalStore) => getTotalsForDaySelector(state));
    const targetCalories = useSelector<LocalStore, number>((state: LocalStore) => state.userInfo.targetCalories);

    const [isInputModalVisible, setIsInputModalVisible] = useState(false);

    const circleProgressionColor = () => {
        const caloriesLeft = targetCalories - totals.calories;
        if (caloriesLeft < 0) {
            return useStyleTheme().colors.accentColor;
        }
        return useStyleTheme().colors.success;
    };

    const calorieProgression = () => {
        const percentage = (totals.calories / targetCalories) * 100;
        if (percentage >= 100) {
            return 1;
        }

        return circumference - (circumference * percentage) / 100;
    };

    const showCalorieIntakeModal = () => {
        setIsInputModalVisible(true);
    };

    const calsRemainingLabel = () => {
        let caloriesLeft = Math.round(targetCalories - totals.calories);
        let label = REMAINING_TEXT;

        if (caloriesLeft < 0) {
            caloriesLeft = Math.abs(caloriesLeft);
            label = OVER_TARGET_TEXT;
        }

        return (
            <TouchableOpacity
                onPress={showCalorieIntakeModal}
                activeOpacity={0.74}
                style={{
                    position: 'absolute',
                    alignSelf: 'center',
                    justifyContent: 'center',
                    top: 0,
                    bottom: 0,
                }}
            >
                <Text style={{ fontWeight: 'bold', textAlign: 'center' }}>{`${caloriesLeft} ${CAL_LABEL_PLURAL}`}</Text>
                <Text style={{ fontWeight: '300', textAlign: 'center' }}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <TargetCaloriesModal isVisible={isInputModalVisible} onDismissed={() => setIsInputModalVisible(false)} />
            <View
                style={{
                    ...Shadow.CARD,
                    marginLeft: margin,
                    marginRight: margin,
                    width,
                    height: 230,
                    backgroundColor: useStyleTheme().colors.tertiary,
                    borderRadius: BorderRadius.SECTION,
                    borderWidth: 1,
                    marginBottom: 4,
                    borderColor: useStyleTheme().colors.secondary,
                }}
            >
                <View style={{
                    position: 'absolute',
                    flexDirection: 'column',
                    bottom: Spacing.X_LARGE,
                    top: 24,
                    right: Spacing.X_LARGE,
                    justifyContent: 'center',
                }}
                >
                    <Chip
                        style={{
                            alignSelf: 'flex-end',
                            marginBottom: Spacing.SMALL,
                            padding: Spacing.XX_SMALL,
                            paddingRight: Spacing.SMALL,
                            paddingLeft: Spacing.X_SMALL,
                        }}
                        label={`${Math.round(totals.macros.protein)}${G_PROTEIN_LABEL}`}
                    />
                    <Chip
                        style={{
                            alignSelf: 'flex-end',
                            marginBottom: Spacing.SMALL,
                            padding: Spacing.XX_SMALL,
                            paddingRight: Spacing.SMALL,
                            paddingLeft: Spacing.X_SMALL,
                        }}
                        label={`${Math.round(totals.macros.carbs)}${G_CARBS_LABEL}`}
                    />
                    <Chip
                        style={{
                            alignSelf: 'flex-end',
                            marginBottom: Spacing.SMALL,
                            padding: Spacing.XX_SMALL,
                            paddingRight: Spacing.SMALL,
                            paddingLeft: Spacing.X_SMALL,
                        }}
                        label={`${Math.round(totals.macros.fat)}${G_FAT_LABEL}`}
                    />
                    <TouchableOpacity activeOpacity={0.5} onPress={showCalorieIntakeModal}>
                        <Chip
                            icon={(
                                <Entypo
                                    name="area-graph"
                                    size={16}
                                    color={useStyleTheme().colors.success}
                                    style={{ marginRight: Spacing.X_SMALL }}
                                />
                            )}
                            style={{
                                alignSelf: 'flex-start',
                                padding: Spacing.XX_SMALL,
                                paddingRight: Spacing.SMALL,
                                paddingLeft: Spacing.X_SMALL,
                            }}
                            label={`${TARGET_CALS_LABEL} ${targetCalories}`}
                        />
                    </TouchableOpacity>
                </View>
                <View style={{ width: 220 }}>
                    <Svg style={{ position: 'absolute' }} viewBox="0 0 100 100">
                        <Circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke={useStyleTheme().colors.border}
                            strokeWidth="7"
                            fill="transparent"
                        />
                    </Svg>
                    <Svg viewBox="0 0 100 100">
                        <Circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke={circleProgressionColor()}
                            strokeWidth="8"
                            fill="transparent"
                            strokeLinecap="square"
                            strokeDashoffset={calorieProgression()}
                            strokeDasharray={`${circumference} ${circumference}`}
                        />
                    </Svg>
                    {calsRemainingLabel()}
                </View>
            </View>
        </>
    );
};

export default DailyCalorieProgressModule;
