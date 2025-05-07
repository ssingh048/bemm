import { Router } from "express";
import { storage } from "../storage";
import { authenticateJWT } from "../middleware/auth.middleware";
import { insertSermonSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logActivity } from "../utils/activity";

export function register() {
  const router = Router();

  // Get sermons with pagination, search, and filtering
  router.get("/", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 10;
      const search = (req.query.search as string) || "";
      const filter = (req.query.filter as string) || "all";
      const limit = parseInt(req.query.limit as string) || 0;
      
      if (limit > 0) {
        // For fetching just a few sermons (e.g., for the home page)
        const latestSermons = await storage.getLatestSermons(limit);
        
        const formattedSermons = latestSermons.map(sermon => ({
          id: sermon.id,
          title: sermon.title,
          description: sermon.description,
          date: sermon.date.toISOString(),
          cloudinaryUrl: sermon.media.cloudinaryUrl,
          duration: sermon.duration,
          createdAt: sermon.createdAt.toISOString()
        }));
        
        return res.status(200).json({ sermons: formattedSermons, total: formattedSermons.length });
      }
      
      // For paginated requests
      const { sermons, total } = await storage.getAllSermons(page, perPage, search, filter);
      
      res.status(200).json({ sermons, total });
    } catch (error) {
      console.error("Get sermons error:", error);
      res.status(500).json({ message: "An error occurred while fetching sermons" });
    }
  });

  // Get a specific sermon by ID
  router.get("/:id", async (req, res) => {
    try {
      const sermonId = parseInt(req.params.id);
      
      if (isNaN(sermonId)) {
        return res.status(400).json({ message: "Invalid sermon ID" });
      }
      
      const sermon = await storage.getSermonById(sermonId);
      
      if (!sermon) {
        return res.status(404).json({ message: "Sermon not found" });
      }
      
      // Format the response
      const formattedSermon = {
        id: sermon.id,
        title: sermon.title,
        description: sermon.description,
        date: sermon.date.toISOString(),
        cloudinaryUrl: sermon.media.cloudinaryUrl,
        duration: sermon.duration,
        createdAt: sermon.createdAt.toISOString()
      };
      
      res.status(200).json(formattedSermon);
    } catch (error) {
      console.error("Get sermon by ID error:", error);
      res.status(500).json({ message: "An error occurred while fetching the sermon" });
    }
  });

  // Create a new sermon (authenticated only)
  router.post("/", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is owner (only owner can create sermons)
      if (req.user.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can create sermons" });
      }
      
      // Validate the request data
      const sermonData = insertSermonSchema.parse(req.body);
      
      // Create the sermon
      const [newSermon] = await storage.createSermon(sermonData);
      
      // Log the activity
      await logActivity({
        userId: req.user.id,
        action: "sermon_create",
        details: `Created sermon: ${newSermon.title}`
      });
      
      // Format the response
      const formattedSermon = {
        id: newSermon.id,
        title: newSermon.title,
        description: newSermon.description,
        date: newSermon.date.toISOString(),
        mediaId: newSermon.mediaId,
        duration: newSermon.duration,
        createdAt: newSermon.createdAt.toISOString()
      };
      
      res.status(201).json(formattedSermon);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Create sermon error:", error);
      res.status(500).json({ message: "An error occurred while creating the sermon" });
    }
  });

  // Update a sermon (authenticated only)
  router.patch("/:id", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is owner (only owner can update sermons)
      if (req.user.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can update sermons" });
      }
      
      const sermonId = parseInt(req.params.id);
      
      if (isNaN(sermonId)) {
        return res.status(400).json({ message: "Invalid sermon ID" });
      }
      
      const sermon = await storage.getSermonById(sermonId);
      
      if (!sermon) {
        return res.status(404).json({ message: "Sermon not found" });
      }
      
      // Update the sermon
      const [updatedSermon] = await storage.updateSermon(sermonId, req.body);
      
      // Log the activity
      await logActivity({
        userId: req.user.id,
        action: "sermon_update",
        details: `Updated sermon: ${updatedSermon.title}`
      });
      
      // Format the response
      const formattedSermon = {
        id: updatedSermon.id,
        title: updatedSermon.title,
        description: updatedSermon.description,
        date: updatedSermon.date.toISOString(),
        mediaId: updatedSermon.mediaId,
        duration: updatedSermon.duration,
        createdAt: updatedSermon.createdAt.toISOString()
      };
      
      res.status(200).json(formattedSermon);
    } catch (error) {
      console.error("Update sermon error:", error);
      res.status(500).json({ message: "An error occurred while updating the sermon" });
    }
  });

  // Delete a sermon (authenticated only)
  router.delete("/:id", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is owner (only owner can delete sermons)
      if (req.user.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can delete sermons" });
      }
      
      const sermonId = parseInt(req.params.id);
      
      if (isNaN(sermonId)) {
        return res.status(400).json({ message: "Invalid sermon ID" });
      }
      
      const sermon = await storage.getSermonById(sermonId);
      
      if (!sermon) {
        return res.status(404).json({ message: "Sermon not found" });
      }
      
      await storage.deleteSermon(sermonId);
      
      // Log the activity
      await logActivity({
        userId: req.user.id,
        action: "sermon_delete",
        details: `Deleted sermon: ${sermon.title}`
      });
      
      res.status(200).json({ message: "Sermon deleted successfully" });
    } catch (error) {
      console.error("Delete sermon error:", error);
      res.status(500).json({ message: "An error occurred while deleting the sermon" });
    }
  });

  return router;
}
