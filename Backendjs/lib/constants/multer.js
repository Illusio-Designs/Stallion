const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Get the root directory (Backend folder)
const rootDir = path.join(__dirname, '..', '..');

const PRODUCT_UPLOAD_DIR = 'product_uploads';
const PRODUCT_IMAGE_UPLOAD_DIR = 'products';

// Create upload directories if they don't exist
const createUploadDirs = () => {
  const dirs = [
    path.join(rootDir, 'uploads', 'profile'),
    path.join(rootDir, 'uploads', PRODUCT_IMAGE_UPLOAD_DIR),
    path.join(rootDir, 'uploads', 'bills'),
    path.join(rootDir, 'uploads', 'sliders'),
    path.join(rootDir, 'uploads', PRODUCT_UPLOAD_DIR)
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createUploadDirs();

// Image compression function
const compressImage = async (file, quality = 80) => {
  try {
    const compressedBuffer = await sharp(file.buffer)
      .jpeg({ quality: quality })
      .png({ quality: quality })
      .webp({ quality: quality })
      .toBuffer();

    return compressedBuffer;
  } catch (error) {
    console.error('Image compression error:', error);
    return file.buffer; // Return original if compression fails
  }
};

// Storage configuration
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Main multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Profile image upload with compression
const profileUpload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: fileFilter
}).single('profile_image');

// Product image upload with compression
const productUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
}).array('product_image');

// Slider image upload with compression
const sliderUpload = multer({
  storage: storage,
  limits: {
    fileSize: 3 * 1024 * 1024 // 3MB limit
  },
  fileFilter: fileFilter
}).single('slider_image');

// Bill upload (no compression for documents)
const billUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed for bills!'), false);
    }
  }
}).array('bill_file');

// General upload for other files
const generalUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
}).single('file');

// Product upload directory storage (for Excel/CSV files)
const productUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(rootDir, 'uploads', PRODUCT_UPLOAD_DIR);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const timestamp = Date.now();
    cb(null, `${nameWithoutExt}-${timestamp}${ext}`);
  }
});

// Product file upload (Excel/CSV) - using .array() to accept multiple files
const productFileUploadBase = multer({
  storage: productUploadStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const mimetype = mimetypes.includes(file.mimetype) || extname;

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files (.csv, .xlsx, .xls) are allowed!'), false);
    }
  }
}).array('file');

// Wrapper middleware to handle file upload
const productFileUpload = (req, res, next) => {
  productFileUploadBase(req, res, (err) => {
    // Handle multer errors
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 10MB.'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Only one file is allowed per upload.'
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a file with the field name "file".'
      });
    }

    next();
  });
};

// Middleware to handle image compression and saving
const processAndSaveImage = (uploadType = 'general') => {
  return async (req, res, next) => {
    try {
      // Use appropriate upload middleware based on type
      let uploadMiddleware;
      switch (uploadType) {
        case 'profile':
          uploadMiddleware = profileUpload;
          break;
        case 'product':
          uploadMiddleware = productUpload;
          break;
        case 'slider':
          uploadMiddleware = sliderUpload;
          break;
        case 'bill':
          uploadMiddleware = billUpload;
          break;
        default:
          uploadMiddleware = upload.single('file');
      }

      uploadMiddleware(req, res, async (err) => {
        if (err) {
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }

        // Handle both single file (.single()) and multiple files (.array())
        const files = req.files || (req.file ? [req.file] : []);

        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No file uploaded'
          });
        }

        try {
          let fileInfo = [];
          for (const file of files) {
            let processedBuffer = file.buffer;
            let fileName = file.originalname;

            // Compress image if it's an image file (not for bills)
            if (uploadType !== 'bill' && file.mimetype.startsWith('image/')) {
              const quality = uploadType === 'profile' ? 85 : 80;
              processedBuffer = await compressImage(file, quality);

              // Generate optimized filename
              const ext = path.extname(fileName).toLowerCase();
              const nameWithoutExt = path.basename(fileName, ext);
              const timestamp = Date.now();
              fileName = `${nameWithoutExt}-${timestamp}${ext}`;
            } else {
              // For bills, keep original filename with timestamp
              const ext = path.extname(fileName);
              const nameWithoutExt = path.basename(fileName, ext);
              const timestamp = Date.now();
              fileName = `${nameWithoutExt}-${timestamp}${ext}`;
            }

            // Determine upload path using absolute paths
            let uploadPath;
            switch (uploadType) {
              case 'profile':
                uploadPath = path.join(rootDir, 'uploads', 'profile');
                break;
              case 'product':
                uploadPath = path.join(rootDir, 'uploads', PRODUCT_IMAGE_UPLOAD_DIR);
                break;
              case 'slider':
                uploadPath = path.join(rootDir, 'uploads', 'sliders');
                break;
              case 'bill':
                uploadPath = path.join(rootDir, 'uploads', 'bills');
                break;
              default:
                uploadPath = path.join(rootDir, 'uploads', 'general');
            }

            // Save file
            const fullPath = path.join(uploadPath, fileName);
            fs.writeFileSync(fullPath, processedBuffer);

            fileInfo.push({
              filename: fileName,
              path: fullPath,
              size: processedBuffer.length,
              mimetype: file.mimetype,
              originalName: file.originalname
            });
          }

          // For single file uploads (profile, slider, bill), set req.fileInfo (singular)
          // For multiple file uploads (product), set req.fileInfos (plural)
          if (uploadType === 'product' || uploadType === 'bill') {
            req.fileInfos = fileInfo;
          } else {
            req.fileInfo = fileInfo[0]; // Single file
          }

          next();
        } catch (error) {
          console.error('File processing error:', error);
          return res.status(500).json({
            success: false,
            message: 'Error processing file'
          });
        }
      });
    } catch (error) {
      console.error('Upload middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Upload middleware error'
      });
    }
  };
};

module.exports = {
  upload,
  profileUpload: processAndSaveImage('profile'),
  productImageUpload: processAndSaveImage('product'),
  sliderUpload: processAndSaveImage('slider'),
  billUpload: processAndSaveImage('bill'),
  generalUpload: processAndSaveImage('general'),
  productFileUpload,
  processAndSaveImage,
  PRODUCT_UPLOAD_DIR,
  PRODUCT_IMAGE_UPLOAD_DIR
}; 