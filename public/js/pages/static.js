// Простые страницы (ошибки, информационные): только общая инициализация и открытие страницы.
import { initApp } from '../app.js';

const app = await initApp();
await app.reveal();
