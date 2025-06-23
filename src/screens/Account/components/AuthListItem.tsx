import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import AccountListItem from './AccountListItem';
import ConfirmModal from '../../../components/dialog/ConfirmModal';
import {
  ACCOUNT_LOG_IN_LIST_ITEM,
  ACCOUNT_LOG_OUT_LIST_ITEM, LOG_OUT_CONFIRM_MODAL_BODY,
  LOG_OUT_CONFIRM_MODAL_HEADER,
} from '../../../constants/Strings';
import LocalStore from '../../../store/LocalStore';
import { useStyleTheme } from '../../../styles/Theme';
import useAuthStore from "../../../store/auth/useAuthStore";

const AuthListItem = () => {

  const currentState = useSelector<LocalStore, LocalStore>((state: LocalStore) => state);

  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);

  const { isAuthed, logoutUser } = useAuthStore();

  return (
    <>
      <ConfirmModal
        confirmationTitle={LOG_OUT_CONFIRM_MODAL_HEADER}
        confirmButtonText={ACCOUNT_LOG_OUT_LIST_ITEM}
        confirmationBody={LOG_OUT_CONFIRM_MODAL_BODY}
        isVisible={isConfirmModalVisible}
        onConfirmPressed={() => {
          setIsConfirmModalVisible(false);
          if (isAuthed) {
            logoutUser();
          }
        }}
        onCancel={() => {
          setIsConfirmModalVisible(false);
        }}
      />
      <AccountListItem
        type="auth"
        text={isAuthed ? ACCOUNT_LOG_OUT_LIST_ITEM : ACCOUNT_LOG_IN_LIST_ITEM}
        icon={<MaterialCommunityIcons name="account" size={24} color={useStyleTheme().colors.white}/>}
        onPressOverride={() => {
          if (isAuthed) {
            setIsConfirmModalVisible(true);
          }
        }}
      />
    </>
  );
};

export default AuthListItem;
