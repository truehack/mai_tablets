import { useEffect, useState, useCallback } from 'react';

type AsyncTask = () => Promise<any>;

interface UseLoadingOptions {
    tasks?: AsyncTask[];
    onComplete?: () => void;
    onError?: (error: unknown) => void;
}

export function useLoading({
    tasks = [],
    onComplete,
    onError,
}: UseLoadingOptions = {}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown | null>(null);

    const runTasks = useCallback(async () => {
        setLoading(true);
        try {
            for (const task of tasks) {
                const result = await task();

                if (result === false || result === 'STOP') {
                    break;
                }
            }

            onComplete?.();
        } catch (err) {
            console.warn('useLoading error:', err);
            setError(err);
            onError?.(err);
        } finally {
            setLoading(false);
        }
    }, [tasks, onComplete, onError]);

    useEffect(() => {
        runTasks();
    }, [runTasks]);

    return { loading, error, reload: runTasks, ready: !loading && !error };
}
