import React from 'react';
import Chip from '../../../components/Chip';
import Spacing from '../../../constants/Spacing';
import { LBS_LABEL } from '../../../constants/Strings';
import { ExerciseSet } from '../../../store/exercises/models/ExerciseSet';

interface Props {
    set?: ExerciseSet;
}
const BestSetChip = (props: Props) => {
    const { set } = props;

    const label = `${set?.weight ?? 0} ${LBS_LABEL} x ${set?.reps ?? 0}`;

    return (
        <Chip
            label={label}
            style={{
                alignSelf: 'flex-end',
                position: 'absolute',
                marginTop: Spacing.X_SMALL,
                marginBottom: Spacing.X_SMALL,
                paddingLeft: Spacing.X_SMALL,
                marginRight: Spacing.X_SMALL,
                top: 0,
                right: 0,
                bottom: 0,
            }}
        />
    );
};

export default BestSetChip;
