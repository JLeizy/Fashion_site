// Трек-номер в формате UPU S10: 2 буквы + 8 цифр + контрольная цифра + код страны.
// Пример: AF12345678 5 BY → AF123456785BY. Используется при оформлении заказа и в seed.js.
import crypto from 'node:crypto';

const WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7];

export function checkDigit(serial8) {
  const sum = String(serial8)
    .padStart(8, '0')
    .split('')
    .reduce((acc, digit, i) => acc + Number(digit) * WEIGHTS[i], 0);
  const check = 11 - (sum % 11);
  if (check === 10) return 0;
  if (check === 11) return 5;
  return check;
}

export function makeTrackingNumber(serial) {
  const digits = String(serial).padStart(8, '0').slice(-8);
  return `AF${digits}${checkDigit(digits)}BY`;
}

export function randomTrackingNumber() {
  return makeTrackingNumber(crypto.randomInt(0, 100_000_000));
}

// Проверка формата и контрольной цифры (публичная страница /tracking)
export function isValidTrackingNumber(value) {
  const match = /^AF(\d{8})(\d)BY$/.exec(String(value || '').trim().toUpperCase());
  return Boolean(match) && checkDigit(match[1]) === Number(match[2]);
}
