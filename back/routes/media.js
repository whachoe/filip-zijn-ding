const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function getUserUploadDirectory(userId) {
  const numericUserId = Number(userId);
  if (!Number.isSafeInteger(numericUserId) || numericUserId <= 0) {
    throw new Error('Invalid authenticated user ID');
  }
  return path.join(uploadDir, String(numericUserId));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      // Never use multipart fields to form a filesystem path. The directory is
      // scoped only to the authenticated user, whose ID came from a verified JWT.
      const userDir = getUserUploadDirectory(req.user.id);
      fs.mkdirSync(userDir, { recursive: true });
      cb(null, userDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext);
      const dir = getUserUploadDirectory(req.user.id);
      let name = base + ext;
      let counter = 1;
      while (fs.existsSync(path.join(dir, name))) {
        name = `${base}(${counter})${ext}`;
        counter++;
      }
      cb(null, name);
    } catch (error) {
      cb(error);
    }
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 // 100MB default
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs and zips
    const allowedTypes = /jpeg|jpg|png|gif|pdf|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images,PDFs and ZIP files are allowed'));
    }
  }
});

// Upload file
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { assessmentId } = req.body;
    if (!assessmentId) {
      return res.status(400).json({ error: 'Assessment ID required' });
    }

    // Verify assessment belongs to user
    const assessmentCheck = await db.query(
      'SELECT id FROM assessments WHERE id = $1 AND user_id = $2',
      [assessmentId, req.user.id]
    );

    if (assessmentCheck.rows.length === 0) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Save media record
    const result = await db.query(
      'INSERT INTO media (assessment_id, filename, filepath, file_type, file_size) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [
        assessmentId,
        req.file.originalname,
        req.file.path,
        req.file.mimetype,
        req.file.size
      ]
    );

    const media = result.rows[0];

    res.status(201).json({
      message: 'File uploaded successfully',
      media: {
        id: media.id,
        filename: media.filename,
        fileType: media.file_type,
        fileSize: media.file_size,
        url: `/api/media/${media.id}`,
        uploadedAt: media.uploaded_at
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Download file
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*, a.user_id FROM media m 
       JOIN assessments a ON m.assessment_id = a.id 
       WHERE m.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const media = result.rows[0];

    // Verify user has access
    if (media.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(media.filepath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(media.filepath, media.filename);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'File download failed' });
  }
});

// Get media for assessment
router.get('/assessment/:assessmentId', async (req, res) => {
  try {
    // Verify assessment belongs to user
    const assessmentCheck = await db.query(
      'SELECT id FROM assessments WHERE id = $1 AND user_id = $2',
      [req.params.assessmentId, req.user.id]
    );

    if (assessmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const result = await db.query(
      'SELECT id, filename, file_type, file_size, uploaded_at FROM media WHERE assessment_id = $1 ORDER BY uploaded_at DESC',
      [req.params.assessmentId]
    );

    const media = result.rows.map(m => ({
      id: m.id,
      filename: m.filename,
      fileType: m.file_type,
      fileSize: m.file_size,
      url: `/api/media/${m.id}`,
      uploadedAt: m.uploaded_at
    }));

    res.json({ media });
  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({ error: 'Failed to get media' });
  }
});

// Delete media
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*, a.user_id FROM media m 
       JOIN assessments a ON m.assessment_id = a.id 
       WHERE m.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const media = result.rows[0];

    // Verify user has access
    if (media.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file from filesystem
    if (fs.existsSync(media.filepath)) {
      fs.unlinkSync(media.filepath);
    }

    // Delete from database
    await db.query('DELETE FROM media WHERE id = $1', [req.params.id]);

    res.json({ message: 'File deleted', id: req.params.id });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ error: 'File deletion failed' });
  }
});

module.exports = router;
