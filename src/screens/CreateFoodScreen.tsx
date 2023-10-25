import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Dimensions, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Toast from 'react-native-toast-message';
import { useDispatch } from 'react-redux';
import Picker, { PickerItem } from '../components/Picker';
import PrimaryButton from '../components/PrimaryButton';
import TextInputWithHeader from '../components/TextInputWithHeader';
import { showToast } from '../components/toast/util/ShowToast';
import Spacing from '../constants/Spacing';
import {
    CREATE_FOOD_CALORIES_ERROR_TEXT,
    CREATE_FOOD_CALORIES_HEADER, CREATE_FOOD_CARBS_ERROR_TEXT,
    CREATE_FOOD_CARBS_HEADER, CREATE_FOOD_FAT_ERROR_TEXT,
    CREATE_FOOD_FAT_HEADER,
    CREATE_FOOD_ITEM_BUTTON_TEXT, CREATE_FOOD_NAME_ERROR_TEXT,
    CREATE_FOOD_NAME_HEADER, CREATE_FOOD_PROTEIN_ERROR_TEXT,
    CREATE_FOOD_PROTEIN_HEADER, SERVING_AMOUNT_LABEL, SERVING_TYPE_LABEL, TOAST_FOOD_ITEM_CREATED,
} from '../constants/Strings';
import { addFood } from '../store/food/FoodActions';
import { createFood, createMacros } from '../store/food/models/FoodItem';
import { Screen, Text, useStyleTheme } from '../styles/Theme';
import { isNumber } from '../utility/TextUtility';

