import React, {useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Ionicons} from '@expo/vector-icons'
import {Text, useStyleTheme} from '@theme/Theme'

import TargetCaloriesModal from '@components/dialog/TargetCaloriesModal'
import TargetWorkoutsModal from '@components/dialog/TargetWorkoutsModal'
import WeightEntryModal from '@components/dialog/WeightEntryModal'
import HorizontalDivider from '@components/HorizontalDivider'

import Spacing from '@constants/Spacing'

interface Props {
  readonly clickable?: boolean
  readonly text: string
  readonly icon: JSX.Element
  readonly type: 'target-calories' | 'target-workouts' | 'weight' | 'auth' | 'info' | 'display-name'
  readonly onPressOverride?: () => void
}

const AccountListItem = (props: Props) => {
  const {clickable = true, text, icon, type, onPressOverride} = props

  const iconSize = 24
  const iconColor = useStyleTheme().colors.white

  const [isInputModalVisible, setIsInputModalVisible] = useState(false)

  const getModalForType = () => {
    const dialogProps = {
      isVisible: isInputModalVisible,
      onDismissed: () => setIsInputModalVisible(false)
    }

    switch (type) {
      case 'target-calories':
        return <TargetCaloriesModal {...dialogProps} />
      case 'target-workouts':
        return <TargetWorkoutsModal {...dialogProps} />
      case 'weight':
        return <WeightEntryModal {...dialogProps} />
      default:
        break
    }
  }

  return (
    <>
      {getModalForType()}

      <TouchableOpacity
        activeOpacity={clickable ? 0.25 : 1}
        onPress={() => {
          onPressOverride ? onPressOverride() : clickable && setIsInputModalVisible(true)
        }}
        style={{
          marginTop: Spacing.MEDIUM,
          marginBottom: Spacing.MEDIUM,
          marginLeft: Spacing.LARGE,
          marginRight: Spacing.LARGE,
          flexDirection: 'row',
          justifyContent: 'space-between'
        }}>
        <View style={{flexDirection: 'row'}}>
          {icon}

          <Text
            style={{
              alignSelf: 'center',
              marginLeft: Spacing.X_SMALL
            }}>
            {text}
          </Text>
        </View>

        {clickable && (
          <Ionicons name="chevron-forward" size={iconSize} color={iconColor} style={{alignSelf: 'flex-start'}} />
        )}
      </TouchableOpacity>

      <HorizontalDivider />
    </>
  )
}

export default AccountListItem
