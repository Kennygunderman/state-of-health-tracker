import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'
import LinearGradient from 'react-native-linear-gradient'
import Svg, {Circle, Path} from 'react-native-svg'

import Text from '@components/Text'

import {LOG_WITH_AI_CARD_SUBTITLE, LOG_WITH_AI_TITLE} from '@constants/strings'

import styles from './index.styled'

const SPARKLE_GLYPH = '✦'
const CAMERA_ICON_SIZE = 20
const CAMERA_ICON_STROKE_WIDTH = 1.8

const GRADIENT_START = {x: 0, y: 0}
const GRADIENT_END = {x: 1, y: 1}

interface Props {
  onPress: () => void
}

const LogWithAICard = ({onPress}: Props) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={Opacity.PRESSED}
      accessibilityRole="button"
      accessibilityLabel={LOG_WITH_AI_TITLE}
      accessibilityHint={LOG_WITH_AI_CARD_SUBTITLE}
      onPress={onPress}>
      {/* The sparkle is decoration: read aloud it is a glyph name in front of the card's own label. */}
      <LinearGradient
        colors={[Theme.colors.greenOnTint, Theme.colors.accentGreen]}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={styles.aiTile}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Text style={styles.aiTileGlyph}>{SPARKLE_GLYPH}</Text>
      </LinearGradient>

      <View style={styles.textColumn}>
        <Text style={styles.title}>{LOG_WITH_AI_TITLE}</Text>

        <Text style={styles.subtitle} numberOfLines={2}>
          {LOG_WITH_AI_CARD_SUBTITLE}
        </Text>
      </View>

      {/* The camera button opens no camera: it repeats the card's own onPress, so it is a duplicate stop. */}
      <TouchableOpacity
        style={styles.cameraButton}
        activeOpacity={Opacity.PRESSED}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={onPress}>
        <Svg width={CAMERA_ICON_SIZE} height={CAMERA_ICON_SIZE} viewBox="0 0 24 24" fill="none">
          <Path
            d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"
            stroke={Theme.colors.text}
            strokeWidth={CAMERA_ICON_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Circle
            cx={12}
            cy={13}
            r={4}
            stroke={Theme.colors.text}
            strokeWidth={CAMERA_ICON_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

export default LogWithAICard
