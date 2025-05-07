import { Router } from "express";
import { storage } from "../storage";
import { authenticateJWT } from "../middleware/auth.middleware";
import { insertContactSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logActivity } from "../utils/activity";

export function register(isAdmin = false) {
  const router = Router();

  if (isAdmin) {
    // Admin routes - these are already protected by the isOwner middleware in routes.ts

    // Get all contacts with pagination, search, and filtering
    router.get("/", async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 10;
        const search = (req.query.search as string) || "";
        const status = (req.query.status as string) || "all";
        
        const { contacts, total } = await storage.getAllContacts(page, perPage, search, status);
        
        res.status(200).json({ contacts, total });
      } catch (error) {
        console.error("Get all contacts error:", error);
        res.status(500).json({ message: "An error occurred while fetching contacts" });
      }
    });

    // Get a specific contact by ID
    router.get("/:id", async (req, res) => {
      try {
        const contactId = parseInt(req.params.id);
        
        if (isNaN(contactId)) {
          return res.status(400).json({ message: "Invalid contact ID" });
        }
        
        const contact = await storage.getContactById(contactId);
        
        if (!contact) {
          return res.status(404).json({ message: "Contact not found" });
        }
        
        res.status(200).json(contact);
      } catch (error) {
        console.error("Get contact by ID error:", error);
        res.status(500).json({ message: "An error occurred while fetching the contact" });
      }
    });

    // Update a contact status
    router.patch("/:id", async (req, res) => {
      try {
        const contactId = parseInt(req.params.id);
        
        if (isNaN(contactId)) {
          return res.status(400).json({ message: "Invalid contact ID" });
        }
        
        const contact = await storage.getContactById(contactId);
        
        if (!contact) {
          return res.status(404).json({ message: "Contact not found" });
        }
        
        // Only allow status to be updated
        const allowedFields = ["status"];
        const updateData: any = {};
        
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updateData[field] = req.body[field];
          }
        }
        
        const [updatedContact] = await storage.updateContact(contactId, updateData);
        
        // Log the activity
        await logActivity({
          userId: req.user?.id,
          action: "contact_message",
          details: `Updated contact status to ${updateData.status}: Contact from ${contact.email}`
        });
        
        res.status(200).json(updatedContact);
      } catch (error) {
        console.error("Update contact error:", error);
        res.status(500).json({ message: "An error occurred while updating the contact" });
      }
    });

    // Respond to a contact
    router.post("/:id/respond", async (req, res) => {
      try {
        const contactId = parseInt(req.params.id);
        
        if (isNaN(contactId)) {
          return res.status(400).json({ message: "Invalid contact ID" });
        }
        
        const contact = await storage.getContactById(contactId);
        
        if (!contact) {
          return res.status(404).json({ message: "Contact not found" });
        }
        
        const { message } = req.body;
        
        if (!message) {
          return res.status(400).json({ message: "Response message is required" });
        }
        
        // Update the contact with the response
        const [updatedContact] = await storage.updateContact(contactId, {
          status: "responded",
          responseMessage: message,
          responseDate: new Date()
        });
        
        // In a real application, send an email to the contact with the response
        // For this implementation, we'll just log the activity
        
        // Log the activity
        await logActivity({
          userId: req.user?.id,
          action: "contact_message",
          details: `Responded to contact from ${contact.email}`
        });
        
        res.status(200).json(updatedContact);
      } catch (error) {
        console.error("Respond to contact error:", error);
        res.status(500).json({ message: "An error occurred while responding to the contact" });
      }
    });

    // Delete a contact
    router.delete("/:id", async (req, res) => {
      try {
        const contactId = parseInt(req.params.id);
        
        if (isNaN(contactId)) {
          return res.status(400).json({ message: "Invalid contact ID" });
        }
        
        const contact = await storage.getContactById(contactId);
        
        if (!contact) {
          return res.status(404).json({ message: "Contact not found" });
        }
        
        await storage.deleteContact(contactId);
        
        // Log the activity
        await logActivity({
          userId: req.user?.id,
          action: "contact_message",
          details: `Deleted contact from ${contact.email}`
        });
        
        res.status(200).json({ message: "Contact deleted successfully" });
      } catch (error) {
        console.error("Delete contact error:", error);
        res.status(500).json({ message: "An error occurred while deleting the contact" });
      }
    });
  } else {
    // User routes

    // Submit a contact form
    router.post("/", async (req, res) => {
      try {
        // Validate the request data
        const contactData = insertContactSchema.parse(req.body);
        
        // Create the contact
        const [newContact] = await storage.createContact({
          ...contactData,
          status: "unread"
        });
        
        // Log the activity
        await logActivity({
          userId: req.user?.id, // May be undefined for unauthenticated users
          action: "contact_message",
          details: `New contact message from ${newContact.email}: ${newContact.message.substring(0, 50)}...`
        });
        
        res.status(201).json({ message: "Contact message submitted successfully" });
      } catch (error) {
        if (error instanceof ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.message });
        }
        
        console.error("Create contact error:", error);
        res.status(500).json({ message: "An error occurred while submitting your contact message" });
      }
    });
  }

  return router;
}
