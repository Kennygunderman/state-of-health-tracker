import {StyleSheet} from 'react-native'

import {BAR_GRAPH_MAX_HEIGHT} from '@components/BarGraph'
import borderRadius from '@constants/BorderRadius'
import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'
import Shadow from '@theme/Shadow'

export default StyleSheet.create({
  dateText: {
    fontWeight: 'bold',
    marginTop: Spacing.MEDIUM,
    marginLeft: Spacing.LARGE,
    marginBottom: Spacing.SMALL
  },
  workoutTitle: {
    fontSize: FontSize.H1,
    fontWeight: 'bold',
    margin: Spacing.MEDIUM,
    marginLeft: Spacing.LARGE
  },
  graphContainer: {
    ...Shadow.CARD,
    marginHorizontal: Spacing.MEDIUM,
    borderWidth: 1,
    borderRadius: borderRadius.SECTION,
    padding: Spacing.MEDIUM,
    marginBottom: Spacing.MEDIUM
  },
  graphArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_GRAPH_MAX_HEIGHT
  },
  yAxisContainer: {
    justifyContent: 'space-between',
    marginRight: 12
  },
  xAxisContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 12,
    flex: 1
  },
  barContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  contentContainer: {
    borderRadius: borderRadius.SECTION,
    padding: Spacing.MEDIUM,
    marginBottom: Spacing.SMALL
  },
  exerciseItemContainer: {
    marginHorizontal: Spacing.MEDIUM,
    borderWidth: 1,
    borderRadius: borderRadius.SECTION,

    marginBottom: Spacing.MEDIUM
  },
  horizontalRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  topButtonContainers: {
    paddingHorizontal: Spacing.SMALL
  },
  exerciseSetContainer: {
    alignSelf: 'center',
    borderRadius: borderRadius.SECTION,
    margin: Spacing.XX_SMALL
  }
})
