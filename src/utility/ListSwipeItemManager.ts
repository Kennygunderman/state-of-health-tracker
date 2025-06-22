import { Swipeable } from 'react-native-gesture-handler';
import Unique from '../data/models/Unique';

export default class ListSwipeItemManager {
    private prevOpenedRow: Swipeable | null = null;

    private swipeableRows: { [key: string]: Swipeable[] };

    constructor(uniques: Unique[] = []) {
        this.swipeableRows = uniques.reduce((prev: any, curr) => {
            prev[curr.id] = [];
            return prev;
        }, {});
    }

    public setRows(uniques: Unique[]) {
        this.swipeableRows = uniques.reduce((prev: any, curr) => {
            prev[curr.id] = [];
            return prev;
        }, {});
    }

    public setRef = (ref: Swipeable, unique: Unique, index: number) => {
        this.swipeableRows[unique.id][index] = ref;
    };

    public closeRow = (unique: Unique, index: number) => {
        if (this.prevOpenedRow && this.prevOpenedRow !== this.swipeableRows[unique.id][index]) {
            this.prevOpenedRow.close();
        }
        this.prevOpenedRow = this.swipeableRows[unique.id][index];
    };
}
