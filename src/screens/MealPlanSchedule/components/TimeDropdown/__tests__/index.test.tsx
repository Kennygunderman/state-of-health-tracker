import React from 'react'

import {TouchableOpacity} from 'react-native'

import {act, create, ReactTestRenderer} from 'react-test-renderer'

import TimeDropdown from '../index'

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: jest.requireActual<typeof import('react-native')>('react-native').ScrollView
}))

it('opens the choices and returns the selected wire-format time', () => {
  const onSelect = jest.fn()
  let renderer: ReactTestRenderer
  act(() => {
    renderer = create(
      <TimeDropdown
        value="08:00"
        items={[
          {label: '8:00 AM', value: '08:00'},
          {label: '9:00 PM', value: '21:00'}
        ]}
        placeholder="Choose time"
        onSelect={onSelect}
      />
    )
  })
  act(() => renderer!.root.findByType(TouchableOpacity).props.onPress())
  const choice = renderer!.root
    .findAllByType(TouchableOpacity)
    .find(item => item.props.accessibilityLabel === '9:00 PM')!
  act(() => choice.props.onPress())
  expect(onSelect).toHaveBeenCalledWith('21:00')
  expect(onSelect).toHaveBeenCalledTimes(1)
  act(() => renderer!.unmount())
})
