import React, {useState} from 'react'

import {StyleSheet, TouchableOpacity, View} from 'react-native'

import {BottomSheetScrollView} from '@gorhom/bottom-sheet'
import {Theme} from '@styles/theme'

import Text from '@components/Text'

interface Props {
  value: string
  items: {label: string; value: string}[]
  placeholder: string
  onSelect: (value: string) => void
}

const ROW_HEIGHT = 44

const TimeDropdown = ({value, items, placeholder, onSelect}: Props) => {
  const [open, setOpen] = useState(false)
  const selectedIndex = Math.max(
    0,
    items.findIndex(item => item.value === value)
  )

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel="Choose meal time"
        accessibilityValue={{text: items.find(item => item.value === value)?.label ?? placeholder}}
        accessibilityState={{expanded: open}}
        onPress={() => setOpen(!open)}>
        <Text style={styles.label}>{items.find(item => item.value === value)?.label ?? placeholder}</Text>

        <Text style={styles.arrow}>{open ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>

      {open && (
        <BottomSheetScrollView
          style={styles.list}
          contentOffset={{x: 0, y: Math.max(0, selectedIndex - 2) * ROW_HEIGHT}}
          keyboardShouldPersistTaps="handled">
          {items.map(item => (
            <TouchableOpacity
              key={item.value}
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{selected: item.value === value}}
              onPress={() => onSelect(item.value)}>
              <Text style={[styles.label, item.value === value && styles.selected]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </BottomSheetScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {width: '100%', backgroundColor: Theme.colors.secondary, borderRadius: 8, overflow: 'hidden'},
  control: {
    minHeight: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  label: {color: Theme.colors.text, fontSize: 16},
  arrow: {color: Theme.colors.accentGreen, fontSize: 24},
  list: {height: 264, flexGrow: 0},
  item: {height: ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: 12},
  selected: {color: Theme.colors.accentGreen}
})

export default TimeDropdown
