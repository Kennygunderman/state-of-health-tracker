import React from 'react';
import {
    StyleProp, TouchableOpacity, View, ViewStyle,
} from 'react-native';
import BorderRadius from '../constants/BorderRadius';
import FontSize from '../constants/FontSize';
import Spacing from '../constants/Spacing';
import { Text, useStyleTheme } from '../styles/Theme';

interface Props {
    label: string;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
    width?: string | number;
}

const PrimaryButton = (props: Props) => {
    const {
        label, onPress, style, width = '100%',
    } = props;

    return (
        <TouchableOpacity style={{ width, zIndex: -1 }} onPress={onPress} activeOpacity={0.5}>
            <View style={[
                {
                    backgroundColor: useStyleTheme().colors.secondary,
                    borderRadius: BorderRadius.BUTTON,
                    borderColor: useStyleTheme().colors.secondaryLighter,
                    padding: Spacing.SMALL,
                    alignItems: 'center',
                },
                style,
            ]}
            >
                {label
                    && (
                        <Text style={{
                            fontWeight: '500',
                            fontSize: FontSize.H2,
                            marginLeft: Spacing.XX_SMALL,
                            marginRight: Spacing.XX_SMALL,
                        }}
                        >
                            {label}
                        </Text>
                    )}
            </View>
        </TouchableOpacity>
    );
};

export default PrimaryButton;
