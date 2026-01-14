
# 如何在 Chrome 中测试 CloudSync Pro

由于这是一个 Chrome 扩展程序，您需要将代码编译并作为“已解压的扩展程序”加载。

### 1. 准备环境
确保您的电脑安装了 [Node.js](https://nodejs.org/)。

### 2. 安装依赖
在项目根目录运行：
```bash
npm install
```

### 3. 执行打包
运行构建脚本：
```bash
npm run build
```
这会在根目录下生成一个 `dist` 文件夹。

### 4. 加载到 Chrome
1. 打开 Chrome 浏览器，访问 `chrome://extensions/`。
2. 开启右上角的 **“开发者模式” (Developer mode)**。
3. 点击左上角的 **“加载已解压的扩展程序” (Load unpacked)**。
4. 在弹出的对话框中选择本项目下的 `dist` 文件夹。

### 5. 开始测试
点击 Chrome 工具栏中的拼图图标，找到 **CloudSync Pro** 并固定。点击图标即可打开管理后台。

---

*注意：如果遇到 API 权限问题，请确保已在设置中配置了正确的 GitHub Gist Token 或 WebDAV 地址。*
