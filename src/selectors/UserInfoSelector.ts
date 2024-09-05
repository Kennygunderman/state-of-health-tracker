import { Selector, createSelector } from 'reselect';
import { LBS_LABEL, NOT_SET_TEXT } from '../constants/Strings';
import LocalStore from '../store/LocalStore';

function getLastRecordedWeight(dateWeightMap: DateWeightMap): string {
    const lastEntryKey = Object.keys(dateWeightMap).pop();

    const entry = dateWeightMap?.[lastEntryKey ?? '']?.toString();

    return entry ? `${entry} ${LBS_LABEL}` : NOT_SET_TEXT;
}

export const getLastRecordedWeightSelector: Selector<LocalStore, string> = createSelector(
    (state: LocalStore) => state.userInfo.dateWeightMap,
    getLastRecordedWeight,
);
