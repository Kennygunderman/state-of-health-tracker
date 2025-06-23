import { Dimensions, StyleSheet } from 'react-native';
import { SEARCH_BAR_HEIGHT } from "../../../../components/SearchBar";
import Spacing from "../../../../constants/Spacing";
import { useStyleTheme } from "../../../../styles/Theme";

const windowHeight = Dimensions.get('window').height;

export default StyleSheet.create({
  touchable: {
    width: '100%',
    height: SEARCH_BAR_HEIGHT,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    height: SEARCH_BAR_HEIGHT,
  },
  innerContainer: {
    alignSelf: 'center',
    borderRadius: 50,
    flexDirection: 'row',
    width: '90%',
    paddingVertical: 10,
    paddingHorizontal: Spacing.MEDIUM,
    alignItems: 'center',
  },
  icon: {
    marginRight: Spacing.MEDIUM,
  },
  placeholder: {
    fontSize: 16,
  },
  searchBarBackground: {
    width: '100%',
    height: windowHeight,
    position: 'absolute',
    bottom: 0,
    marginBottom: 0,
  }
});
