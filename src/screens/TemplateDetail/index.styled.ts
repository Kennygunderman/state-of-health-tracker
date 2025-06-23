import { StyleSheet } from 'react-native';
import Spacing from "../../constants/Spacing";
import FontSize from "../../constants/FontSize";

export default StyleSheet.create({
  headerText: {
    paddingLeft: Spacing.LARGE,
    paddingVertical: Spacing.MEDIUM,
    fontSize: FontSize.H1,
    fontWeight: 'bold',
  },
  footerButton: {
    margin: Spacing.MEDIUM,
    marginBottom: Spacing.X_LARGE,
  },
  itemMargin: {
    marginHorizontal: Spacing.MEDIUM,
  },
});
