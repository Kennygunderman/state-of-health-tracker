interface UserInfoState {
    currentDate: string;
    targetCalories: number;
    targetWorkouts: number;
    dateWeightMap: DateWeightMap;
}

interface DateWeightMap {
    [date: string]: number;
}
