const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { env } = require('../../config/env');
const { ApiError } = require('../../utils/apiError');

const uploadRoot = path.resolve(__dirname, '../../../', env.UPLOAD_DIR);
const patientDir = path.join(uploadRoot, 'patients');
fs.mkdirSync(patientDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, patientDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeBase = path.basename(file.originalname || 'file', ext).replace(/[^a-z0-9_-]/gi, '_').slice(0, 60);
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  }
});

const allowedMime = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain'
]);

const patientUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) return cb(new ApiError(400, 'Unsupported file type'));
    cb(null, true);
  }
});

module.exports = { patientUpload, uploadRoot };
