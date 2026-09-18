export default {
  MODAL: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5
  },
  // The bottom sheet's lift. Its offset is the only negative one here because a sheet rises from the bottom
  // edge, so its shadow falls upward onto the content it covers.
  SHEET: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10
  },
  CARD: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3
  },
  CTA_GLOW: {
    shadowColor: '#16BC85',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4
  },
  ICON_GLOW: {
    shadowColor: '#16BC85',
    shadowOffset: {
      width: 0,
      height: 12
    },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10
  }
}
