import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'src-tauri/*'],
    include: ['src\/**\/*.{test,spec}.?(c|m)[jt]s?(x)'],
    coverage: {
      include: ['src'],
      exclude: [...configDefaults.exclude, 'src-tauri/*'],
    },
  },
});
