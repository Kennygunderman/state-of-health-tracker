import {Dimensions, StyleSheet} from 'react-native'

import Spacing from '@constants/Spacing'

export const createExerciseMaxPickerWidth = Dimensions.get('window').width - Spacing.MEDIUM * 2

const styles = StyleSheet.create({
  icon: {
    alignSelf: 'center'
  },
  inputContainer: {
    marginLeft: Spacing.MEDIUM,
    marginRight: Spacing.MEDIUM,
    marginBottom: Spacing.MEDIUM
  },
  pickerRow: {
    marginLeft: Spacing.MEDIUM,
    marginRight: Spacing.MEDIUM,
    marginBottom: Spacing.MEDIUM,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  pickerColumn: {
    width: createExerciseMaxPickerWidth * 0.47,
    paddingRight: Spacing.X_SMALL
  },
  pickerHeader: {
    fontWeight: 'bold',
    marginTop: Spacing.SMALL,
    marginBottom: Spacing.SMALL
  },
  button: {
    margin: Spacing.MEDIUM
  }
})

export default styles
