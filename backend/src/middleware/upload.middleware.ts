import multer from 'multer';
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_FILE_SIZE } from '../constants/upload.constants';
import { AppError } from '../utils/app-error';

const allowedMimeTypes = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);

export const upload = multer({
  // Memory storage means user-controlled filenames are never written to disk.
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_FILE_SIZE, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new AppError(400, 'Only JPEG, PNG, and WebP image files are allowed'));
    }
    callback(null, true);
  },
});

export const imageUpload = upload.single('image');
