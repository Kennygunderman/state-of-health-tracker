import React, { useCallback, useEffect, useState } from 'react';
import _, { debounce } from 'lodash';
import {
    Dimensions,
    FlatList,
    ListRenderItemInfo,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import CalorieChip from '../components/CalorieChip';
import ListItem from '../components/ListItem';
import LoadingOverlay from '../components/LoadingOverlay';
import SearchBar, { SEARCH_BAR_HEIGHT } from '../components/SearchBar';
import SecondaryButton from '../components/SecondaryButton';
import FontSize from '../constants/FontSize';
import Screens from '../constants/Screens';
import Spacing from '../constants/Spacing';
import {
    NEW_FOOD_ITEM_TEXT,
    FOOD_ITEMS_HEADER,
    TOAST_MEAL_UPDATED, SEARCH_FOODS_PLACEHOLDER, NO_FOOD_FOUND_EMPTY_TEXT,
} from '../constants/Strings';
import { getFoodSelector } from '../selectors/FoodsSelector';
import foodSearchService from '../service/food/FoodSearchService';
import { deleteFood } from '../store/food/FoodActions';
import FoodItem, { formatMacros } from '../store/food/models/FoodItem';
import LocalStore from '../store/LocalStore';
import { updateMealFood } from '../store/meals/MealsActions';
import { Text, useStyleTheme } from '../styles/Theme';
import ListSwipeItemManager from '../utility/ListSwipeItemManager';

const AddFoodScreen = ({ navigation, route }: any) => {
    const { mealName, mealId } = route.params;

    const [searchText, setSetSearchText] = useState('');
    const batchIncrement = 15;
    const [loadBatch, setLoadBatch] = useState(1);
    const localFoodItems = useSelector<LocalStore, FoodItem[]>((state: LocalStore) => getFoodSelector(state, loadBatch, searchText));

    const [foodItems, setFoodItems] = useState(localFoodItems);
    const [isLoading, setIsLoading] = useState(false);

    const searchFoodsDebounce = useCallback(debounce((text: string, localItems: FoodItem[], runSearch: boolean) => {
        if (!runSearch) {
            return;
        }

        setIsLoading(true);

        foodSearchService.searchBrandedFoods(text, (foods: FoodItem[]) => {
            setIsLoading(false);
            setFoodItems([...localItems, ...foods]);
        });
    }, 500, { leading: false, trailing: true }), []);

    useEffect(() => {
        if (searchText !== '') {
            searchFoodsDebounce(searchText, localFoodItems, true);
        } else {
            searchFoodsDebounce('', [], false); // cancel the search debounce when no search text is present
            setFoodItems(localFoodItems);
        }
    }, [searchText, localFoodItems]);

    const dispatch = useDispatch();

    const listSwipeItemManager = new ListSwipeItemManager(foodItems);

    const onFoodItemPressed = (foodItem: FoodItem) => {
        if (foodItem.source === 'remote') {
            navigation.navigate(Screens.FOOD_DETAIL_SCREEN, {
                path: 'add',
                mealId,
                mealName,
                foodItem,
            });
        } else {
            dispatch(updateMealFood(mealId, foodItem));
            navigation.goBack();

            Toast.show({
                type: 'success',
                text1: `${mealName} ${TOAST_MEAL_UPDATED}`,
                visibilityTime: 3_000,
            });
        }
    };

    const onNewFoodItemPressed = () => {
        setLoadBatch(batchIncrement);
        navigation.push(Screens.CREATE_FOOD, { foodName: searchText });
    };

    const renderNewFoodItemButton = () => (
        <SecondaryButton
            style={{
                alignSelf: 'flex-end',
                marginTop: Spacing.MEDIUM,
                marginBottom: Spacing.MEDIUM,
                marginRight: Spacing.MEDIUM,
            }}
            label={NEW_FOOD_ITEM_TEXT}
            onPress={onNewFoodItemPressed}
        />
    );

    const renderSearchBar = () => {
        const emptyStateTopMargin = 100;
        const emptyStateContainerHeight = 150;
        const isSearchTextEmpty = searchText !== '';
        const areFoodItemsEmpty = foodItems.length === 0;
        return (
            <>
                <View style={{
                    width: '100%',
                    height: Dimensions.get('window').height,
                    backgroundColor: useStyleTheme().colors.secondary,
                    position: 'absolute',
                    bottom: 0,
                    marginBottom: areFoodItemsEmpty ? emptyStateTopMargin + 64 : 0,
                }}
                />
                <SearchBar onSearchTextChanged={setSetSearchText} placeholder={SEARCH_FOODS_PLACEHOLDER} />
                {areFoodItemsEmpty
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
                                {NO_FOOD_FOUND_EMPTY_TEXT}
                            </Text>
                            {isSearchTextEmpty && <Text>{`'${searchText}'`}</Text>}
                            {renderNewFoodItemButton()}
                        </View>
                    )}
            </>
        );
    };

    const renderFoodItemsHeader = () => (
        <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginLeft: Spacing.MEDIUM,
        }}
        >
            <Text style={{
                marginLeft: Spacing.X_SMALL,
                fontSize: FontSize.H1,
                fontWeight: 'bold',
            }}
            >
                {FOOD_ITEMS_HEADER}
            </Text>
            {renderNewFoodItemButton()}
        </View>
    );

    const renderItem = ({ item, index }: ListRenderItemInfo<FoodItem>) => (
        <>
            {index === 0 && renderFoodItemsHeader()}
            <ListItem
                isSwipeable={item.source === 'local'}
                leftRightMargin={Spacing.MEDIUM}
                swipeableRef={(ref) => listSwipeItemManager.setRef(ref, item, index)}
                onSwipeActivated={() => listSwipeItemManager.closeRow(item, index)}
                title={item.name}
                onPress={() => {
                    onFoodItemPressed(item);
                }}
                subtitle={formatMacros(item.macros)}
                chip={<CalorieChip calories={item.calories} />}
                onDeletePressed={() => {
                    dispatch(deleteFood(item.id));
                }}
            />
        </>
    );

    return (
        <>
            <FlatList
                scrollEnabled={!isLoading}
                initialNumToRender={10}
                stickyHeaderIndices={[0]}
                ListHeaderComponent={renderSearchBar()}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={true}
                style={{ height: '100%' }}
                data={foodItems}
                renderItem={renderItem}
                onEndReached={() => {
                    if (localFoodItems.length > 0) {
                        setLoadBatch(loadBatch + batchIncrement);
                    }
                }}
            />
            { isLoading && <LoadingOverlay style={{ marginTop: SEARCH_BAR_HEIGHT }} /> }
        </>
    );
};

export default AddFoodScreen;
