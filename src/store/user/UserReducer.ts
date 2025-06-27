import {USER_INITIAL_STATE} from './initialState'
import {UPDATE_LAST_SYNCED} from './UserActions'
import {UserState} from './UserState'

function updateLastSynced(state: UserState, action: Action<number>): UserState {
  const syncedDate = action.payload

  if (!syncedDate) {
    return state
  }

  return {
    ...state,
    lastDataSync: syncedDate
  }
}

const userReducerMap = {
  [UPDATE_LAST_SYNCED]: updateLastSynced
}

export function userReducer(state = USER_INITIAL_STATE, action: Action<any>): UserState {
  const reducer = userReducerMap[action.type]

  if (!reducer) {
    return state
  }

  return reducer(state, action)
}
