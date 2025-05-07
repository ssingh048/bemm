import { Router } from "express";
import { storage } from "../storage";
import { authenticateJWT } from "../middleware/auth.middleware";
import { insertEventSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logActivity } from "../utils/activity";

export function register() {
  const router = Router();

  // Get upcoming events (limited for home page)
  router.get("/", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 6;
      const limit = parseInt(req.query.limit as string) || perPage;
      
      if (limit > 0) {
        // For fetching just a few events (e.g., for the home page)
        const upcomingEvents = await storage.getUpcomingEvents(limit);
        
        const formattedEvents = upcomingEvents.map(event => ({
          id: event.id,
          title: event.title,
          description: event.description,
          date: event.date.toISOString(),
          cloudinaryUrl: event.media?.cloudinaryUrl || "",
          createdAt: event.createdAt.toISOString()
        }));
        
        return res.status(200).json({ events: formattedEvents, total: formattedEvents.length });
      } else {
        // For paginated requests
        const { events, total } = await storage.getAllEvents(page, perPage);
        res.status(200).json({ events, total });
      }
    } catch (error) {
      console.error("Get events error:", error);
      res.status(500).json({ message: "An error occurred while fetching events" });
    }
  });

  // Get a specific event by ID
  router.get("/:id", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEventById(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Format the response
      const formattedEvent = {
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date.toISOString(),
        cloudinaryUrl: event.media?.cloudinaryUrl || "",
        createdAt: event.createdAt.toISOString()
      };
      
      res.status(200).json(formattedEvent);
    } catch (error) {
      console.error("Get event by ID error:", error);
      res.status(500).json({ message: "An error occurred while fetching the event" });
    }
  });

  // Create a new event (authenticated only)
  router.post("/", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Validate the request data
      const eventData = insertEventSchema.parse(req.body);
      
      // Create the event
      const [newEvent] = await storage.createEvent(eventData);
      
      // Log the activity
      await logActivity({
        userId: req.user.id,
        action: "event_create",
        details: `Created event: ${newEvent.title}`
      });
      
      // Format the response
      const formattedEvent = {
        id: newEvent.id,
        title: newEvent.title,
        description: newEvent.description,
        date: newEvent.date.toISOString(),
        mediaId: newEvent.mediaId,
        createdAt: newEvent.createdAt.toISOString()
      };
      
      res.status(201).json(formattedEvent);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Create event error:", error);
      res.status(500).json({ message: "An error occurred while creating the event" });
    }
  });

  // Update an event (authenticated only)
  router.patch("/:id", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const eventId = parseInt(req.params.id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEventById(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Update the event
      const [updatedEvent] = await storage.updateEvent(eventId, req.body);
      
      // Log the activity
      await logActivity({
        userId: req.user.id,
        action: "event_update",
        details: `Updated event: ${updatedEvent.title}`
      });
      
      // Format the response
      const formattedEvent = {
        id: updatedEvent.id,
        title: updatedEvent.title,
        description: updatedEvent.description,
        date: updatedEvent.date.toISOString(),
        mediaId: updatedEvent.mediaId,
        createdAt: updatedEvent.createdAt.toISOString()
      };
      
      res.status(200).json(formattedEvent);
    } catch (error) {
      console.error("Update event error:", error);
      res.status(500).json({ message: "An error occurred while updating the event" });
    }
  });

  // Delete an event (authenticated only)
  router.delete("/:id", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const eventId = parseInt(req.params.id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEventById(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      await storage.deleteEvent(eventId);
      
      // Log the activity
      await logActivity({
        userId: req.user.id,
        action: "event_delete",
        details: `Deleted event: ${event.title}`
      });
      
      res.status(200).json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Delete event error:", error);
      res.status(500).json({ message: "An error occurred while deleting the event" });
    }
  });

  return router;
}
