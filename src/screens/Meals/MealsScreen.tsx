import React, {useEffect, useState} from 'react'

import {SafeAreaView, SectionList, SectionListRenderItem, View} from 'react-native'

import Unique from '@data/models/Unique'
import {MaterialCommunityIcons} from '@expo/vector-icons'
import FoodItem from '@store/food/models/FoodItem'
import LocalStore from '@store/LocalStore'
import {addMeal, deleteMealFood} from '@store/meals/MealsActions'
import {createMeal, Meal} from '@store/meals/models/Meal'
import {useSessionStore} from '@store/session/useSessionStore'
import {Text, useStyleTheme} from '@theme/Theme'
import {useSelector} from 'react-redux'

import CalorieChip from '@components/CalorieChip'
import ListItem from '@components/ListItem'
import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import SectionListHeader, {SectionListFooter} from '@components/SectionListHeader'

import FontSize from '@constants/FontSize'
import Screens from '@constants/Screens'
import Spacing from '@constants/Spacing'
import {
  ADD_MEAL_BUTTON_TEXT,
  BREAKFAST_MEAL_NAME,
  DAILY_CALORIE_INTAKE_TITLE,
  DINNER_MEAL_NAME,
  EMPTY_MEAL_SUBTITLE,
  EMPTY_MEAL_TITLE,
  LUNCH_MEAL_NAME,
  SERVINGS_TEXT,
  VIEW_PREVIOUS_ENTRIES_BUTTON_TEXT,
  YOUR_MEALS_HEADER
} from '@constants/Strings'

import AddUpdateMealInputDialog, {MealAction} from './components/AddUpdateMealInputDialog'
import ProgressModulesContainer from './components/ProgressModulesContainer'
import {getMealsForDaySelector} from '../../selectors/MealsSelector'
import {useThunkDispatch} from '../../store'
import {formatDayMonthDay} from '../../utility/DateUtility'
import ListSwipeItemManager from '../../utility/ListSwipeItemManager'

interface Section extends Unique {
  meal: Meal
  data: FoodItem[]
}

const listSwipeItemManager = new ListSwipeItemManager()

