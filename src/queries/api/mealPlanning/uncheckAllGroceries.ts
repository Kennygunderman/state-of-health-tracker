import {UncheckAllGroceriesResult} from '@data/models/GroceryList'
import {httpPost} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'
import * as io from 'io-ts'

import Endpoints from '@constants/endpoints'

const UncheckAllGroceriesResponse = io.type({checkedCount: io.number})

export async function uncheckAllGroceries(planId: string): Promise<UncheckAllGroceriesResult> {
  try {
    const response = await httpPost(Endpoints.MealPlanGroceriesUncheckAll(planId), UncheckAllGroceriesResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response unchecking groceries: status=${response?.status}`)
    }

    return response.data
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
