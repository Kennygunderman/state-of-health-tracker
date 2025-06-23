import React from 'react'

import {View} from 'react-native'

import BorderRadius from '@constants/BorderRadius'
import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'
import {Text, useStyleTheme} from '@theme/Theme'

interface Props<T> {
  readonly subItems: T[]
  readonly day: string
  readonly headerChip: JSX.Element
  readonly column1Label: String
  readonly column2Label: String
  readonly getChipForItem: (item: T) => JSX.Element
  readonly getTitleForItem: (item: T) => string
  readonly getSubtitleForItem: (item: T) => string
}

const PreviousEntryListItem = <T extends object>(props: Props<T>) => {
  const {headerChip, column1Label, column2Label, subItems, day, getChipForItem, getTitleForItem, getSubtitleForItem} =
    props

  return (
    <View
      key={day}
      style={{
        padding: Spacing.SMALL,
        paddingBottom: Spacing.X_SMALL,
        borderRadius: BorderRadius.SECTION,
        borderWidth: 1,
        borderColor: useStyleTheme().colors.border,
        marginBottom: Spacing.MEDIUM
      }}>
      <Text
        style={{
          fontSize: FontSize.H3,
          marginBottom: Spacing.SMALL
        }}>
        {day}
      </Text>
      <View style={{flexDirection: 'row'}}>{headerChip}</View>
      <View
        style={{
          marginTop: Spacing.MEDIUM,
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: Spacing.SMALL
        }}>
        <Text
          style={{
            marginLeft: Spacing.X_SMALL,
            fontSize: FontSize.H2,
            fontWeight: 'bold'
          }}>
          {column1Label}
        </Text>
        <Text
          style={{
            marginRight: Spacing.X_SMALL,
            fontSize: FontSize.H2,
            fontWeight: 'bold'
          }}>
          {column2Label}
        </Text>
      </View>

      {subItems.map((item: T) => (
        <View
          style={{
            backgroundColor: useStyleTheme().colors.tertiary,
            borderRadius: BorderRadius.SECTION,
            marginBottom: Spacing.XX_SMALL,
            paddingLeft: Spacing.SMALL,
            paddingRight: Spacing.SMALL,
            paddingTop: Spacing.XX_SMALL,
            paddingBottom: Spacing.XX_SMALL
          }}>
          <Text style={{fontWeight: 'bold'}}>{getTitleForItem(item)}</Text>
          <Text
            style={{
              marginTop: Spacing.XX_SMALL,
              fontWeight: '200'
            }}>
            {getSubtitleForItem(item)}
          </Text>
          {getChipForItem(item)}
        </View>
      ))}
    </View>
  )
}

export default PreviousEntryListItem

interface EmptyStateProps {
  icon: JSX.Element
  title: string
  body: string
}

export const EmptyState = (props: EmptyStateProps) => {
  const {icon, title, body} = props
  return (
    <>
      {icon}
      <Text
        style={{
          fontSize: FontSize.H1,
          marginTop: Spacing.MEDIUM,
          fontWeight: 'bold',
          alignSelf: 'center'
        }}>
        {title}
      </Text>
      <Text
        style={{
          marginTop: Spacing.MEDIUM,
          marginBottom: Spacing.MEDIUM,
          marginLeft: Spacing.MEDIUM,
          marginRight: Spacing.MEDIUM,
          fontSize: FontSize.PARAGRAPH,
          textAlign: 'center',
          fontWeight: '200',
          alignSelf: 'center'
        }}>
        {body}
      </Text>
    </>
  )
}
