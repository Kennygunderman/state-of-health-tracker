import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import BaseInputModalProps from '../../../components/dialog/BaseInputModalProps';
import InputModal from '../../../components/dialog/InputModal';
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
            placeholder="Ex: Chest Day"
            title="Add Template Name"
            subtitle={templateTagline}
            value={name}
            isVisible={isVisible}
            onCancel={() => {
                setShowError(false);
                onDismissed();
            }}
            buttonText="Create Template"
            onChangeText={(text) => {
                setShowError(false);
                setName(text);
            }}
            showError={showError}
            errorMessage="Please Enter a Template Name"
            keyboardType="number-pad"
            onButtonPressed={() => {
                createTemplate();
            }}
        />
    );
};

export default CreateTemplateModal;
