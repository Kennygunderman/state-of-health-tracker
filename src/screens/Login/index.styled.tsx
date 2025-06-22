import Spacing from '../../constants/Spacing';
import { StyleSheet } from "react-native";
import FontSize from "../../constants/FontSize";

export default StyleSheet.create({
  text: {
    fontWeight: '200',
    alignSelf: 'center',
    fontSize: FontSize.PARAGRAPH,
  },
  textContainer: {
    marginHorizontal: 20,
    gap: 20,
    marginBottom: Spacing.X_LARGE,
  }
});

