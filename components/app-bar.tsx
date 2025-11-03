import { Appbar } from 'react-native-paper';
import { useRouter } from 'expo-router';

export type AppBarProps = {
    title: string;
    back?: boolean;
    menu?: boolean;
};

export function AppBar({ title, back, menu }: AppBarProps) {
    const router = useRouter();

    return (
        <Appbar.Header mode="center-aligned">
            {back && <Appbar.BackAction onPress={() => router.back()} />}
            <Appbar.Content title={title} />
            {menu && <Appbar.Action icon="dots-vertical" />}
        </Appbar.Header>
    );
}
