import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { useStyleTheme } from '@theme/Theme'
import PrimaryButton from '@components/PrimaryButton'
import { closeGlobalBottomSheet } from '@components/GlobalBottomSheet'

interface RunsBetaWarningProps {
  onUnderstood?: () => void
}

const RunsBetaWarning: React.FC<RunsBetaWarningProps> = ({ onUnderstood }) => {
  const theme = useStyleTheme()

  const handleUnderstood = () => {
    closeGlobalBottomSheet()
    onUnderstood?.()
  }

  return (
    <View style={styles.container}>
      {/* Header with beta icon */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.warning }]}>
          <MaterialCommunityIcons
            name="flask"
            size={24}
            color={theme.colors.white}
          />
        </View>
        <Text style={[styles.title, { color: theme.colors.white }]}>
          Beta Feature
        </Text>
      </View>

      {/* Warning content */}
      <View style={styles.content}>
        <Text style={[styles.description, { color: theme.colors.white }]}>
          The Runs feature is currently in beta. Please note:
        </Text>

        <View style={styles.bulletPoints}>
          <View style={styles.bulletPoint}>
            <View style={[styles.bullet, { backgroundColor: theme.colors.white }]} />
            <Text style={[styles.bulletText, { color: theme.colors.white }]}>
              Run data is only stored locally on your device.
            </Text>
          </View>

          <View style={styles.bulletPoint}>
            <View style={[styles.bullet, { backgroundColor: theme.colors.white }]} />
            <Text style={[styles.bulletText, { color: theme.colors.white }]}>
              Data is not synced to your account or cloud storage.
            </Text>
          </View>

          <View style={styles.bulletPoint}>
            <View style={[styles.bullet, { backgroundColor: theme.colors.white }]} />
            <Text style={[styles.bulletText, { color: theme.colors.white }]}>
              Deleting the app will permanently remove all run data.
            </Text>
          </View>

          <View style={styles.bulletPoint}>
            <View style={[styles.bullet, { backgroundColor: theme.colors.white }]} />
            <Text style={[styles.bulletText, { color: theme.colors.white }]}>
              Tracked data is subject to deletion in the future.
            </Text>
          </View>
        </View>

        <Text style={[styles.footer, { color: theme.colors.white }]}>
          We're working on cloud sync and additional features for future updates.
        </Text>
      </View>

      {/* Action button */}
      <View style={styles.buttonContainer}>
        <PrimaryButton
          label="I Understand"
          onPress={handleUnderstood}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  bulletPoints: {
    marginBottom: 16,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginRight: 12,
  },
  bulletText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginHorizontal: -8,
    marginTop: 8,
  },
})

export default RunsBetaWarning
