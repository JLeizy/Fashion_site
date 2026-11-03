// Аккордеоны (страница товара, служебные страницы, FAQ): кнопка .accordion__head переключает aria-expanded,
// высота раскрывается CSS-переходом grid-template-rows (см. components.css). Делегирование — один обработчик.
let bound = false;

export function initAccordions() {
  if (bound) return;
  bound = true;
  document.addEventListener('click', (e) => {
    const head = e.target.closest('.accordion__head');
    if (!head) return;
    const open = head.getAttribute('aria-expanded') !== 'true';
    // Внутри [data-accordion="single"] одновременно открыт только один пункт
    const group = head.closest('[data-accordion="single"]');
    if (group && open) {
      group.querySelectorAll('.accordion__head[aria-expanded="true"]').forEach((h) => h.setAttribute('aria-expanded', 'false'));
    }
    head.setAttribute('aria-expanded', String(open));
  });
}

export default initAccordions;
