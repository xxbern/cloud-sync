
import esbuild from 'esbuild';
import fs from 'fs-extra';
import path from 'path';

const isDev = process.argv.includes('--dev');

async function build() {
  const distDir = path.resolve(process.cwd(), 'dist');
  
  // 1. 清理旧目录
  console.log('🧹 Cleaning dist directory...');
  await fs.remove(distDir);
  await fs.ensureDir(distDir);

  // 2. 使用 esbuild 编译 TSX
  console.log('🚀 Bundling scripts...');
  await esbuild.build({
    entryPoints: ['index.tsx'],
    bundle: true,
    outfile: path.join(distDir, 'index.js'),
    format: 'esm',
    minify: !isDev,
    sourcemap: isDev,
    // 将远程外部依赖排除，保持 index.html 中的 importmap 有效
    external: ['react', 'react-dom', '@google/genai'],
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts'
    }
  });

  // 3. 复制 HTML 并修改脚本引用
  console.log('📄 Copying assets...');
  let html = await fs.readFile('index.html', 'utf8');
  // 将 index.tsx 替换为编译后的 index.js
  html = html.replace('index.tsx', 'index.js');
  await fs.writeFile(path.join(distDir, 'index.html'), html);

  // 4. 复制 Manifest
  await fs.copy('manifest.json', path.join(distDir, 'manifest.json'));

  // 5. 如果有图标，复制图标（这里简单处理，没有则忽略）
  const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
  for (const icon of icons) {
    if (await fs.pathExists(icon)) {
      await fs.copy(icon, path.join(distDir, icon));
    }
  }

  console.log('✅ Build complete! Load the "dist" folder into Chrome.');
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
