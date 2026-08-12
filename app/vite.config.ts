import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' : build portable (GitHub Pages, sous-dossier…)
// fs.allow '..' : les JSON de data/processed/ vivent à la racine du dépôt
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    fs: { allow: ['..'] },
  },
})
