import React from 'react';
import {
    Dimensions, TextStyle, TouchableOpacity, View, ViewStyle,
} from 'react-native';
import borderRadius from '../constants/BorderRadius';
import Spacing from '../constants/Spacing';
import Shadow from '../styles/Shadow';
import { Text, useStyleTheme } from '../styles/Theme';

interface Props {
    readonly barType?: 'solid' | 'increment';
    readonly yAxisLabels: string[];
    readonly xAxisLabels: string[];
    readonly getBarHeightForLabel?: (xAxisLabel: string) => number;
    readonly getBarStyleForLabel?: (xAxisLabel: string) => ViewStyle;
    readonly getXAxisLabelStyle?: (xAxisLabel: string) => TextStyle;
    readonly getNumberOfItemsForLabel?: (xAxisLabel: string) => number;
    readonly xAxisLeftMarginMultiplier?: number;
    readonly title?: string;
    readonly label1?: string;
    readonly label2?: string;
    readonly onLabelsPressed?: () => void;
}

export const BAR_GRAPH_MAX_HEIGHT = 150;

const BarGraph = (props: Props) => {
    const {
        getBarHeightForLabel = () => 0,
        getNumberOfItemsForLabel = () => 0,
        getBarStyleForLabel,
        getXAxisLabelStyle,
        barType = 'solid',
        xAxisLabels,
        yAxisLabels,
        xAxisLeftMarginMultiplier = 4,
        title,
        label1,
        label2,
        onLabelsPressed,
    } = props;

    const yAxisMaxValue = yAxisLabels.length;

    const graphHeight = BAR_GRAPH_MAX_HEIGHT;
    const rowItemHeight = graphHeight / yAxisMaxValue;
    const margin = Spacing.MEDIUM;
    const width = Dimensions.get('window').width - margin * 2;

    const yAxis = () => (
        <View
            style={{
                position: 'absolute',
                marginLeft: Spacing.MEDIUM,
                alignSelf: 'flex-start',
                marginTop: Spacing.MEDIUM,
                flexDirection: 'column',
                justifyContent: 'space-between',
            }}
        >
            {yAxisLabels.map((value) => <Text key={value} style={{ textAlign: 'right', fontWeight: '200', height: rowItemHeight }}>{value}</Text>)}
            <Text style={{ textAlign: 'right', fontWeight: '200', height: rowItemHeight }}>0</Text>
        </View>
    );

    const xAxisBarBlock = (height: number, label: string) => (
        <View style={[{
            marginBottom: Spacing.XX_SMALL,
            width: 25,
            alignSelf: 'center',
            height,
            borderRadius: 5,
        }, getBarStyleForLabel?.(label)]}
        />
    );

    const xAxisBar = (label: string) => {
        const bars = [];
        if (barType === 'increment') {
            const incrementItemHeight = (graphHeight / yAxisMaxValue) - 3;
            for (let i = 0; i < getNumberOfItemsForLabel(label); i++) {
                bars.push(xAxisBarBlock(incrementItemHeight, label));
            }
        }

        return (
            <View key={label} style={{ marginTop: 'auto' }}>
                {barType === 'solid' && xAxisBarBlock(getBarHeightForLabel(label), label)}
                {barType === 'increment' && bars}
                <Text style={[{ alignSelf: 'baseline', fontWeight: 'bold' }, getXAxisLabelStyle?.(label)]}>{label}</Text>
            </View>
        );
    };

    const xAxis = () => (
        <View
            style={{
                height: graphHeight + Spacing.LARGE,
                marginTop: Spacing.MEDIUM,
                marginLeft: Spacing.MEDIUM * xAxisLeftMarginMultiplier,
                marginRight: Spacing.LARGE,
                flexDirection: 'row',
                justifyContent: 'space-between',
            }}
        >
            {xAxisLabels.map((label) => xAxisBar(label))}
        </View>
    );

    const graph = () => (
        <View
            style={{
                height: 200,
            }}
        >
            {yAxis()}
            {xAxis()}
        </View>
    );

    return (
        <View style={{
            ...Shadow.CARD,
            marginLeft: margin,
            marginRight: margin,
            width,
            backgroundColor: useStyleTheme().colors.tertiary,
            borderRadius: borderRadius.SECTION,
            borderColor: useStyleTheme().colors.secondary,
            borderWidth: 1,
            marginBottom: Spacing.SMALL,
        }}
        >
            <Text style={{
                marginLeft: Spacing.SMALL,
                marginTop: Spacing.SMALL,
                marginBottom: Spacing.SMALL,
                fontWeight: 'bold',
            }}
            >
                {title}
            </Text>
            <TouchableOpacity
                style={{ position: 'absolute', right: 0 }}
                activeOpacity={onLabelsPressed ? 0.5 : 1}
                onPress={() => {
                    onLabelsPressed?.();
                }}
            >

                <Text style={{
                    alignSelf: 'flex-end',
                    marginRight: Spacing.SMALL,
                    marginTop: Spacing.SMALL,
                    fontWeight: '300',
                }}
                >
                    {label1}
                </Text>
                <Text style={{
                    alignSelf: 'flex-end',
                    marginRight: Spacing.SMALL,
                    marginTop: Spacing.XX_SMALL,
                    fontWeight: '300',
                }}
                >
                    {label2}
                </Text>
            </TouchableOpacity>
            {graph()}
        </View>
    );
};

export default BarGraph;
