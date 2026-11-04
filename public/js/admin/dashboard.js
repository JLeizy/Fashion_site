// Админка → Дашборд (раздел 8 ТЗ, роль owner): карточки — выручка за день / неделю / месяц, заказы, новые пользователи,
// средний чек (с изменением к прошлому периоду); графики Chart.js — продажи по дням, выручка по брендам, заказы по статусам,
// топ-10 товаров; последние заказы; товары с низким остатком. API: GET /api/admin/dashboard (представления v_sales_by_brand,
// v_top_products, v_low_stock).
import { $, esc } from '../core/dom.js';
import { t, loc, fmtDate, fmtNumber, fmtRelative } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice, refreshPrices } from '../core/currency.js';
import { statusBadge, loading } from '../account/common.js';
import { kpis, money, delta, loadChart, chartTheme, chartDefaults, seriesColors } from '../account/staff.js';

const STATUS_ORDER = ['created', 'confirmed', 'assembling', 'assembled', 'handed_to_delivery', 'in_transit', 'arrived', 'delivered', 'cancelled', 'returned'];

export async function render(view, ctx) {
  let days = Number(new URLSearchParams(location.search).get('days')) || 30;
  const charts = [];

  async function draw() {
    charts.splice(0).forEach((c) => c.destroy());
    view.innerHTML = loading();
    const [d, Chart] = await Promise.all([api.get('/admin/dashboard', { days }), loadChart()]);
    const k = d.kpi;
    ctx.setHead({ eyebrow: t('admin.dash.eyebrow', { date: fmtDate(new Date()) }), title: t('admin.nav.dashboard') });
    const totalOrders = Object.values(d.statuses).reduce((a, b) => a + b, 0);
    view.innerHTML = `
      ${kpis([
        { label: t('admin.dash.revDay'), value: money(k.revenueDay), delta: delta(k.revenueDay, k.revenueDayPrev) },
        { label: t('admin.dash.revWeek'), value: money(k.revenueWeek), delta: delta(k.revenueWeek, k.revenueWeekPrev) },
        { label: t('admin.dash.revMonth'), value: money(k.revenueMonth), delta: delta(k.revenueMonth, k.revenueMonthPrev), tone: 'accent' },
        { label: t('admin.dash.orders'), value: fmtNumber(k.ordersMonth), delta: delta(k.ordersMonth, k.ordersMonthPrev) },
        { label: t('admin.dash.newUsers'), value: fmtNumber(k.newUsers), delta: delta(k.newUsers, k.newUsersPrev) },
        { label: t('admin.dash.avg'), value: money(k.avg), delta: delta(k.avg, k.avgPrev) },
      ])}
      <div class="stats-head">
        <p class="t-muted">${esc(t('admin.dash.note'))}</p>
        <div class="seg" role="group" aria-label="${esc(t('staff.stats.periodLabel'))}">${[7, 30, 90, 365].map((n) => `<button type="button" data-days="${n}" aria-pressed="${n === days}">${n} ${esc(t('staff.stats.d'))}</button>`).join('')}</div>
      </div>
      <div class="charts adm-charts">
        <figure class="chart chart--wide" data-reveal><figcaption class="chart__cap"><span class="t-mono">01</span>${esc(t('admin.dash.byDay'))}</figcaption><div class="chart__box"><canvas data-c-daily role="img" aria-label="${esc(t('admin.dash.byDay'))}"></canvas></div></figure>
        <figure class="chart" data-reveal><figcaption class="chart__cap"><span class="t-mono">02</span>${esc(t('admin.dash.byBrand'))}</figcaption><div class="chart__box chart__box--tall"><canvas data-c-brands role="img" aria-label="${esc(t('admin.dash.byBrand'))}"></canvas></div></figure>
        <figure class="chart" data-reveal><figcaption class="chart__cap"><span class="t-mono">03</span>${esc(t('admin.dash.byStatus'))}<span class="chart__total t-mono">${fmtNumber(totalOrders)}</span></figcaption><div class="chart__box chart__box--tall"><canvas data-c-status role="img" aria-label="${esc(t('admin.dash.byStatus'))}"></canvas></div></figure>
        <figure class="chart chart--wide" data-reveal><figcaption class="chart__cap"><span class="t-mono">04</span>${esc(t('admin.dash.top'))}</figcaption>
          <ol class="adm-top10">${d.top
            .map(
              (p, i) => `<li><span class="adm-top10__n">${String(i + 1).padStart(2, '0')}</span><img src="${esc(p.image)}" alt="" loading="lazy">
                <span class="adm-top10__body"><a href="/product/${p.id}" target="_blank" rel="noopener">${esc(loc(p.name))}</a><span class="t-mono t-muted">${esc(p.brand)} · ${esc(p.sku)}</span>
                <span class="toplist__bar" style="--w:${Math.max(4, (p.units / (d.top[0]?.units || 1)) * 100)}%"></span></span>
                <span class="adm-top10__units t-mono">${p.units} ${esc(t('common.pcs'))}</span><span class="t-mono">${money(p.revenue)}</span></li>`
            )
            .join('')}</ol></figure>
        <section class="chart" data-reveal><header class="chart__cap"><span class="t-mono">05</span>${esc(t('admin.dash.recent'))}<a class="link-u t-mono chart__more" href="/admin/orders" data-adm-link>${esc(t('admin.dash.allOrders'))}</a></header>
          <ul class="adm-recent">${d.recent
            .map((o) => `<li><a href="/admin/orders/${o.id}" data-adm-link><b class="t-mono">${esc(o.orderNumber)}</b><span>${esc(o.customer)}<i class="t-mono">${esc(fmtRelative(o.createdAt))}</i></span>${statusBadge(o.status)}<span class="t-mono">${money(o.total)}</span></a></li>`)
            .join('')}</ul></section>
        <section class="chart" data-reveal><header class="chart__cap"><span class="t-mono">06</span>${esc(t('admin.dash.low'))}<a class="link-u t-mono chart__more" href="/account/stock?low=1">${esc(t('admin.dash.toStock'))}</a></header>
          <ul class="adm-low">${d.lowStock
            .map((l) => `<li><span><a href="/product/${l.productId}" target="_blank" rel="noopener">${esc(loc(l.name))}</a><i class="t-mono">${esc(l.brand)} · ${esc(l.sku)} · ${esc(l.city)}</i></span><b class="stock-av is-low t-mono">${l.available}</b></li>`)
            .join('')}</ul></section>
      </div>`;

    const c = chartTheme();
    chartDefaults(Chart, c);
    const daily = $('[data-c-daily]', view).getContext('2d');
    const grad = daily.createLinearGradient(0, 0, 0, 340);
    grad.addColorStop(0, `${c.accent}66`);
    grad.addColorStop(1, `${c.accent}00`);
    charts.push(
      new Chart(daily, {
        data: {
          labels: d.daily.map((x) => fmtDate(x.day, { day: 'numeric', month: 'short' })),
          datasets: [
            { type: 'line', label: t('staff.stats.revenue'), data: d.daily.map((x) => x.revenue), borderColor: c.accent, backgroundColor: grad, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, yAxisID: 'y' },
            { type: 'bar', label: t('admin.dash.orders'), data: d.daily.map((x) => x.orders), backgroundColor: `${c.silver}40`, borderRadius: 1, yAxisID: 'y1', barPercentage: 0.6 },
          ],
        },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } }, y: { grid: { color: c.line }, ticks: { callback: (v) => formatPrice(v).replace(/[,.]00(?=\D*$)/, '') } }, y1: { position: 'right', grid: { display: false }, ticks: { precision: 0 } } },
          plugins: { tooltip: { callbacks: { label: (it) => (it.datasetIndex === 0 ? ` ${formatPrice(it.raw)}` : ` ${it.raw}`) } } },
        },
      })
    );
    const brands = d.brands.filter((b) => b.revenue > 0);
    charts.push(
      new Chart($('[data-c-brands]', view), {
        type: 'bar',
        data: { labels: brands.map((b) => b.name), datasets: [{ label: t('staff.stats.revenue'), data: brands.map((b) => b.revenue), backgroundColor: brands.map((b) => `${b.accent}cc`), borderColor: brands.map((b) => b.accent), borderWidth: 1, borderRadius: 1 }] },
        options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => ` ${formatPrice(it.raw)} · ${brands[it.dataIndex].units} ${t('common.pcs')}` } } }, scales: { x: { grid: { color: c.line }, ticks: { callback: (v) => formatPrice(v).replace(/[,.]00(?=\D*$)/, '') } }, y: { grid: { display: false }, ticks: { font: { family: c.display, size: 13 }, color: c.text2 } } } },
      })
    );
    const st = STATUS_ORDER.filter((s) => d.statuses[s]);
    charts.push(
      new Chart($('[data-c-status]', view), {
        type: 'doughnut',
        data: { labels: st.map((s) => t(`statuses.${s}`)), datasets: [{ data: st.map((s) => d.statuses[s]), backgroundColor: [...seriesColors(c), c.line2, c.text], borderColor: c.surface, borderWidth: 2 }] },
        options: { maintainAspectRatio: false, cutout: '66%', plugins: { legend: { position: 'right' } } },
      })
    );
    refreshPrices(view);
  }

  await draw();
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-days]');
    if (!b) return;
    days = Number(b.dataset.days);
    history.replaceState(null, '', `/admin?days=${days}`);
    await draw();
  });
  const onTheme = () => setTimeout(() => draw().catch(() => {}), 120);
  document.addEventListener('amf:themechange', onTheme);
  return () => {
    document.removeEventListener('amf:themechange', onTheme);
    charts.forEach((c) => c.destroy());
  };
}
