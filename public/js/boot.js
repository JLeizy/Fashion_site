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
