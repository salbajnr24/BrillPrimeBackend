"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const auth_1 = require("../utils/auth");
const logger_1 = require("../utils/logger");
const validation_middleware_1 = require("../utils/validation-middleware");
const zod_1 = require("zod");
const router = express_1.default.Router();
// Ensure upload directories exist
const ensureDirectoryExists = async (dirPath) => {
    try {
        await promises_1.default.access(dirPath);
    }
    catch {
        await promises_1.default.mkdir(dirPath, { recursive: true });
    }
};
// Configure multer for different file types
const createMulterConfig = (destination, allowedTypes) => {
    return (0, multer_1.default)({
        storage: multer_1.default.diskStorage({
            destination: async (req, file, cb) => {
                const uploadPath = path_1.default.join('uploads', destination);
                await ensureDirectoryExists(uploadPath);
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const fileExtension = path_1.default.extname(file.originalname);
                const fileName = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
                cb(null, fileName);
            },
        }),
        fileFilter: (req, file, cb) => {
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            }
            else {
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
const fileInfoSchema = zod_1.z.object({
    type: zod_1.z.enum(['images', 'documents', 'qr-codes', 'receipts']),
    filename: zod_1.z.string(),
});
// Upload single image
router.post('/image', auth_1.authenticateToken, imageUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }
        const imageUrl = `/uploads/images/${req.file.filename}`;
        logger_1.logger.info(`Image uploaded: ${req.file.filename}`, { userId: req.user?.id });
        res.json({
            message: 'Image uploaded successfully',
            imageUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
        });
    }
    catch (error) {
        logger_1.logger.error('Upload image error:', { error: error.message, userId: req.user?.id });
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Upload multiple images
router.post('/images', auth_1.authenticateToken, imageUpload.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No image files provided' });
        }
        const files = req.files;
        const uploadedImages = files.map(file => ({
            imageUrl: `/uploads/images/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
        }));
        logger_1.logger.info(`${files.length} images uploaded`, { userId: req.user?.id });
        res.json({
            message: 'Images uploaded successfully',
            images: uploadedImages,
        });
    }
    catch (error) {
        logger_1.logger.error('Upload images error:', { error: error.message, userId: req.user?.id });
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Upload document
router.post('/document', auth_1.authenticateToken, documentUpload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document file provided' });
        }
        const documentUrl = `/uploads/documents/${req.file.filename}`;
        logger_1.logger.info(`Document uploaded: ${req.file.filename}`, { userId: req.user?.id });
        res.json({
            message: 'Document uploaded successfully',
            documentUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
        });
    }
    catch (error) {
        logger_1.logger.error('Upload document error:', { error: error.message, userId: req.user?.id });
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete uploaded file
router.delete('/:type/:filename', auth_1.authenticateToken, (0, validation_middleware_1.validateRequest)(fileInfoSchema), async (req, res) => {
    try {
        const { type, filename } = req.params;
        const filePath = path_1.default.join('uploads', type, filename);
        // Check if file exists and delete it
        try {
            await promises_1.default.access(filePath);
            await promises_1.default.unlink(filePath);
            logger_1.logger.info(`File deleted: ${filename} of type ${type}`, { userId: req.user?.id });
            res.json({ message: 'File deleted successfully' });
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                logger_1.logger.warn(`Attempted to delete non-existent file: ${filename}`, { userId: req.user?.id });
                return res.status(404).json({ error: 'File not found' });
            }
            logger_1.logger.error('Delete file error:', { error: err.message, userId: req.user?.id });
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    catch (error) {
        // This catch block is for validation errors from validateRequest
        logger_1.logger.error('Delete file request validation error:', { error: error.message });
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
        const filePath = path_1.default.join('uploads', type, filename);
        // Check if file exists
        try {
            const stats = await promises_1.default.stat(filePath);
            logger_1.logger.info(`File info requested: ${filename}`, { userId: req.user?.id });
            res.json({
                filename,
                url: `/uploads/${type}/${filename}`,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
            });
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                logger_1.logger.warn(`Attempted to access info for non-existent file: ${filename}`, { userId: req.user?.id });
                return res.status(404).json({ error: 'File not found' });
            }
            logger_1.logger.error('Get file info error:', { error: err.message, userId: req.user?.id });
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    catch (error) {
        logger_1.logger.error('Get file info request validation error:', { error: error.message });
        res.status(400).json({ error: error.errors || 'Invalid request parameters' });
    }
});
// Serve uploaded files (static file serving)
router.get('/:type/:filename', (req, res) => {
    const { type, filename } = req.params;
    if (!['images', 'documents'].includes(type)) {
        return res.status(400).json({ error: 'Invalid file type' });
    }
    const filePath = path_1.default.join('uploads', type, filename);
    // Check if file exists
    if (!promises_1.default.existsSync(filePath)) {
        logger_1.logger.warn(`Attempted to serve non-existent file: ${filename}`, { userId: req.user?.id });
        return res.status(404).json({ error: 'File not found' });
    }
    // Set appropriate headers
    const ext = path_1.default.extname(filename).toLowerCase();
    const mimeTypes = {
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
exports.default = router;
//# sourceMappingURL=upload.js.map