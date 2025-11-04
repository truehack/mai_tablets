import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useDatabase } from '@/hooks/use-database';

export default function Index() {
    const router = useRouter();
    const db = useDatabase();

    useEffect(() => {
        let redirected = false;

        (async () => {
            try {
                const onboardingViewed =
                    await AsyncStorage.getItem('onboarding_viewed');
                if (onboardingViewed !== 'true') {
                    redirected = true;
                    router.navigate('/onboarding/screen-1');
                    return;
                }

                const user = await db.getLocalUser();
                if (!user) {
                    redirected = true;
                    router.navigate('/login');
                    return;
                }

                if (!redirected) {
                    router.navigate('/tabs/schedule');
                }
            } catch (e) {
                console.warn('Redirect check failed', e);
            }
        })();
    }, [db, router]);

    return null;
}
