/**
 * 顶部红条右侧的公众号二维码入口。
 * 只在验证后进入的版本页面加载；点击弹出胜采公园巡游者公众号二维码。
 */
export function initQrModal() {
  const trigger = document.querySelector('[data-qr-open]');
  if (!trigger || document.querySelector('.qr-modal')) return;

  const modal = document.createElement('div');
  modal.className = 'qr-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="qr-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-title">
      <button class="qr-close" type="button" data-qr-close aria-label="关闭二维码">×</button>
      <p class="qr-kicker" id="qr-title">胜采公园巡游者</p>
      <img class="qr-image" src="assets/img/erweima.jpg"
        alt="胜采公园巡游者公众号二维码" width="430" height="430" loading="lazy">
      <p class="qr-caption">公众号 · 扫码关注</p>
    </div>`;
  document.body.appendChild(modal);

  const closeButton = modal.querySelector('[data-qr-close]');

  const close = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('qr-open');
    trigger.focus();
  };

  const open = () => {
    modal.hidden = false;
    document.body.classList.add('qr-open');
    if (closeButton) closeButton.focus();
  };

  trigger.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) close();
  });
}
