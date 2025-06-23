import { StyleSheet } from "react-native";
import FontSize from "../../../../constants/FontSize";
import Spacing from "../../../../constants/Spacing";

export default StyleSheet.create({
  title: {
    fontWeight: 'bold',
    fontSize: FontSize.H1
  },
  tagline: {
    fontWeight: '200',
    marginTop: Spacing.X_SMALL,
    fontSize: FontSize.PARAGRAPH
  },
  deleteContainer: {
    marginTop: Spacing.LARGE,
    flexDirection: 'row'
  },
  deleteText: {
    marginLeft: Spacing.X_SMALL,
    fontWeight: '600',
    alignSelf: "center",
    fontSize: FontSize.H2
  },
})
