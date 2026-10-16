import express, { Request, Response } from "express";
import multer from "multer";
import cloudinary from "../middleware/cloudinary";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },

  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }

    cb(null, true);
  },
});

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

router.post(
  "/",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("MULTER ERROR:", err);

        return res.status(400).json({
          message: err.message || "Upload failed",
        });
      }

      next();
    });
  },

  async (req: MulterRequest, res: Response) => {
    try {
      console.log("REQ FILE:", req.file);

      const file = req.file;

      if (!file) {
        return res.status(400).json({
          message: "No file uploaded",
        });
      }

      const folder =
        typeof req.query.folder === "string"
          ? req.query.folder
          : "general";

      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "image",
          },

          (error, result) => {
            if (error) {
              console.error("CLOUDINARY ERROR:", error);
              return reject(error);
            }

            resolve(result);
          }
        );

        stream.end(file.buffer);
      });

      return res.status(200).json({
        imageUrl: uploadResult.secure_url,
      });

    } catch (err: any) {
      console.error("UPLOAD ERROR:", err);

      return res.status(500).json({
        message: err.message || "Image upload failed",
      });
    }
  }
);

export default router;
