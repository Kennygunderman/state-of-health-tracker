import React, {useState} from 'react'

import {Dimensions, ScrollView, View} from 'react-native'

import {useStyleTheme} from '@theme/Theme'

import Spacing from '@constants/Spacing'

import DailyCalorieProgressModule from './DailyCalorieProgressModule'
import WeeklyCalorieProgressGraphModule from './WeekCalorieProgressGraphModule'

const ProgressModulesContainer = () => {
  const [currentPage, setCurrentPage] = useState(0)

  const screenWidth = Dimensions.get('window').width

  const getIndicator = (pageNumber: number) => {
    let color = useStyleTheme().colors.secondary

    if (pageNumber === currentPage) {
      color = useStyleTheme().colors.secondaryLighter
    }

    return (
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 8,
          backgroundColor: color,
          marginRight: 2.5,
          marginLeft: 2.5
        }}
      />
    )
  }

  return (
    <>
      <ScrollView
        scrollEventThrottle={100}
        pagingEnabled={true}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        onScroll={event => {
          setCurrentPage(Math.round(event.nativeEvent.contentOffset.x / screenWidth))
        }}>
        <DailyCalorieProgressModule />

        <WeeklyCalorieProgressGraphModule />
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignSelf: 'center',
          marginTop: Spacing.SMALL
        }}>
        {getIndicator(0)}

        {getIndicator(1)}
      </View>
    </>
  )
}

export default ProgressModulesContainer
