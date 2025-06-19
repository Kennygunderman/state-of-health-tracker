import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ListRenderItemInfo, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CreateExercisePayload } from '../../data/models/Exercise';
import SearchBar from '../../components/SearchBar';
import ListItem from '../../components/ListItem';
import ExerciseTypeChip from '../../components/ExerciseTypeChip';
import { SEARCH_EXERCISES_PLACEHOLDER } from '../../constants/Strings';
import Spacing from '../../constants/Spacing';
import styles from './index.styled';
import { debounce } from 'lodash';
import exerciseSearchService from '../../service/exercises/ExerciseSearchService';
import { mapExerciseType } from '../../data/converters/ExerciseConverter';
import { useStyleTheme } from '../../styles/Theme';

const LoadBatchSize = 50;


const SearchExercisesScreen = () => {
  const navigation = useNavigation();
  const theme = useStyleTheme();

  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<CreateExercisePayload[]>([]);
  const [batchCount, setBatchCount] = useState(1);

  const debouncedSearch = useCallback(
    debounce((filter: string) => {
      const searchResults = exerciseSearchService.searchExercises(filter, LoadBatchSize * 2);
      setResults(searchResults.slice(0, LoadBatchSize));
      setBatchCount(1);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(searchText);
    return debouncedSearch.cancel;
  }, [searchText, debouncedSearch]);

  const handleLoadMore = () => {
    const nextBatch = batchCount + 1;
    const end = nextBatch * LoadBatchSize;
    const moreResults = exerciseSearchService.searchExercises(searchText, end);
    setResults(moreResults);
    setBatchCount(nextBatch);
  };

  const renderItem = ({ item }: ListRenderItemInfo<CreateExercisePayload>) => (
    <ListItem
      isSwipeable={false}
      leftRightMargin={Spacing.SMALL}
      title={item.name}
      backgroundColor={theme.colors.background}
      subtitle={item.exerciseBodyPart}
      chip={<ExerciseTypeChip exerciseType={mapExerciseType(item.exerciseType)} />}
      onPress={() => {
        // Optional: define behavior when exercise is tapped
      }}
    />
  );

  return (
    <View style={styles.container}>
      <SearchBar
        placeholder={SEARCH_EXERCISES_PLACEHOLDER}
        onSearchTextChanged={setSearchText}
      />
      <FlatList
        style={styles.listContainer}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        data={results}
        renderItem={renderItem}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
      />
    </View>
  );
};

export default SearchExercisesScreen;
