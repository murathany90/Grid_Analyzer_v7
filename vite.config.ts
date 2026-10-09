import {defineConfig,type Plugin} from 'vite';
import {readFileSync} from 'node:fs';

/** Normalises text to LF so generated artifacts do not inherit the checkout's line endings. */
const toLf=(text:string):string=>text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');

// The inlined license text must not vary with the checkout platform either, since it ends
// up inside the byte-hashed artifact.
const kluLicense=toLf(readFileSync(new URL('./licenses/klu-js-LICENSE',import.meta.url),'utf8'));
const benchmarkLicenses=['saxes','xmlchars','noble-hashes'].map(name=>`${name}\n${toLf(readFileSync(new URL(`./licenses/${name}-LICENSE`,import.meta.url),'utf8'))}`).join('\n');
const licensePlugin:Plugin={
  name:'klu-license-notice',
  transformIndexHtml(html){return html.replace('</head>',`<!-- klu-js 0.1.0, LGPL-2.1-or-later; source: https://github.com/rwl/klu-js\n${kluLicense}\n${benchmarkLicenses}\n-->\n</head>`);},
};
/**
 * The portable artifact is hashed byte-for-byte, so its bytes must not depend on the
 * checkout platform.
 *
 * Source files carry the line endings of the machine that checked them out, and those
 * endings survive into the inlined HTML, JS and CSS. A CRLF checkout therefore produced a
 * different artifact than an LF one, and the committed hash could never match a CI build.
 * Normalising to LF here makes the output platform-independent, and `.gitattributes`
 * (`text eol=lf`) keeps the committed blob in the same form.
 */
const portablePlugin:Plugin={
  name:'portable-html',
  enforce:'post',
  generateBundle(_options,bundle){
    const html=bundle['index.html'];
    if(!html||html.type!=='asset')return;
    let source=toLf(String(html.source));
    for(const [name,item]of Object.entries(bundle)){
      if(item.type==='chunk'&&item.isEntry){
        source=source.replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/,()=>`<script type="module">${toLf(item.code).replace(/<\/script/gi,'<\\/script')}</script>`);
        delete bundle[name];
      }else if(item.type==='asset'&&name.endsWith('.css')){
        source=source.replace(/<link rel="stylesheet"[^>]*>/,()=>`<style>${toLf(String(item.source))}</style>`);
        delete bundle[name];
      }
    }
    delete bundle['index.html'];
    this.emitFile({type:'asset',fileName:'GridAnalyzer_v7.html',source});
  },
};

export default defineConfig(({mode})=>({
  base:'./',
  build:{
    target:'es2022',
    outDir:mode==='portable'?'dist-portable':'dist',
    assetsInlineLimit:Number.MAX_SAFE_INTEGER,
    cssCodeSplit:false,
    rollupOptions:{output:{inlineDynamicImports:true}},
  },
  plugins:mode==='portable'?[licensePlugin,portablePlugin]:[licensePlugin],
}));
