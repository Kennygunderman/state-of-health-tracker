import React, { useEffect, useState } from 'react';
import { isNil } from 'lodash';
import {
    Dimensions, ScrollView, TouchableOpacity, View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useDispatch } from 'react-redux';
import Chip from '../components/Chip';
import Picker, { PickerItem } from '../components/Picker';
import PrimaryButton from '../components/PrimaryButton';
import { showToast } from '../components/toast/util/ShowToast';
import FontSize from '../constants/FontSize';
import Spacing from '../constants/Spacing';
import {
    ADD_FOOD_BUTTON_TEXT,
    CALORIES_LABEL,
    CARBS_LABEL,
    FAT_LABEL, FRACTION_LABEL,
    G_CARBS_LABEL,
    G_FAT_LABEL,
    G_PROTEIN_LABEL, INGREDIENTS_LABEL, PER_SERVINGS_LABEL,
    PROTEIN_LABEL,
    SELECT_A_FRACTION_PLACEHOLDER_TEXT,
    SERVINGS_LABEL, SERVINGS_TEXT,
    TOAST_MEAL_UPDATED,
    UPDATE_SERVINGS_BUTTON_TEXT,
} from '../constants/Strings';
import { useThunkDispatch } from '../store';
import { addFood } from '../store/food/FoodActions';
import FoodItem, { convertFoodItemToLocal } from '../store/food/models/FoodItem';
import { updateMealFood, updateMealFoodItemServings } from '../store/meals/MealsActions';
import { Text, useStyleTheme } from '../styles/Theme';

export interface FoodDetailRouteParams {
    path: 'update' | 'add';
    mealId: string;
    mealName: string;
    foodItem: FoodItem;
}

