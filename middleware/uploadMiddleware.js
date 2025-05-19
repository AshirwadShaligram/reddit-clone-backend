import fileUpload from "express-fileupload";
import path from "path";

// File upload middleware with configuration
const uploadMiddleware = fileUpload({
  useTempFiles: true,
  tempFileDir: "/tmp/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  abortOnLimit: true,
  createParentPath: true,
});

// Middleware to validate uploaded images for communities
const validateCommunityImages = (req, res, next) => {
  try {
    // No files uploaded is valid (could be update with no new images)
    if (!req.files || Object.keys(req.files).length === 0) {
      return next();
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const files = req.files;

    // Validate banner if present
    if (files.bannerImage) {
      if (!allowedTypes.includes(files.bannerImage.mimetype)) {
        return res.status(400).json({
          error: "Banner must be an image file (JPEG, PNG, GIF, or WebP)",
        });
      }
    }

    // Validate logo if present
    if (files.logoImage) {
      if (!allowedTypes.includes(files.logoImage.mimetype)) {
        return res.status(400).json({
          error: "Logo must be an image file (JPEG, PNG, GIF, or WebP)",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Error in file validation middleware:", error);
    res.status(500).json({ error: "Error processing uploaded files" });
  }
};

// Middleware to validate a specific image field
const validateImageUpload = (fieldName) => {
  return (req, res, next) => {
    try {
      // No files uploaded is valid
      if (!req.files || !req.files[fieldName]) {
        return next();
      }

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      const file = req.files[fieldName];

      // Validate image type
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `${fieldName} must be an image file (JPEG, PNG, GIF, or WebP)`,
        });
      }

      next();
    } catch (error) {
      console.error(`Error validating ${fieldName}:`, error);
      res.status(500).json({ error: "Error processing uploaded files" });
    }
  };
};

// Middleware to validate both images and videos
const validateMediaUpload = (fieldName) => {
  return (req, res, next) => {
    try {
      // No files uploaded is valid
      if (!req.files || !req.files[fieldName]) {
        return next();
      }

      const allowedImageTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];

      const allowedVideoTypes = [
        "video/mp4",
        "video/webm",
        "video/quicktime", // .mov files
        "video/x-msvideo", // .avi files
      ];

      const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
      const file = req.files[fieldName];

      // Validate media type
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `${fieldName} must be an image (JPEG, PNG, GIF, WebP) or video (MP4, WebM, MOV, AVI) file`,
        });
      }

      // Check if it's a video and attach to request object
      req.isVideo = allowedVideoTypes.includes(file.mimetype);

      next();
    } catch (error) {
      console.error(`Error validating ${fieldName}:`, error);
      res.status(500).json({ error: "Error processing uploaded files" });
    }
  };
};

export {
  uploadMiddleware,
  validateCommunityImages,
  validateImageUpload,
  validateMediaUpload,
};
