import React, { useState } from 'react';
import {
    Dimensions, FlatList, ListRenderItemInfo, View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
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
    DELETE_EXERCISE_MODAL_BODY,
    DELETE_EXERCISE_MODAL_TITLE,
    EXERCISES_HEADER, NO_EXERCISES_FOUND_EMPTY_TEXT, SEARCH_EXERCISES_PLACEHOLDER, stringWithParameters,
    TOAST_EXERCISE_ADDED,
    TOAST_EXERCISE_ALREADY_ADDED,
} from '../../constants/Strings';
import { getExercisesSelector, getExercisesForDaySelector } from '../../selectors/ExercisesSelector';
import { addDailyExercise } from '../../store/dailyExerciseEntries/DailyExerciseActions';
import { DailyExercise } from '../../store/dailyExerciseEntries/models/DailyExercise';
import { deleteExercise } from '../../store/exercises/ExercisesActions';
import { Exercise } from '../../store/exercises/models/Exercise';
import LocalStore from '../../store/LocalStore';
import { Text, useStyleTheme } from '../../styles/Theme';
import ListSwipeItemManager from '../../utility/ListSwipeItemManager';

const AddExerciseScreen = ({ navigation }: any) => {
    const [searchText, setSetSearchText] = useState('');
    const [isConfirmDeleteModalVisible, setIsConfirmDeleteModalVisible] = useState(false);
    const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | undefined>(undefined);

    const exercises = useSelector<LocalStore, Exercise[]>((state: LocalStore) => getExercisesSelector(state, searchText));
    const dailyExercises = useSelector<LocalStore, DailyExercise[]>((state: LocalStore) => getExercisesForDaySelector(state));
    const currentDate = useSelector<LocalStore, string>((state: LocalStore) => state.userInfo.currentDate);

    const dispatch = useDispatch();
    const listSwipeItemManager = new ListSwipeItemManager(exercises);

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

    const renderCreateExerciseButton = () => (
        <SecondaryButton
            style={{ alignSelf: 'flex-end', marginTop: Spacing.MEDIUM, marginBottom: Spacing.MEDIUM }}
            label={CREATE_EXERCISE_BUTTON_TEXT}
            onPress={() => {
                navigation.push(Screens.CREATE_EXERCISE, { exerciseName: searchText });
            }}
        />
    );

    const renderSearchBar = () => {
        const emptyStateTopMargin = 100;
        const emptyStateContainerHeight = 150;
        const isSearchTextEmpty = searchText !== '';
        const areExercisesEmpty = exercises.length === 0;
        return (
            <>
                <View style={{
                    width: '100%',
                    height: Dimensions.get('window').height,
                    backgroundColor: useStyleTheme().colors.secondary,
                    position: 'absolute',
                    bottom: 0,
                    marginBottom: areExercisesEmpty ? emptyStateTopMargin + 64 : 0,
                }}
                />
                <SearchBar onSearchTextChanged={setSetSearchText} placeholder={SEARCH_EXERCISES_PLACEHOLDER} />
                { areExercisesEmpty
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
                            {renderCreateExerciseButton()}
                        </View>
                    )}
            </>
        );
    };

    const renderCreateExerciseHeader = () => (
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
                {EXERCISES_HEADER}
            </Text>
            {renderCreateExerciseButton()}
        </View>
    );

    const renderItem = ({ item, index }: ListRenderItemInfo<Exercise>) => (
        <>
            {index === 0 && renderCreateExerciseHeader()}
            <ListItem
                leftRightMargin={Spacing.MEDIUM}
                swipeableRef={(ref) => listSwipeItemManager.setRef(ref, item, index)}
                onSwipeActivated={() => listSwipeItemManager.closeRow(item, index)}
                title={item.name}
                subtitle={item.exerciseBodyPart}
                chip={<ExerciseTypeChip exerciseType={item.exerciseType} />}
                onDeletePressed={() => {
                    listSwipeItemManager.closeRow(item, index + 1);
                    setExerciseToDelete(item);
                    setIsConfirmDeleteModalVisible(true);
                }}
                onPress={() => {
                    onExercisePressed(item);
                }}
            />
        </>
    );

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
            <FlatList
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                initialNumToRender={10}
                ListHeaderComponent={renderSearchBar()}
                data={exercises}
                renderItem={renderItem}
            />
        </>
    );
};

export default AddExerciseScreen;
