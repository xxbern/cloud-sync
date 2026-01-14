
import esbuild from 'esbuild';
import fs from 'fs-extra';
import path from 'path';

const isDev = process.argv.includes('--dev');

async function build() {
  const distDir = path.resolve(process.cwd(), 'dist');
  
  console.log('🧹 Cleaning dist directory...');
  await fs.remove(distDir);
  await fs.ensureDir(distDir);

  console.log('🚀 Bundling scripts (Full Local Bundle)...');
  await esbuild.build({
    entryPoints: ['index.tsx'],
    bundle: true,
    outfile: path.join(distDir, 'index.js'),
    format: 'esm',
    minify: !isDev,
    sourcemap: isDev,
    // 移除 external，确保 react, react-dom, gemini 等都被打入 index.js
    external: [], 
    define: {
      'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
      'process.env.API_KEY': '""' // 实际使用时通过环境变量注入或代码替换
    },
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts'
    }
  });

  console.log('📄 Processing HTML...');
  let html = await fs.readFile('index.html', 'utf8');
  // 移除远程 CDN 脚本
  html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/, '');
  // 移除 importmap
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
  // 确保引用本地打包后的 JS
  html = html.replace('index.tsx', 'index.js');
  
  await fs.writeFile(path.join(distDir, 'index.html'), html);

  console.log('📝 Copying Manifest...');
  await fs.copy('manifest.json', path.join(distDir, 'manifest.json'));
  await fs.copy('img', path.join(distDir, 'img'))

  console.log('✅ Build complete! Please run "npm install" before building.');
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
