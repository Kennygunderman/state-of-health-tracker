import React from 'react';
import Chip from '../../../components/Chip';
import Spacing from '../../../constants/Spacing';
import { LBS_LABEL } from '../../../constants/Strings';
import { ExerciseSet } from '../../../store/exercises/models/ExerciseSet';

interface Props {
    weight?: number;
    reps?: number;
}
const BestSetChip = (props: Props) => {
    const { weight, reps } = props;

    const label = `${weight ?? 0} ${LBS_LABEL} x ${reps ?? 0}`;

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
