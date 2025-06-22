import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import AccountListItem from './AccountListItem';
import ConfirmModal from '../../../components/dialog/ConfirmModal';
import Screens from '../../../constants/Screens';
import {
    ACCOUNT_LOG_IN_LIST_ITEM,
    ACCOUNT_LOG_OUT_LIST_ITEM, LOG_OUT_CONFIRM_MODAL_BODY,
    LOG_OUT_CONFIRM_MODAL_HEADER,
} from '../../../constants/Strings';
import { useThunkDispatch } from '../../../store';
import LocalStore from '../../../store/LocalStore';
import Account from '../../../store/user/models/Account';
import { logOutUser } from '../../../store/user/UserActions';
import { useStyleTheme } from '../../../styles/Theme';

const AuthListItem = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
    const account = useSelector<LocalStore, Account | undefined>((state: LocalStore) => state.user.account);

    const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
    const dispatch = useThunkDispatch();

    return (
        <>
            <ConfirmModal
                confirmationTitle={LOG_OUT_CONFIRM_MODAL_HEADER}
                confirmButtonText={ACCOUNT_LOG_OUT_LIST_ITEM}
                confirmationBody={LOG_OUT_CONFIRM_MODAL_BODY}
                isVisible={isConfirmModalVisible}
                onConfirmPressed={() => {
                    setIsConfirmModalVisible(false);
                    if (account?.id) {
                        dispatch(logOutUser(account));
                    }
                }}
                onCancel={() => {
                    setIsConfirmModalVisible(false);
                }}
            />
            <AccountListItem
                type="auth"
                text={account ? ACCOUNT_LOG_OUT_LIST_ITEM : ACCOUNT_LOG_IN_LIST_ITEM}
                icon={<MaterialCommunityIcons name="account" size={24} color={useStyleTheme().colors.white} />}
                onPressOverride={() => {
                    if (account) {
                        setIsConfirmModalVisible(true);
                    } else {
                        navigation.push('Auth', { screen: Screens.LOG_IN })
                    }
                }}
            />
        </>
    );
};

export default AuthListItem;
