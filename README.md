# 海克斯大乱斗 · Hex Arena

无框架、无运行时依赖的原创浏览器生存竞技场。运行 `npm start`，打开 http://localhost:5173；也可以直接打开 index.html。

- WASD / 方向键移动，自动攻击最近敌人。
- 空格冲刺，Q 释放范围新星，P 暂停。
- 收集晶体升级，三选一强化，可重复叠加。
- 每 30 秒升级敌人波次；180 秒后生成最终守卫，击败后获胜。
- 支持触屏摇杆和技能按钮，最高击败数保存在当前浏览器。

`npm run check` 检查 JavaScript 语法。游戏为原创原型，不使用官方角色、素材或联网服务。字体加载失败时自动使用系统字体。

## GitHub Pages 部署

在仓库 Settings → Pages → Build and deployment 中，将 Source 设为 **GitHub Actions**。
首次启用后，在 Actions 中选择 **Deploy game to GitHub Pages** → **Run workflow**，选择 `main` 分支运行。
之后每次推送到 `main` 都会自动检查并部署。发布产物仅包含游戏页面、样式和脚本。

部署成功后的地址：https://guo-jing.github.io/hks/
