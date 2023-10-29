import React from 'react';
import { DefaultTheme } from '@react-navigation/native';
import {
    SafeAreaView, Text as DefaultText, TextInput as DefaultTextInput, TextInputProps, TextProps, ViewProps,
} from 'react-native';
import { ColorSchemeName } from 'react-native/Libraries/Utilities/Appearance';
import BorderRadius from '../constants/BorderRadius';
import FontSize from '../constants/FontSize';
import Spacing from '../constants/Spacing';

const primary = '#1B1D2C';
const accent = '#f1505b';
const tertiary = '#2E303E';
const secondary = '#2F3955';
const secondaryLighter = '#5B8DE6';
const white = '#fff';
const grey = 'grey';

type ThemeType = typeof darkTheme;

export const darkTheme = {
    dark: true,
    colors: {
        ...DefaultTheme.colors,
        background: primary,
        accentColor: accent,
        primary,
        tertiary,
        secondary,
        secondaryLighter,
        white,
        grey,
        text: white,
        navBar: '#10111a',
        chip: secondary,
        border: secondary,
        fireOrange: '#FF9502',
        error: '#da2839',
        errorLight: '#fc7784',
        success: '#34b471',
    },
};

export const lightTheme: ThemeType = {
    ...darkTheme, // Light mode theme not yet implemented
};

export function useStyleTheme(colorTheme: string | ColorSchemeName = 'dark'): ThemeType {
    // hooks into user theme
    // useColorScheme()
    return colorTheme === 'dark' ? darkTheme : lightTheme;
}

export const Screen = (props: ViewProps) => {
    const { ...otherProps } = props;
    return (
        <SafeAreaView
            style={{
                marginLeft: Spacing.MEDIUM,
                marginRight: Spacing.MEDIUM,
            }}
            {...otherProps}
        />
    );
};

export const Text = (props: TextProps) => {
    const { style, ...otherProps } = props;
    return (
        <DefaultText
            style={[
                { color: useStyleTheme().colors.text },
                style,
            ]}
            {...otherProps}
        />
    );
};

export const TextInput = (props: TextInputProps) => {
    const {
        style, editable = true, numberOfLines = 1, maxLength = 24, ...otherProps
    } = props;
    return (
        <DefaultTextInput
            keyboardAppearance="dark"
            editable={editable}
            numberOfLines={numberOfLines}
            maxLength={maxLength}
            selectionColor={useStyleTheme().colors.white}
            placeholderTextColor={useStyleTheme().colors.tertiary}
            style={[{
                fontSize: FontSize.H3,
                color: useStyleTheme().colors.text,
                padding: Spacing.SMALL,
                borderRadius: BorderRadius.TEXT_INPUT,
                borderWidth: 1,
                borderColor: useStyleTheme().colors.border,
            }, style]}
            {...otherProps}
        />
    );
};
