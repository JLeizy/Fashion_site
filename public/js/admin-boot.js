/* Админ-панель: синхронно до первой отрисовки. Своя тема (по умолчанию тёмная — раздел 8 ТЗ), без прелоадера и шторки. */
(function () {
  var html = document.documentElement;
  var theme = null;
  try { theme = window.localStorage.getItem('amf:admin-theme'); } catch (e) { /* приватный режим */ }
  html.setAttribute('data-theme', theme === 'amfibia' || theme === 'light' || theme === 'dark' ? theme : 'dark');
  html.classList.remove('is-entering', 'is-preloading');
})();
