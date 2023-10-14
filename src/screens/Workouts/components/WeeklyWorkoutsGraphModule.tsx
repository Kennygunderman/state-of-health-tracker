import React, { useState } from 'react';
import { TextStyle, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';
import BarGraph from '../../../components/BarGraph';
import TargetWorkoutsModal from '../../../components/dialog/TargetWorkoutsModal';
import {
    WEEKLY_WORKOUTS_GRAPH_LABEL1,
    WEEKLY_WORKOUTS_GRAPH_LABEL2,
    WEEKLY_WORKOUTS_GRAPH_TITLE,
} from '../../../constants/Strings';
import { getNumberOfWorkoutsForLast7WeeksSelector } from '../../../selectors/ExercisesSelector';
import LocalStore from '../../../store/LocalStore';
import { useStyleTheme } from '../../../styles/Theme';
import { formatDateToMonthDay, getLast7Mondays } from '../../../utility/DateUtility';

const WeeklyWorkoutsGraphModule = () => {
    const targetWorkoutsPerWeek = useSelector<LocalStore, number>((state: LocalStore) => state.userInfo.targetWorkouts);

    const weekWorkoutsCompletedMap = useSelector<LocalStore, { [date: string]: number }>((state: LocalStore) => getNumberOfWorkoutsForLast7WeeksSelector(state));
    const xAxisLabels = getLast7Mondays().map((date) => formatDateToMonthDay(date));

    const [isInputModalVisible, setIsInputModalVisible] = useState(false);

    const presentTargetWorkoutsModal = () => {
        setIsInputModalVisible(true);
    };

    const getYAxisBarLabels = () => {
        let mostWorkoutsFromWeek = 0;

        Object.keys(weekWorkoutsCompletedMap).forEach((key) => {
            const numWorkouts = weekWorkoutsCompletedMap[key];
            if (numWorkouts > mostWorkoutsFromWeek) {
                mostWorkoutsFromWeek = numWorkouts;
            }
        });

        const labels = [];
        const compare = mostWorkoutsFromWeek > targetWorkoutsPerWeek ? mostWorkoutsFromWeek : targetWorkoutsPerWeek;
        for (let i = 0; i < compare; i++) {
            labels.push(`${i + 1}`);
        }

        return labels.reverse();
    };

    const barStyle = (label: string): ViewStyle => {
        const currentWeek = xAxisLabels[xAxisLabels.length - 1];
        let backgroundColor = useStyleTheme().colors.secondaryLighter;
        let opacity = currentWeek === label ? 1 : 0.5;

        const didHitTarget = weekWorkoutsCompletedMap[label] >= targetWorkoutsPerWeek;
        if (didHitTarget) {
            backgroundColor = useStyleTheme().colors.success;
            opacity = 1;
        }

        return {
            backgroundColor,
            opacity,
        };
    };

    const xAxisLabelStyle = (label: string): TextStyle => ({
        fontWeight: xAxisLabels[xAxisLabels.length - 1] === label ? 'bold' : 'normal',
    });

    return (
        <>
            <TargetWorkoutsModal isVisible={isInputModalVisible} onDismissed={() => setIsInputModalVisible(false)} />
            <BarGraph
                title={WEEKLY_WORKOUTS_GRAPH_TITLE}
                label1={WEEKLY_WORKOUTS_GRAPH_LABEL1 + targetWorkoutsPerWeek}
                label2={WEEKLY_WORKOUTS_GRAPH_LABEL2 + weekWorkoutsCompletedMap[xAxisLabels[xAxisLabels.length - 1]]}
                getNumberOfItemsForLabel={(xAxisLabel) => weekWorkoutsCompletedMap[xAxisLabel]}
                barType="increment"
                xAxisLeftMarginMultiplier={3}
                yAxisLabels={getYAxisBarLabels()}
                getBarStyleForLabel={barStyle}
                xAxisLabels={xAxisLabels}
                getXAxisLabelStyle={xAxisLabelStyle}
                onLabelsPressed={presentTargetWorkoutsModal}
            />
        </>
    );
};

export default WeeklyWorkoutsGraphModule;