const CreateFoodScreen = ({ navigation, route }: any) => {
    const maxFoodNameLength = 30;

    const [foodName, setFoodName] = useState(route.params?.foodName.substring(0, maxFoodNameLength) ?? '');
    const [protein, setProtein] = useState('');
    const [carbs, setCarbs] = useState('');
    const [fat, setFat] = useState('');
    const [calories, setCalories] = useState('');

    const [showFoodNameError, setShowFoodNameError] = useState(false);
    const [showProteinError, setShowProteinError] = useState(false);
    const [showCarbsError, setShowCarbsError] = useState(false);
    const [showFatError, setShowFatError] = useState(false);
    const [showCaloriesError, setShowCaloriesError] = useState(false);

    const maxPickerWidth = Dimensions.get('window').width - (Spacing.MEDIUM * 2);

    const servingTypeItems: PickerItem[] = [
        { label: 'none', value: 'none' },
        { label: 'ounce(s)', value: 'oz' },
        { label: 'gram(s)', value: 'g' },
        { label: 'cup(s)', value: 'cup' },
        { label: 'tbps', value: 'tbps' },
        { label: 'tps', value: 'tps' },
        { label: 'Small', value: 'Small' },
        { label: 'Medium', value: 'Medium' },
        { label: 'Large', value: 'Large' },
    ];

    const servingAmountItems: PickerItem[] = [];
    for (let i = 0; i < 50; i++) {
        const val = i + 1;
        servingAmountItems.push({ label: `${val}`, value: val });
    }

    const servingAmountDefaultValue = 1;
    const servingTypeDefaultValue = 'none';
    const [servingAmount, setServingAmount] = useState(servingAmountDefaultValue);
    const [servingType, setServingType] = useState(servingTypeDefaultValue);

    const dispatch = useDispatch();

    useEffect(() => {
        const proteinInt = protein === '' ? 0 : parseInt(protein, 10);
        const carbsInt = carbs === '' ? 0 : parseInt(carbs, 10);
        const fatInt = fat === '' ? 0 : parseInt(fat, 10);

        // 1g of protein = 4 cal
        // 1g of carbs = 4 cal
        // 1g of fat = 9 cal
        const totalCalories = (proteinInt * 4) + (carbsInt * 4) + (fatInt * 9);
        setCalories(totalCalories.toString());
    }, [protein, fat, carbs]);

    const validate = (): boolean => {
        setShowFoodNameError(foodName === '');
        setShowProteinError(protein === '');
        setShowCarbsError(carbs === '');
        setShowFatError(fat === '');
        setShowCaloriesError(calories === '');
        return !(foodName === '' || protein === '' || carbs === '' || fat === '' || calories === '');
    };

    const onCreateFoodItemPressed = () => {
        if (validate()) {
            const macros = createMacros(protein, carbs, fat);
            let name = foodName;
            if (servingType !== servingTypeDefaultValue) {
                name += ` (${servingAmount} ${servingType})`;
            }
            const food = createFood(name, 1, calories, macros);
            dispatch(addFood(food));
            showToast('success', TOAST_FOOD_ITEM_CREATED, name);

            navigation.goBack();
        }
    };

    return (
        <Screen>
            {/* https://github.com/APSL/react-native-keyboard-aware-scroll-view/issues/463#issuecomment-836936150 */}
            <KeyboardAwareScrollView
                keyboardShouldPersistTaps="always"
                style={{ height: '100%' }}
                showsVerticalScrollIndicator={false}
                extraHeight={Spacing.X_LARGE}
                keyboardDismissMode="interactive"
            >
                <View style={{ alignItems: 'center', paddingTop: Spacing.MEDIUM }}>
                    <MaterialCommunityIcons name="food-variant" size={128} color={useStyleTheme().colors.secondary} />
                    <TextInputWithHeader
                        header={CREATE_FOOD_NAME_HEADER}
                        value={foodName}
                        maxLength={maxFoodNameLength}
                        showError={showFoodNameError}
                        errorMessage={CREATE_FOOD_NAME_ERROR_TEXT}
                        onChangeText={(text) => {
                            if (showFoodNameError) {
                                setShowFoodNameError(false);
                            }
                            setFoodName(text);
                        }}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                        <View style={{ width: maxPickerWidth * 0.33, paddingRight: Spacing.X_SMALL }}>
                            <Text style={{ fontWeight: 'bold', marginTop: Spacing.SMALL, marginBottom: Spacing.SMALL }}>{SERVING_AMOUNT_LABEL}</Text>
                            <Picker
                                disabled={servingType === servingTypeDefaultValue}
                                initialValue={servingAmountDefaultValue}
                                items={servingAmountItems}
                                width={(maxPickerWidth * 0.33) - Spacing.X_SMALL}
                                onValueSet={setServingAmount}
                            />
                        </View>
                        <View style={{ width: maxPickerWidth * 0.66, paddingLeft: Spacing.X_SMALL }}>
                            <Text style={{ fontWeight: 'bold', marginTop: Spacing.SMALL, marginBottom: Spacing.SMALL }}>{SERVING_TYPE_LABEL}</Text>
                            <Picker
                                initialValue={servingTypeDefaultValue}
                                items={servingTypeItems}
                                width={(maxPickerWidth * 0.66) - Spacing.X_SMALL}
                                onValueSet={setServingType}
                            />
                        </View>
                    </View>
                    <TextInputWithHeader
                        header={CREATE_FOOD_PROTEIN_HEADER}
                        keyboardType="numeric"
                        maxLength={4}
                        value={protein}
                        showError={showProteinError}
                        errorMessage={CREATE_FOOD_PROTEIN_ERROR_TEXT}
                        onChangeText={(text) => {
                            if (isNumber(text) || text.length === 0) {
                                if (showProteinError) {
                                    setShowProteinError(false);
                                }

                                setProtein(text);
                            }
                        }}
                    />
                    <TextInputWithHeader
                        header={CREATE_FOOD_CARBS_HEADER}
                        keyboardType="numeric"
                        maxLength={4}
                        value={carbs}
                        showError={showCarbsError}
                        errorMessage={CREATE_FOOD_CARBS_ERROR_TEXT}
                        onChangeText={(text) => {
                            if (isNumber(text) || text.length === 0) {
                                if (showCarbsError) {
                                    setShowCarbsError(false);
                                }

                                setCarbs(text);
                            }
                        }}
                    />
                    <TextInputWithHeader
                        header={CREATE_FOOD_FAT_HEADER}
                        keyboardType="numeric"
                        maxLength={4}
                        value={fat}
                        showError={showFatError}
                        errorMessage={CREATE_FOOD_FAT_ERROR_TEXT}
                        onChangeText={(text) => {
                            if (isNumber(text) || text.length === 0) {
                                if (showFatError) {
                                    setShowFatError(false);
                                }

                                setFat(text);
                            }
                        }}
                    />
                    <TextInputWithHeader
                        header={CREATE_FOOD_CALORIES_HEADER}
                        keyboardType="numeric"
                        maxLength={6}
                        value={calories}
                        showError={showCaloriesError}
                        errorMessage={CREATE_FOOD_CALORIES_ERROR_TEXT}
                        onChangeText={(text) => {
                            if (isNumber(text) || text.length === 0) {
                                if (showCaloriesError) {
                                    setShowCaloriesError(false);
                                }

                                setCalories(text);
                            }
                        }}
                    />

                    <PrimaryButton
                        style={{ marginTop: Spacing.LARGE }}
                        label={CREATE_FOOD_ITEM_BUTTON_TEXT}
                        onPress={onCreateFoodItemPressed}
                    />
                </View>
            </KeyboardAwareScrollView>
        </Screen>
    );
};

export default CreateFoodScreen;
