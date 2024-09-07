import React from 'react';
import { View, ViewStyle } from 'react-native';
import Chip from './Chip';
import Spacing from '../constants/Spacing';
import {
    CAL_LABEL, G_CARBS_LABEL, G_FAT_LABEL, G_PROTEIN_LABEL,
} from '../constants/Strings';
import { Macros } from '../store/food/models/FoodItem';

interface Props {
    readonly calories: number;
    readonly macros: Macros;
    readonly style?: ViewStyle;
}
const MacroChips = (props: Props) => {
    const { calories, macros, style } = props;

    const chipStyle = {
        paddingHorizontal: Spacing.X_SMALL,
        marginRight: Spacing.XX_SMALL,
        marginTop: Spacing.SMALL,
    };

    return (
        <View style={[{ flexDirection: 'row', flexWrap: 'wrap' }, style]}>
            <Chip
                style={chipStyle}
                label={`${Math.round(macros.protein)}${G_PROTEIN_LABEL}`}
            />

            <Chip
                style={chipStyle}
                label={`${Math.round(macros.carbs)}${G_CARBS_LABEL}`}
            />
            <Chip
                style={chipStyle}
                label={`${Math.round(macros.fat)}${G_FAT_LABEL}`}
            />

            <Chip
                style={chipStyle}
                label={`${Math.round(calories)} ${CAL_LABEL}`}
            />
        </View>
    );
};

export default MacroChips;
