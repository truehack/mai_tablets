import { DefaultTheme, useTheme } from 'react-native-paper';
import { StyleSheet } from 'react-native';
import { useMemo } from 'react';

export function useThemedStyles<
    T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>,
>(makeStyles: (theme: typeof DefaultTheme) => T): T {
    const theme = useTheme();

    return useMemo(
        () => StyleSheet.create(makeStyles(theme)),
        [theme, makeStyles],
    );
}
