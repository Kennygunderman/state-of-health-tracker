import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useStyleTheme } from '../styles/Theme';

const LoadingOverlay = () => (
    <View style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        opacity: 0.5,
        position: 'absolute',
        justifyContent: 'center',
    }}
    >
        <ActivityIndicator size="large" color={useStyleTheme().colors.secondaryLighter} />
    </View>
);

export default LoadingOverlay;
