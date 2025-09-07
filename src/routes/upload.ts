import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '../../uploads');
const imagesDir = path.join(uploadsDir, 'images');
const documentsDir = path.join(uploadsDir, 'documents');

[uploadsDir, imagesDir, documentsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadType = req.body.uploadType || 'images';
    const dir = uploadType === 'document' ? documentsDir : imagesDir;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${uuidv4()}-${Date.now()}`;
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const uploadType = req.body.uploadType || 'image';
  
  if (uploadType === 'image') {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  } else if (uploadType === 'document') {
    // Accept documents (PDF, DOC, DOCX, etc.)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word documents, and images are allowed'), false);
    }
  } else {
    cb(new Error('Invalid upload type'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Upload single image
router.post('/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/images/${req.file.filename}`;
    
    res.json({
      message: 'Image uploaded successfully',
      imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload multiple images
router.post('/images', authenticateToken, upload.array('images', 5), async (req, res) => {
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

    res.json({
      message: 'Images uploaded successfully',
      images: uploadedImages,
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload document
router.post('/document', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }

    const documentUrl = `/uploads/documents/${req.file.filename}`;
    
    res.json({
      message: 'Document uploaded successfully',
      documentUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete uploaded file
router.delete('/:type/:filename', authenticateToken, async (req, res) => {
  try {
    const { type, filename } = req.params;
    
    if (!['images', 'documents'].includes(type)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    const filePath = path.join(uploadsDir, type, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete the file
    fs.unlinkSync(filePath);
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get file info
router.get('/info/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    
    if (!['images', 'documents'].includes(type)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    const filePath = path.join(uploadsDir, type, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(filePath);
    
    res.json({
      filename,
      url: `/uploads/${type}/${filename}`,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
    });
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve uploaded files (static file serving)
router.get('/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  
  if (!['images', 'documents'].includes(type)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  const filePath = path.join(uploadsDir, type, filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Set appropriate headers
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
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