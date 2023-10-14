import { format, isMonday } from 'date-fns';

// returns current date as Ex: September 28, 2023
export const getCurrentDate = () => format(Date.now(), 'MMMM dd, yyyy');

export const formatDate = (date: number) => format(date, 'MMMM dd, yyyy');

export const formatDateToMonthDay = (date: string | number): string => format(new Date(date), 'M/d');

export const ONE_DAY_MS = 1000 * 60 * 60 * 24; // 1000 ms * 60s * 60m * 24h

export const getLast7Mondays = () => {
    const last7Mondays = [];
    let daysAgo = 0;
    let mostRecentMonday = Date.now();
    while (!isMonday(mostRecentMonday)) {
        daysAgo++;
        mostRecentMonday = Date.now() - (ONE_DAY_MS * daysAgo);
    }

    for (let i = 0; i < 7; i++) {
        last7Mondays.push(mostRecentMonday - i * (ONE_DAY_MS * 7));
    }

    return last7Mondays.reverse();
};

export const formatDayMonthDay = (date: string | number): string => {
    try {
        return format(new Date(date), 'EEEE, LLLL do');
    } catch (e) {
        return '';
    }
};

export const isDateLessThan2SecondsOld = (date: number) => (Date.now() - date) < 2_000;

export const isDateOlderThanADay = (date: number) => (Date.now() - date) > ONE_DAY_MS;
