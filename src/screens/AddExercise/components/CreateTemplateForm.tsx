import React, { useState } from 'react';
import { FlatList, ListRenderItemInfo } from 'react-native';
import CreateTemplateModal from './CreateTemplateModal';
import ExerciseTypeChip from './ExerciseTypeChip';
import ListItem from '../../../components/ListItem';
import PrimaryButton from '../../../components/PrimaryButton';
import FontSize from '../../../constants/FontSize';
import Spacing from '../../../constants/Spacing';
import { CANCEL_BUTTON_TEXT, NEXT_BUTTON_TEXT, SELECT_EXERCISES_FOR_TEMPLATE_TITLE } from '../../../constants/Strings';
import { Exercise } from '../../../store/exercises/models/Exercise';
import { Text, useStyleTheme } from '../../../styles/Theme';

interface Props {
    searchBar: JSX.Element;
    exercises: Exercise[];
    onCanceled: () => void;
    onTemplateCreated: (name: string) => void;
}
const CreateTemplateForm = (props: Props) => {
    const {
        searchBar, exercises, onTemplateCreated, onCanceled,
    } = props;

    const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const renderItem = ({ item, index }: ListRenderItemInfo<Exercise>) => (
        <>
            {index === 0 && (
                <Text style={{
                    marginLeft: Spacing.LARGE,
                    fontSize: FontSize.H2,
                    marginVertical: Spacing.MEDIUM,
                    fontWeight: 'bold',
                }}
                >
                    {SELECT_EXERCISES_FOR_TEMPLATE_TITLE}
                </Text>
            )}
            <ListItem
                isSwipeable={false}
                leftRightMargin={Spacing.MEDIUM}
                title={item.name}
                backgroundColor={selectedExercises.includes(item) ? useStyleTheme().colors.secondaryLighter : useStyleTheme().colors.primary}
                subtitle={item.exerciseBodyPart}
                chip={<ExerciseTypeChip exerciseType={item.exerciseType} />}
                onPress={() => {
                    if (selectedExercises.includes(item)) {
                        setSelectedExercises([...selectedExercises.filter((e) => e.id !== item.id)]);
                    } else {
                        setSelectedExercises([...selectedExercises, item]);
                    }
                }}
            />
        </>
    );

    return (
        <>
            <CreateTemplateModal
                isVisible={isModalVisible}
                exercises={selectedExercises}
                onDismissed={() => {
                    setIsModalVisible(false);
                }}
                onTemplateCreated={(name: string) => {
                    onTemplateCreated(name);
                }}
            />
            <FlatList
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                initialNumToRender={10}
                data={[...selectedExercises, ...exercises.filter((e) => !selectedExercises.includes(e))]}
                ListHeaderComponent={searchBar}
                ListFooterComponent={(
                    <>
                        <PrimaryButton
                            style={{ margin: Spacing.MEDIUM }}
                            label={NEXT_BUTTON_TEXT}
                            onPress={() => setIsModalVisible(true)}
                        />
                        <PrimaryButton
                            style={{
                                marginHorizontal: Spacing.MEDIUM,
                                backgroundColor: useStyleTheme().colors.background,
                                borderWidth: 1.5,
                                borderColor: useStyleTheme().colors.secondary,
                                marginBottom: Spacing.X_LARGE,
                            }}
                            label={CANCEL_BUTTON_TEXT}
                            onPress={() => onCanceled()}
                        />
                    </>
                )}
                renderItem={renderItem}
            />
        </>
    );
};

export default CreateTemplateForm;
