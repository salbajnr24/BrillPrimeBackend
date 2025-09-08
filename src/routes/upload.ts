import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticateToken } from '../utils/auth';
import { logger } from '../utils/logger';
import { validateRequest } from '../utils/validation-middleware';
import { z } from 'zod';

const router = express.Router();

// Ensure upload directories exist
const ensureDirectoryExists = async (dirPath: string) => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

// Configure multer for different file types
const createMulterConfig = (destination: string, allowedTypes: string[]) => {
  return multer({
    storage: multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadPath = path.join('uploads', destination);
        await ensureDirectoryExists(uploadPath);
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        const fileName = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
        cb(null, fileName);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
  });
};

// Multer configurations
const imageUpload = createMulterConfig('images', [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
]);

const documentUpload = createMulterConfig('documents', [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png'
]);

// Validation schemas
const fileInfoSchema = z.object({
  type: z.enum(['images', 'documents', 'qr-codes', 'receipts']),
  filename: z.string(),
});


// Upload single image
router.post('/image', authenticateToken, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/images/${req.file.filename}`;
    logger.info(`Image uploaded: ${req.file.filename}`, { userId: req.user?.id });

    res.json({
      message: 'Image uploaded successfully',
      imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    logger.error('Upload image error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload multiple images
router.post('/images', authenticateToken, imageUpload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const files = req.files as Express.Multer.File[];
    const uploadedImages = files.map(file => ({
      imageUrl: `/uploads/images/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
    }));
    logger.info(`${files.length} images uploaded`, { userId: req.user?.id });

    res.json({
      message: 'Images uploaded successfully',
      images: uploadedImages,
    });
  } catch (error) {
    logger.error('Upload images error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload document
router.post('/document', authenticateToken, documentUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }

    const documentUrl = `/uploads/documents/${req.file.filename}`;
    logger.info(`Document uploaded: ${req.file.filename}`, { userId: req.user?.id });

    res.json({
      message: 'Document uploaded successfully',
      documentUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    logger.error('Upload document error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete uploaded file
router.delete('/:type/:filename', authenticateToken, validateRequest(fileInfoSchema), async (req, res) => {
  try {
    const { type, filename } = req.params;

    const filePath = path.join('uploads', type, filename);

    // Check if file exists and delete it
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      logger.info(`File deleted: ${filename} of type ${type}`, { userId: req.user?.id });
      res.json({ message: 'File deleted successfully' });
    } catch (err) {
      if (err.code === 'ENOENT') {
        logger.warn(`Attempted to delete non-existent file: ${filename}`, { userId: req.user?.id });
        return res.status(404).json({ error: 'File not found' });
      }
      logger.error('Delete file error:', { error: err.message, userId: req.user?.id });
      res.status(500).json({ error: 'Internal server error' });
    }
  } catch (error) {
    // This catch block is for validation errors from validateRequest
    logger.error('Delete file request validation error:', { error: error.message });
    res.status(400).json({ error: error.errors || 'Invalid request parameters' });
  }
});

// Get file info
router.get('/info/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;

    if (!['images', 'documents'].includes(type)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    const filePath = path.join('uploads', type, filename);

    // Check if file exists
    try {
      const stats = await fs.stat(filePath);
      logger.info(`File info requested: ${filename}`, { userId: req.user?.id });

      res.json({
        filename,
        url: `/uploads/${type}/${filename}`,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        logger.warn(`Attempted to access info for non-existent file: ${filename}`, { userId: req.user?.id });
        return res.status(404).json({ error: 'File not found' });
      }
      logger.error('Get file info error:', { error: err.message, userId: req.user?.id });
      res.status(500).json({ error: 'Internal server error' });
    }
  } catch (error) {
    logger.error('Get file info request validation error:', { error: error.message });
    res.status(400).json({ error: error.errors || 'Invalid request parameters' });
  }
});

// Serve uploaded files (static file serving)
router.get('/:type/:filename', (req, res) => {
  const { type, filename } = req.params;

  if (!['images', 'documents'].includes(type)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  const filePath = path.join('uploads', type, filename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    logger.warn(`Attempted to serve non-existent file: ${filename}`, { userId: req.user?.id });
    return res.status(404).json({ error: 'File not found' });
  }

  // Set appropriate headers
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  // Send file
  res.sendFile(filePath);
});

export default router;