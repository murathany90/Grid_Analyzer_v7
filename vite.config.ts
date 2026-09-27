import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: 'es2022',
    outDir: mode === 'portable' ? 'dist-portable' : 'dist',
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  plugins: mode === 'portable' ? [{
    name: 'portable-html',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const [name, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.isEntry) {
          source = source.replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/,
            () => `<script type="module">${item.code.replace(/<\/script/gi, '<\\/script')}</script>`);
          delete bundle[name];
        } else if (item.type === 'asset' && name.endsWith('.css')) {
          source = source.replace(/<link rel="stylesheet"[^>]*>/,
            () => `<style>${String(item.source)}</style>`);
          delete bundle[name];
        }
      }
      delete bundle['index.html'];
      this.emitFile({ type: 'asset', fileName: 'GridAnalyzer_v7.html', source });
    },
  }] : [],
}));
