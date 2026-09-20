import React, {useCallback} from 'react'

import {FlatList, Insets, ListRenderItemInfo, ScrollView, View} from 'react-native'

import styles, {CHIP_BAND_SLOP} from './index.styled'

export interface ChipCloudItem {
  id: string
}

interface Props<Item extends ChipCloudItem> {
  children?: React.ReactNode
  variant?: 'wrap' | 'scroll'
  items?: readonly Item[]
  renderChip?: (item: Item) => React.JSX.Element
}

/* BLITZY [A11Y]: the band reserves the chips' slop inside its own box and hands the height back to the layout
   (see index.styled), so a touch anywhere in the 44px envelope lands on a chip without the band growing past
   the 32px Figma draws. The negative margin puts the reserved 6px outside the band's layout box, so a screen
   that wraps this cloud in a view hugging it must let a touch through that view as well — neither platform
   looks for a target outside an ancestor's own hit rect. That is what this slop is for: it is applied to the
   wrapping view, never to the cloud, which needs none. The one residual, recorded at
   @components/SelectableChip, is a band whose wrapper cannot carry it. */
export const CHIP_BAND_HIT_SLOP: Insets = {top: CHIP_BAND_SLOP, bottom: CHIP_BAND_SLOP}

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
