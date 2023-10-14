import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import ExerciseListItemDropdown from './ExerciseListItemDropdown';
import SectionListHeader from '../../../components/SectionListHeader';
import { ADD_SET_BUTTON_TEXT } from '../../../constants/Strings';
import { addSet } from '../../../store/dailyExerciseEntries/DailyExerciseActions';
import { DailyExercise } from '../../../store/dailyExerciseEntries/models/DailyExercise';

interface Props {
    currentDate: string;
    dailyExercise: DailyExercise;
    dailyExercisesToReorg: DailyExercise[];
}

const ExerciseSectionListHeader = (props: Props) => {
    const { currentDate, dailyExercise, dailyExercisesToReorg } = props;

    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [dropdownTopMargin, setDropdownTopMargin] = useState(0);
    const [dropdownDailyExercise, setDropdownDailyExercise] = useState<DailyExercise>();

    const dispatch = useDispatch();

    const dropdown = () => (
        <ExerciseListItemDropdown
            onDropdownCancel={(isVisible) => {
                setIsDropdownVisible(isVisible);
            }}
            isVisible={isDropdownVisible}
            dropdownTopMargin={dropdownTopMargin}
            dailyExercisesToReorg={dailyExercisesToReorg}
            dailyExerciseToDelete={dropdownDailyExercise}
        />
    );

    return (
        <>
            {dropdown()}
            <SectionListHeader
                key={dailyExercise.id}
                title={dailyExercise.exercise.name}
                onTitlePressed={(topMargin?: number) => {
                    if (topMargin) {
                        setDropdownTopMargin(topMargin);
                    }
                    setDropdownDailyExercise(dailyExercise);
                    setIsDropdownVisible(true);
                }}
                buttonText={ADD_SET_BUTTON_TEXT}
                onButtonPressed={() => {
                    dispatch(addSet(currentDate, dailyExercise.exercise));
                }}
            />
        </>
    );
};

export default ExerciseSectionListHeader;
