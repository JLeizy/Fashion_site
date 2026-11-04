// Корневой роутер REST API (/api/...). Здесь подключаются все разделы API.
import express from 'express';
import { checkConnection } from '../../../db/pool.js';
import authRouter from './auth.js';
import catalogRouter from './catalog.js';
import productsRouter from './products.js';
import cartRouter from './cart.js';
import wishlistRouter from './wishlist.js';
import compareRouter from './compare.js';
import notificationsRouter from './notifications.js';
import miscRouter from './misc.js';
import homeRouter from './home.js';
import ordersRouter from './orders.js';
import addressesRouter from './addresses.js';
import accountRouter from './account.js';
import sellerRouter from './seller.js';
import warehouseRouter from './warehouse.js';
import courierRouter from './courier.js';
import supportRouter from './support.js';
import adminRouter from './admin.js';
import adminRefsRouter from './adminRefs.js';
import historyRouter from './history.js';

const api = express.Router();

// GET /api/health — проверка работы сервера и подключения к БД (роль: любая, включая гостя)
// Таблицы: не используются (служебный запрос version())
api.get('/health', async (req, res) => {
  const db = await checkConnection();
  res.json({ ok: true, database: db.database, postgres: db.version.split(' on ')[0], lang: req.lang });
});

api.use('/auth', authRouter);
api.use('/', catalogRouter);
api.use('/products', productsRouter);
api.use('/cart', cartRouter);
api.use('/wishlist', wishlistRouter);
api.use('/compare', compareRouter);
api.use('/notifications', notificationsRouter);
api.use('/', miscRouter);
api.use('/', homeRouter);
api.use('/', ordersRouter);
api.use('/addresses', addressesRouter);
api.use('/', accountRouter);
api.use('/', historyRouter);
// Кабинеты сотрудников (этап 13): права проверяются внутри каждого роутера через checkRole
api.use('/seller', sellerRouter);
api.use('/warehouse', warehouseRouter);
api.use('/courier', courierRouter);
api.use('/support', supportRouter);
// Админ-панель (этап 14): модерация и заказы — admin.js, справочники — adminRefs.js (только owner)
api.use('/admin', adminRouter);
api.use('/admin', adminRefsRouter);

export default api;
