import { useRouter } from 'expo-router';
import { useState } from 'react';

export function useNavigate() {
    const router = useRouter();
    const [noAnimation, setNoAnimation] = useState(false);

    function navigate(path: string, disable = false) {
        setNoAnimation(disable);
        //@ts-ignore
        router.replace(path);
    }

    return { noAnimation, navigate };
}
