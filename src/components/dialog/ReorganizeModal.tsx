import React, { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { TouchableOpacity, View } from 'react-native';
import DraggableFlatList, {
    RenderItemParams,
    ScaleDecorator,
} from 'react-native-draggable-flatlist';
import Modal from 'react-native-modal';
import BorderRadius from '../../constants/BorderRadius';
import FontSize from '../../constants/FontSize';
import Spacing from '../../constants/Spacing';
import { CANCEL_BUTTON_TEXT, CONFIRM_BUTTON_TEXT, REORG_MODAL_BODY } from '../../constants/Strings';
import Shadow from '../../styles/Shadow';
import { Text, useStyleTheme } from '../../styles/Theme';
import PrimaryButton from '../PrimaryButton';

interface Props<T> {
    readonly isVisible: boolean;
    readonly onCancel?: () => void;
    readonly onConfirm?: (updateItems: T[]) => void;
    readonly items: T[];
    readonly getTitleForItem: (item: T) => string;
}

const ReorganizeModal = <T extends object>(props: Props<T>) => {
    const {
        isVisible, onCancel, onConfirm, items, getTitleForItem,
    } = props;

    const [listData, setListData] = useState(items);

    useEffect(() => {
        if (isVisible) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [isVisible]);

    useEffect(() => {
        setListData(items);
    }, [items]);

    const renderItem = ({
        item, drag, isActive,
    }: RenderItemParams<T>) => (
        <ScaleDecorator>
            <TouchableOpacity
                activeOpacity={0.75}
                delayLongPress={50}
                onLongPress={drag}
                disabled={isActive}
            >
                <Text style={{
                    textAlign: 'center',
                    marginLeft: Spacing.MEDIUM,
                    marginRight: Spacing.MEDIUM,
                    marginTop: 2,
                    marginBottom: 2,
                    fontSize: FontSize.H2,
                    fontWeight: 'bold',
                    color: useStyleTheme().colors.white,
                }}
                >
                    {getTitleForItem(item)}
                </Text>
            </TouchableOpacity>
        </ScaleDecorator>
    );

    return (
        <Modal
            useNativeDriverForBackdrop={true}
            animationIn="pulse"
            backdropOpacity={0.5}
            animationOut="fadeOut"
            animationInTiming={300}
            animationOutTiming={100}
            isVisible={isVisible}
            onBackdropPress={() => {
                onCancel?.();
            }}
        >
            <View style={{ flex: 1, justifyContent: 'center' }} pointerEvents="box-none">
                <View style={{
                    ...Shadow.MODAL,
                    borderRadius: BorderRadius.MODAL,
                    backgroundColor: useStyleTheme().colors.primary,
                    alignSelf: 'center',
                    width: '90%',
                    padding: Spacing.MEDIUM,
                }}
                >
                    <Text style={{
                        textAlign: 'center',
                        marginLeft: Spacing.MEDIUM,
                        marginRight: Spacing.MEDIUM,
                        marginBottom: Spacing.MEDIUM,
                        fontSize: FontSize.H3,
                        fontWeight: '300',
                    }}
                    >
                        {REORG_MODAL_BODY}
                    </Text>
                    <DraggableFlatList
                        data={listData}
                        onDragEnd={({ data }) => setListData(data)}
                        keyExtractor={(item) => getTitleForItem(item)}
                        renderItem={renderItem}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.LARGE }}>
                        <PrimaryButton
                            width="48%"
                            style={{
                                padding: Spacing.X_SMALL,

                            }}
                            label={CANCEL_BUTTON_TEXT}
                            onPress={() => {
                                onCancel?.();
                            }}
                        />
                        <PrimaryButton
                            width="48%"
                            style={{
                                backgroundColor: useStyleTheme().colors.secondaryLighter,
                                padding: Spacing.X_SMALL,

                            }}
                            label={CONFIRM_BUTTON_TEXT}
                            onPress={() => {
                                onConfirm?.(listData);
                            }}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default ReorganizeModal;
