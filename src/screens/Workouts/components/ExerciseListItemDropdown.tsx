import React, { useEffect, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TouchableOpacity, View } from 'react-native';
import Modal from 'react-native-modal';
import { useDispatch } from 'react-redux';
import ConfirmModal from '../../../components/dialog/ConfirmModal';
import ReorganizeModal from '../../../components/dialog/ReorganizeModal';
import Spacing from '../../../constants/Spacing';
import {
    DELETE_DAILY_EXERCISE_MODAL_BODY,
    DELETE_EXERCISE_MODAL_TITLE, DELETE_EXERCISE_BUTTON_TEXT,
    stringWithParameters, ORGANIZE_EXERCISES_BUTTON_TEXT,
} from '../../../constants/Strings';
import { DailyExercise } from '../../../store/dailyExerciseEntries/models/DailyExercise';
import { Text, useStyleTheme } from '../../../styles/Theme';
import useDailyWorkoutEntryStore from "../../../store/dailyWorkoutEntry/useDailyWorkoutEntryStore";

interface Props {
    readonly isVisible: boolean;
    readonly dropdownTopMargin: number;
    readonly dailyExerciseToDelete?: DailyExercise;
    readonly dailyExercisesToReorg: DailyExercise[];
    readonly onDropdownCancel: (isVisible: boolean) => void;
}

const ExerciseListItemDropdown = (props: Props) => {
    const {
        isVisible, dropdownTopMargin, onDropdownCancel, dailyExerciseToDelete, dailyExercisesToReorg,
    } = props;

    const { deleteDailyExercise, updateDailyExercises } = useDailyWorkoutEntryStore();

    const [isDeleteConfirmationModalVisible, setIsDeleteConfirmationModalVisible] = useState(false);
    const [doDelete, setDoDelete] = useState(false);

    const [isReorgModalVisible, setIsReorgModalVisible] = useState(false);
    const [doReorg, setDoReorg] = useState(false);

    const dispatch = useDispatch();

    const cancel = () => {
        onDropdownCancel?.(false);
        setIsDeleteConfirmationModalVisible(false);
        setDoDelete(false);
        setIsReorgModalVisible(false);
        setDoReorg(false);
    };

    const dropdownDeleteItemPressed = () => {
        setDoDelete(true);
        onDropdownCancel?.(false);
    };

    const dropdownReorgItemPressed = () => {
        onDropdownCancel?.(false);
        setDoReorg(true);
    };

    const confirmDeletePressed = () => {
        if (dailyExerciseToDelete) {
            deleteDailyExercise(dailyExerciseToDelete.id);
        }
        cancel();
    };

    const confirmReorgPressed = (dailyExercises: DailyExercise[]) => {
        updateDailyExercises(dailyExercises);
        cancel();
    };

    useEffect(() => {
        if (isVisible) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [isVisible]);

    const dropdownModal = () => (
        <Modal
            useNativeDriverForBackdrop={true}
            animationIn="pulse"
            backdropOpacity={0.5}
            animationOut="fadeOut"
            animationInTiming={100}
            animationOutTiming={100}
            onModalHide={() => {
                if (doDelete) {
                    setIsDeleteConfirmationModalVisible(true);
                } else if (doReorg) {
                    setIsReorgModalVisible(true);
                }
            }}
            onBackdropPress={cancel}
            isVisible={isVisible}
        >
            <View style={{ flex: 1 }} pointerEvents="box-none">
                <View style={{
                    margin: Spacing.X_SMALL,
                    padding: Spacing.SMALL,
                    width: 200,
                    marginTop: dropdownTopMargin,
                    borderTopLeftRadius: 0,
                    borderRadius: 10,
                    backgroundColor: useStyleTheme().colors.secondary,
                }}
                >
                    <TouchableOpacity
                        style={{
                            alignItems: 'center',
                            flexDirection: 'row',
                        }}
                        onPress={dropdownDeleteItemPressed}
                    >
                        <Ionicons name="trash-bin-outline" size={24} color={useStyleTheme().colors.errorLight} />
                        <Text style={{ fontWeight: 'bold', marginLeft: Spacing.SMALL }}>{DELETE_EXERCISE_BUTTON_TEXT}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{
                            marginTop: Spacing.XX_SMALL,
                            alignItems: 'center',
                            flexDirection: 'row',
                        }}
                        onPress={dropdownReorgItemPressed}
                    >
                        <MaterialCommunityIcons name="gesture-tap-hold" size={24} color={useStyleTheme().colors.white} />
                        <Text style={{ fontWeight: 'bold', marginLeft: Spacing.SMALL }}>{ORGANIZE_EXERCISES_BUTTON_TEXT}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    const reorganizeModal = () => (
        <ReorganizeModal
            getTitleForItem={(item) => item.exercise.name}
            items={dailyExercisesToReorg}
            isVisible={isReorgModalVisible}
            onCancel={cancel}
            onConfirm={(items: DailyExercise[]) => {
                confirmReorgPressed(items);
            }}
        />
    );

    const confirmDeleteModal = () => (
        <ConfirmModal
            confirmationTitle={DELETE_EXERCISE_MODAL_TITLE}
            confirmationBody={stringWithParameters(DELETE_DAILY_EXERCISE_MODAL_BODY, dailyExerciseToDelete?.exercise.name ?? '')}
            isVisible={isDeleteConfirmationModalVisible}
            onConfirmPressed={confirmDeletePressed}
            onCancel={cancel}
        />
    );

    return (
        <>
            {dropdownModal()}
            {confirmDeleteModal()}
            {reorganizeModal()}
        </>
    );
};

export default ExerciseListItemDropdown;
