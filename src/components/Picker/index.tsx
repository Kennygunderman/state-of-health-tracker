import React, {useState} from 'react'

import {Keyboard} from 'react-native'

import DropDownPicker from 'react-native-dropdown-picker'

import {arrowIcon, dropDownContainer, pickerControl, pickerPlaceholder, pickerText, tickIcon} from './index.styled'

export interface PickerItem {
  label: string
  value: any
}

interface Props {
  width?: number
  items: PickerItem[]
  disabled?: boolean
  placeholder?: string
  initialValue?: any
  onValueSet: (value: any) => void
}

const Picker = (props: Props) => {
  const {width, items, disabled = false, placeholder, initialValue, onValueSet} = props

  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initialValue)

  return (
    <DropDownPicker
      onPress={() => Keyboard.dismiss()}
      dropDownContainerStyle={dropDownContainer(width)}
      // @ts-ignore
      arrowIconStyle={arrowIcon}
      // @ts-ignore
      tickIconStyle={tickIcon}
      textStyle={pickerText}
      placeholderStyle={pickerPlaceholder}
      style={pickerControl(width, disabled)}
      placeholder={placeholder}
      disabled={disabled}
      open={open}
      value={value}
      items={items}
      setOpen={setOpen}
      setValue={setValue}
      onSelectItem={item => onValueSet(item.value)}
    />
  )
}

export default Picker
