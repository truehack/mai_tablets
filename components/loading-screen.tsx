import { Screen } from '@/components/screen';
import { ViewProps } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

export function LoadingScreen({ children, style, ...rest }: ViewProps) {
    return (
        <Screen
            {...rest}
            style={{
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <ActivityIndicator />
        </Screen>
    );
}
