// https://docs.expo.dev/guides/using-eslint/
// @ts-check
import { defineConfig } from 'eslint/config';

import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-plugin-prettier/recommended';

export default defineConfig([
    expoConfig,
    // @ts-ignore
    prettierConfig,
    {
        files: ['**/*.ts', '**/*.tsx'],
    },
]);
