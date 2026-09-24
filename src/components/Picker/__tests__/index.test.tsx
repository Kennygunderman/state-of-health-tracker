import React from 'react'

import DropDownPicker from 'react-native-dropdown-picker'
import {act, create, ReactTestRenderer} from 'react-test-renderer'

import Picker from '../index'

jest.mock('react-native-dropdown-picker', () => 'DropDownPicker')

it('emits the selected time, not the functional state updater supplied by the dropdown', () => {
  const onValueSet = jest.fn()
  let renderer: ReactTestRenderer

  act(() => {
    renderer = create(
      <Picker initialValue="08:00" items={[{label: '9:00 PM', value: '21:00'}]} onValueSet={onValueSet} />
    )
  })
  const dropdown = renderer!.root.findByType(DropDownPicker)

  act(() => {
    dropdown.props.onSelectItem({label: '9:00 PM', value: '21:00'})
    dropdown.props.setValue(() => '21:00')
  })
  expect(onValueSet).toHaveBeenCalledTimes(1)
  expect(onValueSet).toHaveBeenCalledWith('21:00')
  expect(renderer!.root.findByType(DropDownPicker).props.value).toBe('21:00')
  act(() => renderer!.unmount())
})
