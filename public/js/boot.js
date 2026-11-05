/* Выполняется синхронно в <head> до первой отрисовки:
   тема / язык / валюта из localStorage (без «мигания»), флаги прелоадера и шторки перехода. */
(function () {
  var html = document.documentElement;
  function get(storage, key) {
    try { return window[storage].getItem(key); } catch (e) { return null; }
  }
  function set(storage, key, value) {
    try { window[storage].setItem(key, value); } catch (e) { /* приватный режим — не критично */ }
  }

  var theme = get('localStorage', 'amf:theme');
  if (theme === 'amfibia' || theme === 'light' || theme === 'dark') html.setAttribute('data-theme', theme);
  var lang = get('localStorage', 'amf:lang');
  if (lang === 'ru' || lang === 'en') html.setAttribute('lang', lang);
  var currency = get('localStorage', 'amf:currency');
  if (currency === 'BYN' || currency === 'USD' || currency === 'EUR') html.setAttribute('data-currency', currency);

  html.classList.add('js');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) html.classList.add('reduced-motion');

  // ---------- Уровень производительности (правка П6) ----------
  // html.perf-low — облегчённый режим для слабого железа: без WebGL в hero, без Lenis, без следа изображений
  // и кастомного курсора, статичное зерно, сплошной фон вместо backdrop-filter, меньше ScrollTrigger-пинов.
  // Признаки: ≤ 4 ядер, ≤ 4 ГБ памяти, включена экономия трафика, нет WebGL, prefers-reduced-motion;
  // затем — замер FPS в первые 2,5 с после загрузки (меньше 40 кадров/с → perf-low).
  // Решение хранится в sessionStorage (amf:perf = low | ok); ?perf=low|high в адресе — принудительно (для проверки).
  var forced = (location.search.match(/[?&]perf=(low|high)/) || [])[1];
  if (forced) set('sessionStorage', 'amf:perf', forced === 'low' ? 'low' : 'ok');
  var perf = get('sessionStorage', 'amf:perf');
  var low = perf === 'low';
  if (perf === null) {
    var nav = window.navigator || {};
    var webgl = false;
    try {
      var probe = document.createElement('canvas');
      var ctx = probe.getContext('webgl') || probe.getContext('experimental-webgl');
      webgl = Boolean(ctx);
      var lose = ctx && ctx.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (e) { webgl = false; }
    low = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4 ||
      Boolean(nav.connection && nav.connection.saveData) || !webgl || reduced;
    if (low) set('sessionStorage', 'amf:perf', 'low');
  }
  if (low) html.classList.add('perf-low');
  // Замер FPS: только если по «железу» устройство не слабое и решение ещё не принято
  if (!low && perf === null && window.requestAnimationFrame && window.performance) {
    window.addEventListener('load', function () {
      window.setTimeout(function () {
        if (document.hidden) return;
        var frames = 0;
        var start = performance.now();
        var tick = function (now) {
          frames += 1;
          if (now - start < 2500) return window.requestAnimationFrame(tick);
          var fps = (frames * 1000) / (now - start);
          if (document.hidden) return; // во фоновой вкладке замер недостоверен — повторим на следующей странице
          if (fps < 40) {
            html.classList.add('perf-low');
            set('sessionStorage', 'amf:perf', 'low');
            document.dispatchEvent(new CustomEvent('amf:perf-low', { detail: { fps: Math.round(fps) } }));
          } else {
            set('sessionStorage', 'amf:perf', 'ok');
          }
        };
        window.requestAnimationFrame(tick);
      }, 600);
    });
  }

  // Прелоадер — только при первом заходе за сессию (раздел 10.4 ТЗ)
  if (!reduced && !get('sessionStorage', 'amf:preloaded') && !html.hasAttribute('data-no-preloader')) {
    html.classList.add('is-preloading');
  } else if (get('sessionStorage', 'amf:transition') === '1') {
    // Пришли по ссылке со шторкой — новая страница открывается под закрытой шторкой
    html.classList.add('is-entering');
  }
  set('sessionStorage', 'amf:transition', '0');

  // Страховка: если что-то пошло не так, страница всё равно откроется
  window.setTimeout(function () {
    if (html.classList.contains('is-entering') || html.classList.contains('is-preloading')) {
      html.classList.remove('is-entering', 'is-preloading');
    }
  }, 7000);
})();
