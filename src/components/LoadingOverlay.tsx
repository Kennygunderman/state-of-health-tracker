import React from 'react';
import { ActivityIndicator, View, ViewStyle } from 'react-native';
import { useStyleTheme } from '../styles/Theme';

interface Props {
    style?: ViewStyle;
}
const LoadingOverlay = (props: Props) => {
    const { style } = props;

    return (
        <View style={[{
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            opacity: 0.5,
            position: 'absolute',
            justifyContent: 'center',
        }, style]}
        >
            <ActivityIndicator size="large" color={useStyleTheme().colors.secondaryLighter} />
        </View>
    );
};

export default LoadingOverlay;
