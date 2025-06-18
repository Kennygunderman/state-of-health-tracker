import FontSize from '../../constants/FontSize';
import Spacing from '../../constants/Spacing';
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  dateText: {
    fontWeight: 'bold',
    marginTop: Spacing.MEDIUM,
    marginLeft: Spacing.LARGE,
    marginBottom: Spacing.SMALL,
  },
  workoutTitle: {
    fontSize: FontSize.H1,
    fontWeight: 'bold',
    margin: Spacing.MEDIUM,
    marginLeft: Spacing.LARGE,
  },
  exerciseHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignContent: 'center',
    margin: Spacing.MEDIUM,
  },
  exerciseHeaderText: {
    marginLeft: Spacing.X_SMALL,
    fontSize: FontSize.H1,
    fontWeight: 'bold',
  },
  addButton: {
    alignSelf: 'flex-end',
  },
  emptyIcon: {
    alignSelf: 'center',
    marginRight: -Spacing.MEDIUM,
    marginTop: Spacing.MEDIUM,
  },
  footerButton: {
    marginTop: Spacing.SMALL,
    marginBottom: Spacing.LARGE,
    marginLeft: Spacing.MEDIUM,
    marginRight: Spacing.MEDIUM,
  },
  sectionList: {
    width: '100%',
    height: '100%',
  },
  loadingIndicator: {
    height: 250,
    position: 'relative',
    backgroundColor: 'transparent',
  }
});

