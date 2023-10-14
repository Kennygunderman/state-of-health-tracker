import { Selector, createSelector } from 'reselect';
import { NOT_SET_TEXT } from '../constants/Strings';
import LocalStore from '../store/LocalStore';

function getLastRecordedWeight(dateWeightMap: DateWeightMap): string {
    const lastEntryKey = Object.keys(dateWeightMap).pop();
    return dateWeightMap?.[lastEntryKey ?? '']?.toString() ?? NOT_SET_TEXT;
}

export const getLastRecordedWeightSelector: Selector<LocalStore, string> = createSelector(
    (state: LocalStore) => state.userInfo.dateWeightMap,
    getLastRecordedWeight,
);
