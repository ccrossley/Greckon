export function mountCountdownBar(panel: HTMLElement, deadlineMs: number): () => void {
  const wrap = document.createElement('div');
  wrap.className = 'countdown';

  const bar = document.createElement('div');
  bar.className = 'countdown-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');

  const fill = document.createElement('div');
  fill.className = 'countdown-bar-fill';
  bar.appendChild(fill);

  const label = document.createElement('p');
  label.className = 'countdown-label muted';

  wrap.append(bar, label);
  panel.appendChild(wrap);

  const deadline = Date.now() + deadlineMs;
  let frame = 0;

  const tick = () => {
    const remaining = Math.max(0, deadline - Date.now());
    const ratio = deadlineMs > 0 ? remaining / deadlineMs : 0;
    const percent = Math.round(ratio * 100);
    fill.style.width = `${percent}%`;
    bar.setAttribute('aria-valuenow', String(percent));
    label.textContent = `${(remaining / 1000).toFixed(1)}s remaining`;
    fill.classList.toggle('urgent', ratio > 0 && ratio < 0.25);
    if (remaining > 0) {
      frame = window.requestAnimationFrame(tick);
    } else {
      fill.style.width = '0%';
      bar.setAttribute('aria-valuenow', '0');
      label.textContent = 'Time expired';
    }
  };

  tick();

  return () => {
    window.cancelAnimationFrame(frame);
  };
}
