import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        include: ['./tests/**/*'],
        testTimeout: 15000,
        maxWorkers: 10,
        poolOptions: {
            threads: {
                maxThreads: 10,
                minThreads: 5,
            }
        }
    },
});