import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import TextInputWithHeader, { TextInputProps } from '../../../components/TextInputWithHeader';
import { useStyleTheme } from '../../../styles/Theme';

const PasswordTextInput = (props: TextInputProps) => {
    const { secureTextEntry } = props;
    const [secureEntry, setSecureEntry] = useState(secureTextEntry);
    return (
        <>
            <TouchableOpacity style={{ zIndex: 100 }} onPress={() => { setSecureEntry(!secureEntry); }}>
                <Ionicons
                    style={{
                        position: 'absolute', top: 0, right: 0, marginTop: 50, marginRight: 12,
                    }}
                    name={secureEntry ? 'eye' : 'eye-off'}
                    size={24}
                    color={useStyleTheme().colors.white}
                />
            </TouchableOpacity>
            <TextInputWithHeader {...props} secureTextEntry={secureEntry} />
        </>
    );
};

export default PasswordTextInput;
