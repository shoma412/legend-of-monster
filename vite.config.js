import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // GitHub Pages は https://ユーザー名.github.io/リポジトリ名/ で配信されるので、相対パスで読み込む
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    testTimeout: 60000, // スキルツリー（760マス）の検査は、種を何十個も作るので、時間がかかる
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
