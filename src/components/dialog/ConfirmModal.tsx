import React from 'react';
import { View } from 'react-native';
import Modal from 'react-native-modal';
import BorderRadius from '../../constants/BorderRadius';
import FontSize from '../../constants/FontSize';
import Spacing from '../../constants/Spacing';
import { CANCEL_BUTTON_TEXT, DELETE_BUTTON_TEXT } from '../../constants/Strings';
import Shadow from '../../styles/Shadow';
import { Text, useStyleTheme } from '../../styles/Theme';
import PrimaryButton from '../PrimaryButton';

interface Props {
    confirmationTitle: string;
    confirmationBody: string;
    confirmButtonText?: string;
    confirmButtonColor?: string;
    isVisible: boolean;
    onConfirmPressed: () => void;
    onCancel: () => void;
}

const ConfirmModal = (props: Props) => {
    const {
        confirmationTitle,
        confirmationBody,
        confirmButtonText = DELETE_BUTTON_TEXT,
        confirmButtonColor = useStyleTheme().colors.error,
        isVisible,
        onConfirmPressed,
        onCancel,
    } = props;

    return (
        <Modal
            useNativeDriverForBackdrop={true}
            animationIn="pulse"
            backdropOpacity={0.5}
            animationOut="fadeOut"
            animationInTiming={300}
            animationOutTiming={100}
            isVisible={isVisible}
            onBackdropPress={() => {
                onCancel();
            }}
        >
            <View style={{ flex: 1, justifyContent: 'center' }} pointerEvents="box-none">
                <View style={{
                    ...Shadow.MODAL,
                    borderRadius: BorderRadius.MODAL,
                    backgroundColor: useStyleTheme().colors.primary,
                    alignSelf: 'center',
                    width: '90%',
                    padding: Spacing.LARGE,
                }}
                >
                    <Text style={{
                        textAlign: 'center',
                        fontSize: FontSize.H2,
                        fontWeight: 'bold',
                    }}
                    >
                        {confirmationTitle}
                    </Text>
                    <Text style={{
                        marginTop: Spacing.MEDIUM,
                        textAlign: 'center',
                    }}
                    >
                        {confirmationBody}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.LARGE }}>
                        <PrimaryButton
                            width="48%"
                            style={{
                                padding: Spacing.X_SMALL,

                            }}
                            label={CANCEL_BUTTON_TEXT}
                            onPress={() => {
                                onCancel();
                            }}
                        />
                        <PrimaryButton
                            width="48%"
                            style={{
                                backgroundColor: confirmButtonColor,
                                padding: Spacing.X_SMALL,

                            }}
                            label={confirmButtonText}
                            onPress={() => {
                                onConfirmPressed();
                            }}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default ConfirmModal;
