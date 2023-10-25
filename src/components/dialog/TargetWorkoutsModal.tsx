import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import BaseInputModalProps from './BaseInputModalProps';
import InputModal from './InputModal';
import {
    TARGET_WORKOUTS_MODAL_BODY,
    TARGET_WORKOUTS_MODAL_BUTTON, TARGET_WORKOUTS_MODAL_ERROR,
    TARGET_WORKOUTS_MODAL_TITLE, TOAST_TARGET_WORKOUTS_SET,
} from '../../constants/Strings';
import LocalStore from '../../store/LocalStore';
import { setTargetWorkouts } from '../../store/userInfo/UserInfoActions';
import { useStyleTheme } from '../../styles/Theme';
import { isNumber } from '../../utility/TextUtility';

const TargetWorkoutsModal = (props: BaseInputModalProps) => {
    const { isVisible, onDismissed } = props;

    const targetWorkoutsPerWeek = useSelector<LocalStore, number>((state: LocalStore) => state.userInfo.targetWorkouts);

    const [value, setValue] = useState(targetWorkoutsPerWeek.toString());
    const [showError, setShowError] = useState(false);

    useEffect(() => {
        setValue(targetWorkoutsPerWeek.toString());
    }, [targetWorkoutsPerWeek]);

    const dispatch = useDispatch();

    const onPrimaryButtonPressed = () => {
        const intVal = parseInt(value, 10);
        if (!isNumber(value) || intVal === 0 || intVal > 7) {
            setShowError(true);
            return;
        }

        onDismissed();
        setShowError(false);

        dispatch(setTargetWorkouts(intVal));
        Toast.show({
            type: 'success',
            text1: TOAST_TARGET_WORKOUTS_SET,
            text2: value,
            visibilityTime: 3_000,
        });
    };

    return (
        <InputModal
            title={TARGET_WORKOUTS_MODAL_TITLE}
            subtitle={TARGET_WORKOUTS_MODAL_BODY}
            icon={(
                <MaterialCommunityIcons
                    style={{ alignSelf: 'center' }}
                    name="weight-lifter"
                    size={96}
                    color={useStyleTheme().colors.secondaryLighter}
                />
            )}
            value={value}
            isVisible={isVisible}
            onCancel={onDismissed}
            buttonText={TARGET_WORKOUTS_MODAL_BUTTON}
            onChangeText={setValue}
            showError={showError}
            errorMessage={TARGET_WORKOUTS_MODAL_ERROR}
            keyboardType="number-pad"
            maxInputLength={1}
            onButtonPressed={onPrimaryButtonPressed}
        />
    );
};

export default TargetWorkoutsModal;
