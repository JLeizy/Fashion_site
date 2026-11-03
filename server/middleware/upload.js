// Загрузка файлов через multer (раздел 15 ТЗ): только изображения, ограничение размера.
// Файлы сохраняются в public/uploads/<папка>/, путь затем записывается в БД
// (users.avatar, product_images.url, return_requests.photo).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../../config/index.js';
import { ApiError } from '../lib/errors.js';

const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function storageFor(folder) {
  const dir = path.join(config.uploads.dir, folder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
  });
}

// Фильтр по MIME-типу (SVG запрещён — он может содержать скрипты)
function imageFilter(req, file, cb) {
  if (ALLOWED[file.mimetype]) return cb(null, true);
  cb(new ApiError(400, 'errors.fileType'));
}

// Проверка «магических байтов» уже сохранённого файла: MIME из заголовка можно подделать
function hasImageSignature(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const head = Buffer.alloc(12);
  fs.readSync(fd, head, 0, 12, 0);
  fs.closeSync(fd);
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isGif = head.subarray(0, 4).toString('ascii') === 'GIF8';
  const isWebp = head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isGif || isWebp;
}

function makeUploader(folder, field, maxCount) {
  const uploader = multer({
    storage: storageFor(folder),
    fileFilter: imageFilter,
    limits: { fileSize: config.uploads.maxFileSizeMb * 1024 * 1024, files: maxCount },
  });
  const handler = maxCount === 1 ? uploader.single(field) : uploader.array(field, maxCount);

  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') return next(new ApiError(400, 'errors.fileTooLarge', { params: { mb: config.uploads.maxFileSizeMb } }));
          if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return next(new ApiError(400, 'errors.fileCount'));
        }
        return next(err);
      }
      const files = req.files || (req.file ? [req.file] : []);
      const bad = files.filter((file) => !hasImageSignature(file.path));
      if (bad.length) {
        files.forEach((file) => fs.rm(file.path, { force: true }, () => {}));
        return next(new ApiError(400, 'errors.fileType'));
      }
      // Публичный URL файла для записи в БД
      files.forEach((file) => {
        file.publicUrl = `/uploads/${folder}/${file.filename}`;
      });
      next();
    });
  };
}

export const uploadAvatar = makeUploader('avatars', 'avatar', 1);
export const uploadProductImages = makeUploader('products', 'images', 8);
export const uploadReturnPhoto = makeUploader('returns', 'photo', 1);
export const uploadTicketImage = makeUploader('tickets', 'image', 1);
export const uploadAdminImage = makeUploader('content', 'image', 1);

// Удаление ранее загруженного файла (только из public/uploads, чтобы не тронуть заглушки)
export function removeUploadedFile(publicUrl) {
  if (!publicUrl || !publicUrl.startsWith('/uploads/')) return;
  const filePath = path.join(config.root, 'public', publicUrl);
  if (filePath.startsWith(config.uploads.dir)) fs.rm(filePath, { force: true }, () => {});
}
