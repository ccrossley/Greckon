import { STAT_KEYS } from '../types.js';
import { mountSplineChart } from './spline-chart.js';

export function mountStatsSplineTab(root: HTMLElement): void {
  const panel = document.createElement('div');
  panel.className = 'stats-tab';
  root.appendChild(panel);

  const dashboard = document.createElement('div');
  dashboard.className = 'stats-dashboard';
  panel.appendChild(dashboard);

  for (const stat of STAT_KEYS) {
    const cell = document.createElement('div');
    cell.className = 'stats-dashboard-cell';
    dashboard.appendChild(cell);
    mountSplineChart(cell, stat);
  }
}
