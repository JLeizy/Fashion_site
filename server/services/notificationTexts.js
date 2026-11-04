// Тексты уведомлений на двух языках (таблица notifications хранит title_ru/en и text_ru/en).
import { ORDER_STATUS_LABELS } from '../lib/i18n.js';

const ORDER_STATUS_TEXT = {
  created: ['Мы получили ваш заказ и уже проверяем наличие.', 'We have received your order and are checking availability.'],
  confirmed: ['Заказ подтверждён и передан на склад.', 'Your order is confirmed and sent to the warehouse.'],
  assembling: ['Мы собираем ваш заказ.', 'We are assembling your order.'],
  assembled: ['Заказ собран и упакован.', 'Your order is assembled and packed.'],
  handed_to_delivery: ['Заказ передан в службу доставки.', 'Your order has been handed over for delivery.'],
  in_transit: ['Заказ в пути.', 'Your order is on its way.'],
  arrived: ['Заказ ждёт вас в пункте выдачи.', 'Your order is waiting at the pickup point.'],
  delivered: ['Заказ получен. Спасибо, что выбрали AMFIBIA!', 'Order received. Thank you for choosing AMFIBIA!'],
  cancelled: ['Заказ отменён. Если он был оплачен, деньги вернутся в течение 3–5 рабочих дней.', 'Your order has been cancelled. If it was paid, the refund will arrive within 3–5 business days.'],
  returned: ['Возврат оформлен. Деньги вернутся в течение 3–5 рабочих дней.', 'The return has been processed. The refund will arrive within 3–5 business days.'],
};

// Уведомление о смене статуса заказа
export function orderStatusNotification(status, orderNumber, orderId, comment = null) {
  const label = ORDER_STATUS_LABELS[status] || { ru: status, en: status };
  const [textRu, textEn] = ORDER_STATUS_TEXT[status] || ['', ''];
  return {
    type: 'order_status',
    title_ru: `Заказ ${orderNumber}: ${label.ru.toLowerCase()}`,
    title_en: `Order ${orderNumber}: ${label.en.toLowerCase()}`,
    text_ru: comment ? `${textRu} ${comment}` : textRu,
    text_en: textEn,
    link: `/account/orders/${orderId}`,
  };
}

export function ticketReplyNotification(ticketId, subject) {
  return {
    type: 'ticket_reply',
    title_ru: 'Ответ поддержки',
    title_en: 'Support replied',
    text_ru: `Поддержка ответила на обращение «${subject}».`,
    text_en: `Support has replied to your request “${subject}”.`,
    link: `/account/support/${ticketId}`,
  };
}

export function productModerationNotification(productId, productName, approved, reason = '') {
  return {
    type: 'product_moderation',
    title_ru: approved ? 'Товар опубликован' : 'Товар отклонён',
    title_en: approved ? 'Product published' : 'Product rejected',
    text_ru: approved ? `«${productName}» прошёл модерацию и опубликован.` : `«${productName}» отклонён. Причина: ${reason}`,
    text_en: approved ? `“${productName}” passed moderation and is now live.` : `“${productName}” was rejected. Reason: ${reason}`,
    link: `/account/shop/products/${productId}`,
  };
}

export function sellerApplicationNotification(approved, shopName, comment = '') {
  return {
    type: 'seller_application',
    title_ru: approved ? 'Заявка продавца одобрена' : 'Заявка продавца отклонена',
    title_en: approved ? 'Seller application approved' : 'Seller application rejected',
    text_ru: approved ? `Магазин «${shopName}» открыт. Добавляйте товары в кабинете продавца.` : `Заявка магазина «${shopName}» отклонена. ${comment}`.trim(),
    text_en: approved ? `Your shop “${shopName}” is open. Add products in the seller dashboard.` : `The application for “${shopName}” was rejected. ${comment}`.trim(),
    link: approved ? '/account/shop' : '/account/seller',
  };
}

export function returnDecisionNotification(returnId, orderNumber, approved, comment = '') {
  return {
    type: 'return_decision',
    title_ru: approved ? `Возврат по заказу ${orderNumber} одобрен` : `Возврат по заказу ${orderNumber} отклонён`,
    title_en: approved ? `Return for order ${orderNumber} approved` : `Return for order ${orderNumber} rejected`,
    text_ru: approved ? 'Передайте товар курьеру или в пункт выдачи — деньги вернутся после проверки.' : `Причина: ${comment}`,
    text_en: approved ? 'Hand the item to a courier or pickup point — the refund follows inspection.' : `Reason: ${comment}`,
    link: '/account/returns',
  };
}
