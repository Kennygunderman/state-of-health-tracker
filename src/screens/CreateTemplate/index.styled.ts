import { StyleSheet } from 'react-native';
import FontSize from '../../constants/FontSize';
import Spacing from '../../constants/Spacing';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  headerText: {
    marginLeft: Spacing.LARGE,
    fontSize: FontSize.H2,
    marginVertical: Spacing.MEDIUM,
    fontWeight: 'bold',
  },
  footerButton: {
    margin: Spacing.MEDIUM,
    marginBottom: 48
  },
});
