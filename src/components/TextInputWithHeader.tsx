import React from 'react';
import { KeyboardTypeOptions } from 'react-native';
import FontSize from '../constants/FontSize';
import Spacing from '../constants/Spacing';
import { Text, TextInput, useStyleTheme } from '../styles/Theme';

export interface TextInputProps {
    header: string;
    onChangeText?: (text: string) => void
    placeholder?: string;
    keyboardType?: KeyboardTypeOptions;
    maxLength?: number;
    value?: string;
    showError?: boolean;
    errorMessage?: String;
    secureTextEntry?: boolean;
}

const TextInputWithHeader = (props: TextInputProps) => {
    const {
        header,
        onChangeText,
        placeholder,
        keyboardType = 'default',
        maxLength,
        value,
        errorMessage,
        showError = false,
        secureTextEntry = false,
    } = props;
    return (
        <>
            <Text
                style={{
                    zIndex: -1,
                    alignSelf: 'flex-start',
                    fontSize: FontSize.PARAGRAPH,
                    fontWeight: 'bold',
                    marginTop: Spacing.SMALL,
                    marginBottom: Spacing.SMALL,
                }}
            >
                {header}
            </Text>
            <TextInput
                returnKeyType="done"
                style={{ width: '100%', zIndex: -1 }}
                maxLength={maxLength}
                keyboardType={keyboardType}
                onChangeText={onChangeText}
                placeholder={placeholder}
                value={value}
                secureTextEntry={secureTextEntry}
            />
            {showError
                && (
                    <Text style={{
                        color: useStyleTheme().colors.error,
                        alignSelf: 'flex-start',
                        fontSize: FontSize.PARAGRAPH,
                        fontWeight: '300',
                        marginTop: Spacing.XX_SMALL,
                    }}
                    >
                        {errorMessage}
                    </Text>
                )}
        </>
    );
};

export default TextInputWithHeader;
