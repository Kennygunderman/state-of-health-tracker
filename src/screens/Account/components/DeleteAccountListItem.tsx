import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AccountListItem from './AccountListItem';
import ConfirmModal from '../../../components/dialog/ConfirmModal';
import {
    DELETE_ACCOUNT_CONFIRM_MODAL_BODY,
    DELETE_ACCOUNT_CONFIRM_MODAL_HEADER, DELETE_ACCOUNT_LIST_ITEM,
    DELETE_BUTTON_TEXT,
} from '../../../constants/Strings';
import { useThunkDispatch } from '../../../store';
import { deleteLoggedInUser } from '../../../store/user/UserActions';
import { useStyleTheme } from '../../../styles/Theme';

const DeleteAccountListItem = () => {
    const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
    const dispatch = useThunkDispatch();

    return (
        <>
            <ConfirmModal
                confirmationTitle={DELETE_ACCOUNT_CONFIRM_MODAL_HEADER}
                confirmButtonText={DELETE_BUTTON_TEXT}
                confirmationBody={DELETE_ACCOUNT_CONFIRM_MODAL_BODY}
                isVisible={isConfirmModalVisible}
                onConfirmPressed={() => {
                    dispatch(deleteLoggedInUser());
                    setIsConfirmModalVisible(false);
                }}
                onCancel={() => {
                    setIsConfirmModalVisible(false);
                }}
            />
            <AccountListItem
                type="auth"
                text={DELETE_ACCOUNT_LIST_ITEM}
                icon={<Ionicons name="trash-bin-outline" size={24} color={useStyleTheme().colors.white} />}
                onPressOverride={() => {
                    setIsConfirmModalVisible(true);
                }}
            />
        </>
    );
};

export default DeleteAccountListItem;
