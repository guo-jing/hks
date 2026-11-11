// Keep the simulation in a classic script so its deterministic browser tests remain available.
try {
  const { BattleRenderer } = await import('./renderer.js');
  window.BattleRenderer = BattleRenderer;
  const script = document.createElement('script');
  script.src = './game.js';
  script.onerror = () => showFailure('游戏文件加载失败，请刷新页面重试。');
  document.body.append(script);
} catch (error) {
  console.error(error);
  showFailure('3D 引擎加载失败，请使用支持 WebGL 2 的浏览器并开启硬件加速。');
}
function showFailure(message) {
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');
  const content = document.createElement('div');
  content.className = 'welcome';
  const title = document.createElement('h1');
  title.textContent = '战场暂未加载';
  const description = document.createElement('p');
  description.textContent = message;
  content.append(title, description);
  overlay.replaceChildren(content);
}
window.addEventListener('error', event => {
  if (/WebGL|context|BattleRenderer/.test(event.message)) showFailure('无法初始化 3D 战场，请开启浏览器硬件加速后刷新。');
});
