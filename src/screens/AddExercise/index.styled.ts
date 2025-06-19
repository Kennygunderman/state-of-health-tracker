import { StyleSheet } from 'react-native'
import Spacing from "../../constants/Spacing";
import FontSize from "../../constants/FontSize";

export default StyleSheet.create({
  listFooter: {
    marginBottom: Spacing.LARGE
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: Spacing.MEDIUM,
    marginRight: Spacing.MEDIUM,
  },
  sectionHeaderText: {
    marginLeft: Spacing.X_SMALL,
    fontSize: FontSize.H1,
    fontWeight: 'bold',
  },
  emptyText: {
    fontWeight: '200',
    textAlign: 'center',
    alignSelf: 'center',
  },
  createButton: {
    alignSelf: 'flex-end',
    marginTop: Spacing.MEDIUM,
    marginBottom: Spacing.MEDIUM,
  },
})
