import React, {useCallback} from 'react'

import {FlatList, ListRenderItemInfo, ScrollView, View} from 'react-native'

import styles from './index.styled'

export interface ChipCloudItem {
  id: string
}

interface Props<Item extends ChipCloudItem> {
  children?: React.ReactNode
  variant?: 'wrap' | 'scroll'
  items?: readonly Item[]
  renderChip?: (item: Item) => React.JSX.Element
}

const chipKeyExtractor = (item: ChipCloudItem): string => item.id

const ChipCloud = <Item extends ChipCloudItem>({
  children,
  variant = 'wrap',
  items,
  renderChip
}: Props<Item>): React.JSX.Element => {
  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<Item>): React.JSX.Element | null =>
      renderChip === undefined ? null : renderChip(item),
    [renderChip]
  )

  // A selection can reach a hundred chips (the dislike cap), and a band holds only a handful at a time, so a
  // caller that hands over its items gets them mounted as they are scrolled to rather than all at once. The
  // band's geometry and keyboard handling are the same either way.
  if (variant === 'scroll' && items !== undefined && renderChip !== undefined) {
    return (
      <FlatList
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={chipKeyExtractor}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.cloud}
      />
    )
  }

  if (variant === 'scroll') {
    return (
      // The scroll variant is the row that sits under a focused search field (06b keeps its query, note 47:463),
      // so the scroll view has to hand the first tap to the chip rather than spend it dismissing the keyboard.
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.cloud}>
        {children}
      </ScrollView>
    )
  }

  return <View style={[styles.cloud, styles.wrap]}>{children}</View>
}

export default ChipCloud
