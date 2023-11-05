import React, { useState } from 'react';
import {
    Dimensions, SectionList, SectionListRenderItem, View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import CreateTemplateForm from './components/CreateTemplateForm';
import ExerciseTypeChip from './components/ExerciseTypeChip';
import ConfirmModal from '../../components/dialog/ConfirmModal';
import ListItem from '../../components/ListItem';
import SearchBar from '../../components/SearchBar';
import SecondaryButton from '../../components/SecondaryButton';
import { showToast } from '../../components/toast/util/ShowToast';
import FontSize from '../../constants/FontSize';
import Screens from '../../constants/Screens';
import Spacing from '../../constants/Spacing';
import {
    CREATE_EXERCISE_BUTTON_TEXT,
    CREATE_TEMPLATE_BUTTON_TEXT,
    DELETE_EXERCISE_MODAL_BODY,
    DELETE_EXERCISE_MODAL_TITLE,
    EXERCISES_HEADER,
    NO_EXERCISES_FOUND_EMPTY_TEXT,
    SEARCH_EXERCISES_PLACEHOLDER,
    stringWithParameters,
    TEMPLATES_HEADER,
    TOAST_EXERCISE_ADDED,
    TOAST_EXERCISE_ALREADY_ADDED, TOAST_TEMPLATE_CREATED,
} from '../../constants/Strings';
import {
    getExercisesSelector,
    getExercisesForDaySelector,
    getTemplatesSelector,
} from '../../selectors/ExercisesSelector';
import { addDailyExercise } from '../../store/dailyExerciseEntries/DailyExerciseActions';
import { DailyExercise } from '../../store/dailyExerciseEntries/models/DailyExercise';
import { deleteExercise } from '../../store/exercises/ExercisesActions';
import { Exercise, instanceOfExercise } from '../../store/exercises/models/Exercise';
import {
    WorkoutTemplate,
} from '../../store/exercises/models/WorkoutTemplate';
import LocalStore from '../../store/LocalStore';
import Unique from '../../store/models/Unique';
import { Text, useStyleTheme } from '../../styles/Theme';
import ListSwipeItemManager from '../../utility/ListSwipeItemManager';

interface Section extends Unique {
    title: string;
    data: Exercise[] | WorkoutTemplate[];
}

const AddExerciseScreen = ({ navigation }: any) => {
    const [searchText, setSetSearchText] = useState('');
    const [isConfirmDeleteModalVisible, setIsConfirmDeleteModalVisible] = useState(false);
    const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | undefined>(undefined);

    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

    const exercises = useSelector<LocalStore, Exercise[]>((state: LocalStore) => getExercisesSelector(state, searchText));
    const templates = useSelector<LocalStore, WorkoutTemplate[]>((state: LocalStore) => getTemplatesSelector(state, searchText));
    const dailyExercises = useSelector<LocalStore, DailyExercise[]>((state: LocalStore) => getExercisesForDaySelector(state));
    const currentDate = useSelector<LocalStore, string>((state: LocalStore) => state.userInfo.currentDate);

    const sections: Section[] = [
        {
            id: 'templates',
            title: TEMPLATES_HEADER,
            data: templates,
        },
        {
            id: 'exercises',
            title: EXERCISES_HEADER,
            data: exercises,
        },
    ];

    const dispatch = useDispatch();
    const listSwipeItemManager = new ListSwipeItemManager(sections);

    const onExercisePressed = (exercise: Exercise) => {
        const isAlreadyAdded = dailyExercises.find((dailyExercise) => dailyExercise.exercise.name === exercise.name) !== undefined;

        if (isAlreadyAdded) {
            showToast('error', TOAST_EXERCISE_ALREADY_ADDED, exercise.name);
            return;
        }

        dispatch(addDailyExercise(currentDate, exercise));
        showToast('success', TOAST_EXERCISE_ADDED, exercise.name);

        navigation.goBack();
    };

    const createExerciseButton = () => (
        <SecondaryButton
            style={{ alignSelf: 'flex-end', marginTop: Spacing.MEDIUM, marginBottom: Spacing.MEDIUM }}
            label={CREATE_EXERCISE_BUTTON_TEXT}
            onPress={() => {
                navigation.push(Screens.CREATE_EXERCISE, { exerciseName: searchText });
            }}
        />
    );

    const createTemplateButton = () => (
        <SecondaryButton
            style={{ alignSelf: 'flex-end', marginTop: Spacing.MEDIUM, marginBottom: Spacing.MEDIUM }}
            label={CREATE_TEMPLATE_BUTTON_TEXT}
            onPress={() => {
                setIsCreatingTemplate(true);
            }}
        />
    );

    const renderSearchBar = () => {
        const emptyStateTopMargin = 100;
        const emptyStateContainerHeight = 150;
        const isSearchTextEmpty = searchText !== '';
        const areSearchResultsEmpty = exercises.length === 0 && templates.length === 0;
        return (
            <>
                <View style={{
                    width: '100%',
                    height: Dimensions.get('window').height,
                    backgroundColor: useStyleTheme().colors.secondary,
                    position: 'absolute',
                    bottom: 0,
                    marginBottom: areSearchResultsEmpty ? emptyStateTopMargin + 64 : 0,
                }}
                />
                <SearchBar onSearchTextChanged={setSetSearchText} placeholder={SEARCH_EXERCISES_PLACEHOLDER} />
                {areSearchResultsEmpty
                    && (
                        <View style={{
                            alignSelf: 'center',
                            alignItems: 'center',
                            height: emptyStateContainerHeight,
                        }}
                        >
                            <Text style={{
                                textAlign: 'center',
                                marginTop: emptyStateTopMargin,
                                fontSize: FontSize.H2,
                                fontWeight: 'bold',
                            }}
                            >
                                {NO_EXERCISES_FOUND_EMPTY_TEXT}
                            </Text>
                            {isSearchTextEmpty && <Text>{`'${searchText}'`}</Text>}
                            {createExerciseButton()}
                        </View>
                    )}
            </>
        );
    };

    const renderCreateSection = (text: string, button?: JSX.Element) => (
        <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginLeft: Spacing.MEDIUM,
            marginRight: Spacing.MEDIUM,
        }}
        >
            <Text style={{
                marginLeft: Spacing.X_SMALL,
                fontSize: FontSize.H1,
                fontWeight: 'bold',
            }}
            >
                {text}
            </Text>
            {button}
        </View>
    );

    const renderSectionItemHeader = (section: Section) => {
        if (section.data.length === 0) {
            return <View />;
        }

        if (section.title === EXERCISES_HEADER) {
            return renderCreateSection(section.title, createExerciseButton());
        }

        return renderCreateSection(section.title, createTemplateButton());
    };

    const renderItem: SectionListRenderItem<Exercise | WorkoutTemplate, Section> = ({ item, section, index }) => {
        const isExercise = instanceOfExercise(item);

        const title: string = item.name;
        const subtitle: string = isExercise ? item.exerciseBodyPart : item.tagline;
        const chip: JSX.Element | undefined = isExercise ? <ExerciseTypeChip exerciseType={item.exerciseType} /> : undefined;
        const onDeletePressed: () => void = isExercise
            ? () => {
                listSwipeItemManager.closeRow(section, index + 1);
                setExerciseToDelete(item);
                setIsConfirmDeleteModalVisible(true);
            } : () => {

            };
        const onPress: () => void = isExercise ? () => onExercisePressed(item) : () => {};

        return (
            <ListItem
                leftRightMargin={Spacing.MEDIUM}
                swipeableRef={(ref) => {
                    listSwipeItemManager.setRef(ref, section, index);
                }}
                onSwipeActivated={() => {
                    listSwipeItemManager.closeRow(section, index);
                }}
                title={title}
                subtitle={subtitle}
                chip={chip}
                onDeletePressed={onDeletePressed}
                onPress={onPress}
            />
        );
    };

    if (isCreatingTemplate) {
        return (
            <CreateTemplateForm
                searchBar={renderSearchBar()}
                exercises={exercises}
                onCanceled={() => {
                    setIsCreatingTemplate(false);
                }}
                onTemplateCreated={(name: string) => {
                    setIsCreatingTemplate(false);
                    showToast('success', TOAST_TEMPLATE_CREATED, name);
                }}
            />
        );
    }

    return (
        <>
            <ConfirmModal
                confirmationTitle={DELETE_EXERCISE_MODAL_TITLE}
                confirmationBody={stringWithParameters(DELETE_EXERCISE_MODAL_BODY, exerciseToDelete?.name ?? '')}
                isVisible={isConfirmDeleteModalVisible}
                onConfirmPressed={() => {
                    if (exerciseToDelete) {
                        dispatch(deleteExercise(exerciseToDelete));
                    }
                    setIsConfirmDeleteModalVisible(false);
                }}
                onCancel={() => {
                    setIsConfirmDeleteModalVisible(false);
                }}
            />
            <SectionList
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                initialNumToRender={10}
                sections={sections}
                stickySectionHeadersEnabled={false}
                ListHeaderComponent={renderSearchBar()}
                ListFooterComponent={<View style={{ marginBottom: Spacing.X_LARGE }} />}
                renderSectionHeader={({ section }) => renderSectionItemHeader(section)}
                renderItem={renderItem}
            />
        </>
    );
};

export default AddExerciseScreen;