const FoodDetailScreen = ({ navigation, route }: any) => {
    const {
        path,
        mealId,
        mealName,
        foodItem,
    }: FoodDetailRouteParams = route.params;

    const radius = 30;
    const circumference = radius * 2 * Math.PI;
    const maxPickerWidth = Dimensions.get('window').width - (Spacing.LARGE * 2);

    const servingItems: PickerItem[] = [{ label: '0', value: 0 }];
    for (let i = 0; i < 50; i++) {
        const val = i + 1;
        servingItems.push({ label: `${val}`, value: val });
    }

    const fractionItems: PickerItem[] = [
        { label: 'none', value: 0 },
        { label: '1/8', value: 0.125 },
        { label: '1/4', value: 0.25 },
        { label: '3/8', value: 0.375 },
        { label: '1/2', value: 0.5 },
        { label: '5/8', value: 0.625 },
        { label: '3/4', value: 0.75 },
        { label: '7/8', value: 0.875 },
    ];

    const [servingsNumber, setServingsNumber] = useState(Math.floor(foodItem?.servings ?? 0));
    const [servingsFraction, setServingsFraction] = useState((foodItem?.servings ?? 0) - servingsNumber);

    const selectedSliceWidth = 15;
    const deselectedSliceWidth = 10;

    const proteinCals = (foodItem?.macros.protein ?? 0) * 4;
    const carbCals = (foodItem?.macros.carbs ?? 0) * 4;
    const fatCals = (foodItem?.macros.fat ?? 0) * 9;

    const totalCalories = proteinCals + carbCals + fatCals;

    const proteinAngle = (proteinCals / totalCalories) * 360;
    const carbsAngle = (carbCals / totalCalories) * 360;
    const fatAngle = proteinAngle + carbsAngle;

    const [proteinWidth, setProteinWidth] = useState(10);
    const [carbWidth, setCarbWidth] = useState(10);
    const [fatWidth, setFatWidth] = useState(10);
    const [selectedSlice, setSelectedSlice] = useState<'protein' | 'carbs' | 'fat' | 'none'>('none');
    const [percentageText, setPercentageText] = useState('');

    const dispatch = useThunkDispatch();

    useEffect(() => {
        switch (selectedSlice) {
            case 'protein':
                setPercentageText(`${Math.round((proteinCals / totalCalories) * 100)}%`);
                break;
            case 'carbs':
                setPercentageText(`${Math.round((carbCals / totalCalories) * 100)}%`);
                break;
            case 'fat':
                setPercentageText(`${Math.round((fatCals / totalCalories) * 100)}%`);
                break;
            case 'none':
            default:
                setPercentageText('');
        }
    }, [selectedSlice]);

    const updateServings = () => {
        if (isNil(foodItem)) {
            return;
        }

        const servings = servingsNumber + servingsFraction;
        dispatch(updateMealFoodItemServings(mealId, foodItem.id, servings));
        showToast('success', `${mealName} ${TOAST_MEAL_UPDATED}`, `${foodItem.name}, ${SERVINGS_TEXT} ${servings}`);

        navigation.goBack();
    };

    const addFoodToMeal = () => {
        if (isNil(foodItem)) {
            return;
        }

        const servingsToAdd = servingsNumber + servingsFraction;
        if (foodItem.source === 'remote') {
            const localFoodItem = convertFoodItemToLocal({ ...foodItem, servings: servingsToAdd });
            dispatch(updateMealFood(mealId, localFoodItem));
            dispatch(addFood({ ...localFoodItem, servings: 1 }));
        } else {
            dispatch(updateMealFood(mealId, { ...foodItem, servings: servingsToAdd }));
        }

        showToast('success', `${mealName} ${TOAST_MEAL_UPDATED}`);

        navigation.pop(2);
    };

    const handlePrimaryPressed = () => {
        if (path === 'add') {
            addFoodToMeal();
        } else {
            updateServings();
        }
    };

    const circleSliceLength = (macro: number) => {
        const percentage = (macro / totalCalories) * 100;
        return circumference - (circumference * percentage) / 100;
    };

    const circle = (offset: number, rotation: number, color: string, width: number = 10) => (
        <Svg style={{ position: 'absolute' }} viewBox="6 0 100 100">
            <Circle
                cx="50%"
                cy="50%"
                r={radius}
                rotation={rotation}
                originX="50"
                originY="50"
                stroke={color}
                strokeWidth={width}
                fill="transparent"
                strokeLinecap="butt"
                strokeDashoffset={offset}
                strokeDasharray={`${circumference} ${circumference}`}
            />
        </Svg>
    );

    const chartKey = () => {
        const dot = (color: string = 'red') => (
            <View style={{
                width: 12,
                height: 12,
                borderRadius: 12,
                backgroundColor: color,
            }}
            />
        );

        const label = (text: string) => (
            <Text style={{
                marginLeft: Spacing.XX_SMALL,
                marginRight: Spacing.SMALL,
                fontWeight: 'bold',
            }}
            >
                {text}
            </Text>
        );

        const keyItem = (color: string, text: string) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.X_LARGE }}>
                {dot(color)}
                {label(text)}
            </View>
        );

        return (
            <View style={{ flexDirection: 'row', marginLeft: Spacing.LARGE }}>
                {keyItem(useStyleTheme().colors.secondaryLighter, PROTEIN_LABEL)}
                {keyItem(useStyleTheme().colors.white, CARBS_LABEL)}
                {keyItem(useStyleTheme().colors.accentColor, FAT_LABEL)}
            </View>
        );
    };

    return (
        <ScrollView>
            <Text style={{
                marginTop: Spacing.MEDIUM,
                marginLeft: Spacing.X_LARGE,
                marginRight: Spacing.X_LARGE,
                fontWeight: 'bold',
                fontSize: FontSize.H1,
            }}
            >
                {foodItem?.name ?? ''}
            </Text>
            { foodItem?.description
                && (
                    <Text style={{
                        marginTop: Spacing.X_SMALL,
                        marginBottom: Spacing.X_SMALL,
                        marginLeft: Spacing.X_LARGE,
                        fontWeight: '300',
                        fontSize: FontSize.PARAGRAPH,
                    }}
                    >
                        {`${foodItem.description}`}
                    </Text>
                )}
            <Text style={{
                marginTop: Spacing.XX_SMALL,
                marginLeft: Spacing.X_LARGE,
                fontWeight: '300',
                fontSize: FontSize.H2,
            }}
            >
                {`${foodItem?.calories ?? 0} ${CALORIES_LABEL} ${PER_SERVINGS_LABEL}`}
            </Text>
            <View>
                <View style={{ width: 240, height: 240 }}>
                    <View style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        right: 0,
                        left: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: Spacing.LARGE,
                    }}
                    >
                        <Text style={{
                            fontSize: FontSize.H1,
                            fontWeight: '900',
                        }}
                        >
                            {percentageText}
                        </Text>
                    </View>
                    {circle(0, 0, useStyleTheme().colors.border)}
                    {circle(circleSliceLength(proteinCals), 0, useStyleTheme().colors.secondaryLighter, proteinWidth)}
                    {circle(circleSliceLength(carbCals), proteinAngle, useStyleTheme().colors.white, carbWidth)}
                    {circle(circleSliceLength(fatCals), fatAngle, useStyleTheme().colors.accentColor, fatWidth)}
                </View>
                <View style={{
                    marginTop: 48,
                    right: 0,
                    width: 220,
                    padding: Spacing.SMALL,
                    position: 'absolute',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                }}
                >
                    <TouchableOpacity
                        activeOpacity={0.5}
                        onPress={() => {
                            const width = proteinWidth === deselectedSliceWidth ? selectedSliceWidth : deselectedSliceWidth;
                            setProteinWidth(width);
                            setSelectedSlice(width === selectedSliceWidth ? 'protein' : 'none');
                            setCarbWidth(deselectedSliceWidth);
                            setFatWidth(deselectedSliceWidth);
                        }}
                    >
                        <Chip
                            style={{
                                paddingRight: Spacing.SMALL,
                                paddingLeft: Spacing.SMALL,
                                marginRight: Spacing.X_SMALL,
                                marginTop: Spacing.SMALL,
                            }}
                            label={`${foodItem?.macros.protein ?? 0} ${G_PROTEIN_LABEL}`}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.5}
                        onPress={() => {
                            const width = carbWidth === deselectedSliceWidth ? selectedSliceWidth : deselectedSliceWidth;
                            setCarbWidth(width);
                            setSelectedSlice(width === selectedSliceWidth ? 'carbs' : 'none');
                            setProteinWidth(deselectedSliceWidth);
                            setFatWidth(deselectedSliceWidth);
                        }}
                    >
                        <Chip
                            style={{
                                paddingRight: Spacing.SMALL,
                                paddingLeft: Spacing.SMALL,
                                marginRight: Spacing.X_SMALL,
                                marginTop: Spacing.SMALL,
                            }}
                            label={`${foodItem?.macros.carbs ?? 0} ${G_CARBS_LABEL}`}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.5}
                        onPress={() => {
                            const width = fatWidth === deselectedSliceWidth ? selectedSliceWidth : deselectedSliceWidth;
                            setFatWidth(width);
                            setSelectedSlice(width === selectedSliceWidth ? 'fat' : 'none');
                            setCarbWidth(deselectedSliceWidth);
                            setProteinWidth(deselectedSliceWidth);
                        }}
                    >
                        <Chip
                            style={{
                                paddingRight: Spacing.SMALL,
                                paddingLeft: Spacing.SMALL,
                                marginRight: Spacing.X_SMALL,
                                marginTop: Spacing.SMALL,
                            }}
                            label={`${foodItem?.macros.fat ?? 0} ${G_FAT_LABEL}`}
                        />
                    </TouchableOpacity>
                </View>
            </View>
            {chartKey()}
            <View style={{ right: 0, marginLeft: Spacing.LARGE, marginRight: Spacing.LARGE }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ width: maxPickerWidth * 0.48 }}>
                        <Text style={{ fontWeight: 'bold', marginBottom: Spacing.X_SMALL }}>{SERVINGS_LABEL}</Text>
                        <Picker
                            placeholder={`${servingsNumber}`}
                            initialValue={servingsNumber}
                            width={maxPickerWidth * 0.48}
                            items={servingItems}
                            onValueSet={(value) => {
                                setServingsNumber(value);
                            }}
                        />
                    </View>
                    <View style={{ width: maxPickerWidth * 0.48 }}>
                        <Text style={{ fontWeight: 'bold', marginBottom: Spacing.X_SMALL }}>{FRACTION_LABEL}</Text>
                        <Picker
                            placeholder={SELECT_A_FRACTION_PLACEHOLDER_TEXT}
                            initialValue={servingsFraction}
                            width={maxPickerWidth * 0.48}
                            items={fractionItems}
                            onValueSet={(value) => {
                                setServingsFraction(value);
                            }}
                        />
                    </View>
                </View>
            </View>
            <PrimaryButton
                style={{
                    marginTop: Spacing.X_LARGE,
                    alignSelf: 'center',
                    width: '90%',
                }}
                label={path === 'add' ? ADD_FOOD_BUTTON_TEXT : UPDATE_SERVINGS_BUTTON_TEXT}
                onPress={handlePrimaryPressed}
            />

            { foodItem?.ingredients
                && (
                    <>
                        <Text style={{
                            zIndex: -1,
                            marginTop: Spacing.MEDIUM,
                            marginHorizontal: Spacing.MEDIUM,
                            fontWeight: 'bold',
                            fontSize: FontSize.PARAGRAPH,
                        }}
                        >
                            {INGREDIENTS_LABEL}
                        </Text>
                        <Text style={{
                            zIndex: -1,
                            marginTop: Spacing.X_SMALL,
                            marginBottom: Spacing.X_LARGE,
                            marginHorizontal: Spacing.MEDIUM,
                            fontWeight: '300',
                            fontSize: FontSize.PARAGRAPH,
                        }}
                        >
                            {`${foodItem.ingredients}`}
                        </Text>
                    </>
                )}
        </ScrollView>
    );
};

export default FoodDetailScreen;
