import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import BaseInputModalProps from '../../../components/dialog/BaseInputModalProps';
import InputModal from '../../../components/dialog/InputModal';
import {
    TEMPLATE_MODAL_BUTTON_TEXT, TEMPLATE_MODAL_ERROR_TEXT,
    TEMPLATE_MODAL_PLACEHOLDER,
    TEMPLATE_MODAL_TITLE,
} from '../../../constants/Strings';
import { addWorkoutTemplate } from '../../../store/exercises/ExercisesActions';
import { Exercise } from '../../../store/exercises/models/Exercise';
import { createWorkoutTemplate } from '../../../store/exercises/models/WorkoutTemplate';

interface Props extends BaseInputModalProps {
    onTemplateCreated: (name: string) => void;
    exercises: Exercise[];
}

const CreateTemplateModal = (props: Props) => {
    const { onTemplateCreated, exercises } = props;
    const { isVisible, onDismissed } = props;

    const [name, setName] = useState('');
    const [showError, setShowError] = useState(false);

    const dispatch = useDispatch();

    const templateTagline = exercises.map((e) => e.name).join(', ');
    const exerciseIds = exercises.map((e) => e.id);

    const createTemplate = () => {
        if (name.length === 0) {
            setShowError(true);
            return;
        }

        const template = createWorkoutTemplate(
            name,
            templateTagline,
            exerciseIds,
        );

        dispatch(addWorkoutTemplate(template));
        onTemplateCreated(name);
    };

    return (
        <InputModal
            placeholder={TEMPLATE_MODAL_PLACEHOLDER}
            title={TEMPLATE_MODAL_TITLE}
            subtitle={templateTagline}
            value={name}
            isVisible={isVisible}
            onCancel={() => {
                setShowError(false);
                onDismissed();
            }}
            buttonText={TEMPLATE_MODAL_BUTTON_TEXT}
            onChangeText={(text) => {
                setShowError(false);
                setName(text);
            }}
            showError={showError}
            errorMessage={TEMPLATE_MODAL_ERROR_TEXT}
            keyboardType="number-pad"
            onButtonPressed={() => {
                createTemplate();
            }}
        />
    );
};

export default CreateTemplateModal;
