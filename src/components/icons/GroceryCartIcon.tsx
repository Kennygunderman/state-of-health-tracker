import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

type GroceryCartVariant = 'empty' | 'header'

interface Props extends IconProps {
  variant?: GroceryCartVariant
}

// The 46 px and 17 px carts are separate horizontal redraws — the smaller one is proportionally
// bolder — so each variant keeps the basket/wheel paths and authored offsets of its own node.
const VARIANT_BOX: Record<GroceryCartVariant, number> = {
  empty: Sizes.ICON_EMPTY,
  header: Sizes.ICON_SM
}

const VARIANT_STROKE: Record<GroceryCartVariant, number> = {
  empty: Stroke.EMPTY_CART,
  header: Stroke.CART_HEADER
}

const EMPTY_BASKET_PATH = 'M5.75 9.5835H10.7333L15.3333 28.7502H32.5833L38.3333 15.3335H11.5'

const EMPTY_LEFT_WHEEL_PATH =
  'M19.1666 39.2915C20.7544 39.2915 22.0416 38.0043 22.0416 36.4165C22.0416 34.8287 20.7544 33.5415 19.1666 33.5415C17.5788 33.5415 16.2916 34.8287 16.2916 36.4165C16.2916 38.0043 17.5788 39.2915 19.1666 39.2915Z'

const EMPTY_RIGHT_WHEEL_PATH =
  'M32.5834 39.2915C34.1712 39.2915 35.4584 38.0043 35.4584 36.4165C35.4584 34.8287 34.1712 33.5415 32.5834 33.5415C30.9956 33.5415 29.7084 34.8287 29.7084 36.4165C29.7084 38.0043 30.9956 39.2915 32.5834 39.2915Z'

const HEADER_BASKET_PATH = 'M2.83334 3.54175H4.95834L6.72918 10.6251H13.1042L14.875 5.66675H5.31251'

const HEADER_LEFT_WHEEL_PATH =
  'M7.08334 14.4499C7.63102 14.4499 8.07501 14.0059 8.07501 13.4582C8.07501 12.9105 7.63102 12.4666 7.08334 12.4666C6.53566 12.4666 6.09167 12.9105 6.09167 13.4582C6.09167 14.0059 6.53566 14.4499 7.08334 14.4499Z'

const HEADER_RIGHT_WHEEL_PATH =
  'M12.75 14.4499C13.2977 14.4499 13.7417 14.0059 13.7417 13.4582C13.7417 12.9105 13.2977 12.4666 12.75 12.4666C12.2023 12.4666 11.7583 12.9105 11.7583 13.4582C11.7583 14.0059 12.2023 14.4499 12.75 14.4499Z'

const GroceryCartIcon = ({color, size, strokeWidth, variant = 'header'}: Props) => {
  const box = VARIANT_BOX[variant]
  const stroke = strokeWidth ?? VARIANT_STROKE[variant]

  return (
    <Svg width={size ?? box} height={size ?? box} viewBox={`0 0 ${box} ${box}`} fill="none">
      <Path d={variant === 'empty' ? EMPTY_BASKET_PATH : HEADER_BASKET_PATH} stroke={color} strokeWidth={stroke} />

      <Path
        d={variant === 'empty' ? EMPTY_LEFT_WHEEL_PATH : HEADER_LEFT_WHEEL_PATH}
        stroke={color}
        strokeWidth={stroke}
      />

      <Path
        d={variant === 'empty' ? EMPTY_RIGHT_WHEEL_PATH : HEADER_RIGHT_WHEEL_PATH}
        stroke={color}
        strokeWidth={stroke}
      />
    </Svg>
  )
}

export default GroceryCartIcon
