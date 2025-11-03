import { StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ScreenProps = ViewProps & { header?: boolean };

export function Screen({ children, header, style, ...rest }: ScreenProps) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <View
            {...rest}
            style={[
                {
                    flex: 1,
                    backgroundColor: theme.colors.background,
                    paddingTop: header ? 0 : insets.top,
                    paddingBottom: insets.bottom,
                    paddingLeft: insets.left,
                    paddingRight: insets.right,
                },
            ]}
        >
            <View style={{ flex: 1, ...StyleSheet.flatten(style) }}>
                {children}
            </View>
        </View>
    );
}
