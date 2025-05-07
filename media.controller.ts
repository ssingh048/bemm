import { Router } from "express";
import multer from "multer";
import { storage } from "../storage";
import { authenticateJWT } from "../middleware/auth.middleware";
import { insertMediaSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logActivity } from "../utils/activity";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary";

// Set up multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  },
});

export function register(isAdmin = false) {
  const router = Router();

  if (isAdmin) {
    // Admin routes - these are already protected by the isOwner middleware in routes.ts

    // Get all media with pagination, search, and filtering
    router.get("/", async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 12;
        const search = (req.query.search as string) || "";
        const type = (req.query.type as string) || "all";
        
        const { media, total } = await storage.getAllMedia(page, perPage, search, type);
        
        res.status(200).json({ media, total });
      } catch (error) {
        console.error("Get all media error:", error);
        res.status(500).json({ message: "An error occurred while fetching media" });
      }
    });

    // Upload new media
    router.post("/", upload.single("mediaFile"), async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }
        
        // Get form data
        const { title, description = "", type } = req.body;
        
        if (!title || !type) {
          return res.status(400).json({ message: "Title and type are required" });
        }
        
        // Upload to Cloudinary
        const mediaType = type === "image" ? "image" : "video";
        const result = await uploadToCloudinary(req.file, mediaType);
        
        if (!result || !result.secure_url) {
          return res.status(500).json({ message: "Failed to upload file to Cloudinary" });
        }
        
        // Create media record in database
        const mediaData = {
          cloudinaryUrl: result.secure_url,
          cloudinaryPublicId: result.public_id,
          type,
          title,
          description,
          uploadedBy: req.user.id
        };
        
        // Validate the media data
        const validatedData = insertMediaSchema.parse(mediaData);
        
        // Insert into database
        const [newMedia] = await storage.createMedia(validatedData);
        
        // Log the activity
        await logActivity({
          userId: req.user.id,
          action: "media_upload",
          details: `Uploaded ${type}: ${title}`
        });
        
        res.status(201).json(newMedia);
      } catch (error) {
        if (error instanceof ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.message });
        }
        
        console.error("Upload media error:", error);
        res.status(500).json({ 
          message: "An error occurred while uploading media",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Get a specific media by ID
    router.get("/:id", async (req, res) => {
      try {
        const mediaId = parseInt(req.params.id);
        
        if (isNaN(mediaId)) {
          return res.status(400).json({ message: "Invalid media ID" });
        }
        
        const media = await storage.getMediaById(mediaId);
        
        if (!media) {
          return res.status(404).json({ message: "Media not found" });
        }
        
        // Format the response
        const formattedMedia = {
          id: media.id,
          cloudinaryUrl: media.cloudinaryUrl,
          type: media.type,
          title: media.title,
          description: media.description,
          uploadedBy: media.uploader?.name || "Unknown",
          createdAt: media.createdAt.toISOString()
        };
        
        res.status(200).json(formattedMedia);
      } catch (error) {
        console.error("Get media by ID error:", error);
        res.status(500).json({ message: "An error occurred while fetching the media" });
      }
    });

    // Update media
    router.patch("/:id", async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        const mediaId = parseInt(req.params.id);
        
        if (isNaN(mediaId)) {
          return res.status(400).json({ message: "Invalid media ID" });
        }
        
        const media = await storage.getMediaById(mediaId);
        
        if (!media) {
          return res.status(404).json({ message: "Media not found" });
        }
        
        // Only allow title and description to be updated
        const allowedFields = ["title", "description"];
        const updateData: any = {};
        
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updateData[field] = req.body[field];
          }
        }
        
        const [updatedMedia] = await storage.updateMedia(mediaId, updateData);
        
        // Log the activity
        await logActivity({
          userId: req.user.id,
          action: "media_upload",
          details: `Updated ${media.type}: ${updateData.title || media.title}`
        });
        
        res.status(200).json(updatedMedia);
      } catch (error) {
        console.error("Update media error:", error);
        res.status(500).json({ message: "An error occurred while updating the media" });
      }
    });

    // Delete media
    router.delete("/:id", async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        const mediaId = parseInt(req.params.id);
        
        if (isNaN(mediaId)) {
          return res.status(400).json({ message: "Invalid media ID" });
        }
        
        const media = await storage.getMediaById(mediaId);
        
        if (!media) {
          return res.status(404).json({ message: "Media not found" });
        }
        
        // Delete from Cloudinary
        await deleteFromCloudinary(media.cloudinaryPublicId, media.type);
        
        // Delete from database
        await storage.deleteMedia(mediaId);
        
        // Log the activity
        await logActivity({
          userId: req.user.id,
          action: "media_upload",
          details: `Deleted ${media.type}: ${media.title}`
        });
        
        res.status(200).json({ message: "Media deleted successfully" });
      } catch (error) {
        console.error("Delete media error:", error);
        res.status(500).json({ message: "An error occurred while deleting the media" });
      }
    });
  } else {
    // Public routes

    // Get public media by ID
    router.get("/:id", async (req, res) => {
      try {
        const mediaId = parseInt(req.params.id);
        
        if (isNaN(mediaId)) {
          return res.status(400).json({ message: "Invalid media ID" });
        }
        
        const media = await storage.getMediaById(mediaId);
        
        if (!media) {
          return res.status(404).json({ message: "Media not found" });
        }
        
        // Only return public-facing information
        const publicMedia = {
          id: media.id,
          cloudinaryUrl: media.cloudinaryUrl,
          type: media.type,
          title: media.title,
          description: media.description,
          createdAt: media.createdAt.toISOString()
        };
        
        res.status(200).json(publicMedia);
      } catch (error) {
        console.error("Get public media by ID error:", error);
        res.status(500).json({ message: "An error occurred while fetching the media" });
      }
    });
  }

  return router;
}