const MealsScreen = ({navigation}: any) => {
  const meals = useSelector<LocalStore, Meal[]>((state: LocalStore) => getMealsForDaySelector(state))

  const {sessionStartDate} = useSessionStore()

  const sections: Section[] = meals.map(meal => ({
    id: meal.id,
    meal,
    data: meal.food
  }))

  const [mealInputModalVisible, setMealInputModalVisible] = useState(false)
  const [mealInputModalMealName, setMealInputModalMealName] = useState('')
  const [mealInputModalMealAction, setMealInputModalMealAction] = useState(MealAction.ADD)
  const [mealInputModalMealUpdateId, setMealInputModalMealUpdateId] = useState<string | undefined>(undefined)

  const dispatch = useThunkDispatch()

  listSwipeItemManager.setRows(sections)

  useEffect(() => {
    if (meals.length === 0) {
      const breakfast = createMeal(BREAKFAST_MEAL_NAME, [])
      const lunch = createMeal(LUNCH_MEAL_NAME, [])
      const dinner = createMeal(DINNER_MEAL_NAME, [])

      dispatch(addMeal(breakfast))
      dispatch(addMeal(lunch))
      dispatch(addMeal(dinner))
    }
  }, [sessionStartDate])

  const presentMealNameInputModal = (mealAction: MealAction, mealName: string = '', updateId?: string) => {
    setMealInputModalVisible(true)
    setMealInputModalMealName(mealName)
    setMealInputModalMealAction(mealAction)
    setMealInputModalMealUpdateId(updateId)
  }

  const addFood = (mealName: string, mealId: string) => {
    navigation.push(Screens.ADD_FOOD, {
      mealName,
      mealId
    })
  }

  const onListItemPressed = (meal: Meal, foodItem: FoodItem) => {
    navigation.push(Screens.FOOD_DETAIL_SCREEN, {
      mealName: meal.name,
      mealId: meal.id,
      foodItem
    })
  }

  const renderHeader = () => (
    <>
      <Text
        style={{
          fontWeight: 'bold',
          marginTop: Spacing.MEDIUM,
          marginLeft: Spacing.LARGE,
          marginBottom: Spacing.SMALL
        }}>
        {formatDayMonthDay(sessionStartDate)}
      </Text>

      <Text
        style={{
          fontSize: FontSize.H1,
          fontWeight: 'bold',
          margin: Spacing.MEDIUM,
          marginLeft: Spacing.LARGE
        }}>
        {DAILY_CALORIE_INTAKE_TITLE}
      </Text>

      <ProgressModulesContainer />

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: Spacing.MEDIUM
        }}>
        <Text
          style={{
            marginLeft: Spacing.X_SMALL,
            fontSize: FontSize.H1,
            fontWeight: 'bold'
          }}>
          {YOUR_MEALS_HEADER}
        </Text>

        <SecondaryButton
          style={{alignSelf: 'flex-end'}}
          label={ADD_MEAL_BUTTON_TEXT}
          onPress={() => {
            presentMealNameInputModal(MealAction.ADD)
          }}
        />
      </View>
    </>
  )

  const renderFooter = () => (
    <PrimaryButton
      style={{
        marginTop: Spacing.SMALL,
        marginBottom: Spacing.LARGE,
        marginLeft: Spacing.MEDIUM,
        marginRight: Spacing.MEDIUM
      }}
      label={VIEW_PREVIOUS_ENTRIES_BUTTON_TEXT}
      onPress={() => {
        navigation.push(Screens.PREVIOUS_DAILY_MEAL_ENTRIES)
      }}
    />
  )

  const renderSectionItemHeader = (meal: Meal) => (
    <SectionListHeader
      key={meal.id}
      title={meal.name}
      onTitlePressed={() => {
        setMealInputModalMealName(meal.name)
        setMealInputModalMealUpdateId(meal.id)
        presentMealNameInputModal(MealAction.UPDATE_NAME, meal.name, meal.id)
      }}
      onButtonPressed={() => {
        addFood(meal.name, meal.id)
      }}
    />
  )

  const renderMealEmptyState = () => (
    <SectionListFooter>
      <MaterialCommunityIcons name="pot-steam" size={96} color={useStyleTheme().colors.secondary} />

      <Text style={{fontWeight: 'bold'}}>{EMPTY_MEAL_TITLE}</Text>

      <Text
        style={{
          fontWeight: '200',
          marginTop: Spacing.XX_SMALL
        }}>
        {EMPTY_MEAL_SUBTITLE}
      </Text>
    </SectionListFooter>
  )

  const renderSectionItemFooter = (meal: Meal) => {
    if (meal.food.length === 0) {
      return renderMealEmptyState()
    }

    return <SectionListFooter />
  }

  const renderItem: SectionListRenderItem<FoodItem, Section> = ({item, section, index}) => (
    <ListItem
      swipeableRef={ref => {
        listSwipeItemManager.setRef(ref, section, index)
      }}
      onSwipeActivated={() => {
        listSwipeItemManager.closeRow(section, index)
      }}
      onDeletePressed={() => {
        dispatch(deleteMealFood(section.meal.id, item.id))
      }}
      onPress={() => {
        onListItemPressed(section.meal, item)
      }}
      deleteIconRightMargin={Spacing.MEDIUM}
      showLeftBorder={true}
      showRightBorder={true}
      title={item.name}
      subtitle={`${SERVINGS_TEXT} ${item.servings.toString()}`}
      chip={<CalorieChip calories={Math.round(item.calories * item.servings)} />}
    />
  )

  return (
    <SafeAreaView>
      <AddUpdateMealInputDialog
        action={mealInputModalMealAction}
        inputMealName={mealInputModalMealName}
        inputMealUpdateId={mealInputModalMealUpdateId}
        visible={mealInputModalVisible}
        onCancel={() => {
          setMealInputModalVisible(!mealInputModalVisible)
        }}
        onChangeText={setMealInputModalMealName}
      />

      <SectionList
        style={{
          width: '100%',
          height: '100%'
        }}
        stickySectionHeadersEnabled={false}
        sections={sections}
        ListHeaderComponent={renderHeader()}
        ListFooterComponent={renderFooter()}
        renderItem={renderItem}
        renderSectionHeader={({section}) => renderSectionItemHeader(section.meal)}
        renderSectionFooter={({section}) => renderSectionItemFooter(section.meal)}
      />
    </SafeAreaView>
  )
}

export default MealsScreen
