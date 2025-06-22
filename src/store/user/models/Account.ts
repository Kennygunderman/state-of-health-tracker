import Unique from '../../../data/models/Unique';

export default interface Account extends Unique {
    name?: string | null;
    email?: string | null;
}
