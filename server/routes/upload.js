const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Ensure upload directories exist
['images', 'videos', 'audio', 'files', 'avatars'].forEach(dir => {
  const fullPath = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mime = file.mimetype;
    let folder = 'files';
    if (mime.startsWith('image/')) folder = 'images';
    else if (mime.startsWith('video/')) folder = 'videos';
    else if (mime.startsWith('audio/')) folder = 'audio';
    cb(null, path.join(UPLOAD_DIR, folder));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/ogg',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip', 'text/plain'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, 'avatars')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed for avatars'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Upload file(s) for messages
router.post('/media', authMiddleware, upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const files = req.files.map(file => {
    const mime = file.mimetype;
    let type = 'file';
    if (mime.startsWith('image/')) type = 'image';
    else if (mime.startsWith('video/')) type = 'video';
    else if (mime.startsWith('audio/')) type = 'audio';

    const subfolder = type === 'image' ? 'images' : type === 'video' ? 'videos' : type === 'audio' ? 'audio' : 'files';

    return {
      id: uuidv4(),
      type,
      name: file.originalname,
      url: `/uploads/${subfolder}/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype
    };
  });

  res.json({ files });
});

// Upload avatar
router.post('/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { getDB } = require('../db');
  const db = getDB();
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.user.id);

  res.json({ avatar: avatarUrl });
});

// Upload server icon
router.post('/server-icon', authMiddleware, avatarUpload.single('icon'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const iconUrl = `/uploads/avatars/${req.file.filename}`;
  res.json({ icon: iconUrl });
});

router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 50MB' });
  }
  res.status(400).json({ error: err.message });
});

module.exports = router;
