import { Router } from "express";
import { storage } from "../storage";
import { authenticateJWT } from "../middleware/auth.middleware";
import { insertDonationSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logActivity } from "../utils/activity";

export function register(isAdmin = false) {
  const router = Router();

  if (isAdmin) {
    // Admin routes - these are already protected by the isOwner middleware in routes.ts

    // Get all donations with pagination, search, filtering, and sorting
    router.get("/", async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 10;
        const search = (req.query.search as string) || "";
        const status = (req.query.status as string) || "all";
        const period = (req.query.period as string) || "all_time";
        const sort = (req.query.sort as string) || "date";
        const direction = (req.query.direction as string) || "desc";
        
        const { donations, total } = await storage.getAllDonations(
          page, perPage, search, status, period, sort, direction
        );
        
        res.status(200).json({ donations, total });
      } catch (error) {
        console.error("Get all donations error:", error);
        res.status(500).json({ message: "An error occurred while fetching donations" });
      }
    });

    // Get donation summary statistics
    router.get("/summary", async (req, res) => {
      try {
        const period = (req.query.period as string) || "all_time";
        
        const summary = await storage.getDonationSummary(period);
        
        res.status(200).json(summary);
      } catch (error) {
        console.error("Get donation summary error:", error);
        res.status(500).json({ message: "An error occurred while fetching donation summary" });
      }
    });

    // Get a specific donation by ID
    router.get("/:id", async (req, res) => {
      try {
        const donationId = parseInt(req.params.id);
        
        if (isNaN(donationId)) {
          return res.status(400).json({ message: "Invalid donation ID" });
        }
        
        const donation = await storage.getDonationById(donationId);
        
        if (!donation) {
          return res.status(404).json({ message: "Donation not found" });
        }
        
        // Format the response
        const formattedDonation = {
          id: donation.id,
          userId: donation.userId,
          userName: donation.user?.name,
          userEmail: donation.user?.email,
          amount: donation.amount,
          paymentMethod: donation.paymentMethod,
          status: donation.status,
          createdAt: donation.createdAt.toISOString()
        };
        
        res.status(200).json(formattedDonation);
      } catch (error) {
        console.error("Get donation by ID error:", error);
        res.status(500).json({ message: "An error occurred while fetching the donation" });
      }
    });

    // Update a donation
    router.patch("/:id", async (req, res) => {
      try {
        const donationId = parseInt(req.params.id);
        
        if (isNaN(donationId)) {
          return res.status(400).json({ message: "Invalid donation ID" });
        }
        
        const donation = await storage.getDonationById(donationId);
        
        if (!donation) {
          return res.status(404).json({ message: "Donation not found" });
        }
        
        // Only allow status to be updated
        const allowedFields = ["status"];
        const updateData: any = {};
        
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updateData[field] = req.body[field];
          }
        }
        
        const [updatedDonation] = await storage.updateDonation(donationId, updateData);
        
        // Log the activity
        await logActivity({
          userId: req.user?.id,
          action: "donation",
          details: `Updated donation status to ${updateData.status}: Donation ID ${donationId}`
        });
        
        res.status(200).json(updatedDonation);
      } catch (error) {
        console.error("Update donation error:", error);
        res.status(500).json({ message: "An error occurred while updating the donation" });
      }
    });
  } else {
    // User routes

    // Make a donation (authenticated only)
    router.post("/", authenticateJWT, async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        // Validate the request data
        const donationData = insertDonationSchema
          .omit({ userId: true, status: true })
          .parse(req.body);
        
        // Handle different payment methods
        let donationStatus: "pending" | "completed" | "failed" = "completed";
        let donationDetails: any = { ...donationData };
        
        // For eSewa and bank QR, set status to pending and add additional info
        if (donationData.paymentMethod === "esewa") {
          donationStatus = "pending";
          // In a real implementation, you would integrate with eSewa API
          // and store the transaction reference
          if (req.body.esewaId) {
            donationDetails.esewaReference = `ESEWA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          }
        } else if (donationData.paymentMethod === "bank_qr") {
          donationStatus = "pending";
          // In a real implementation, you would generate a QR code
          // for the specific bank and store its URL
          if (req.body.bankName) {
            // This would be a generated QR code URL in a real app
            // For this example, we're just creating a placeholder
            donationDetails.qrImageUrl = `https://example.com/qr-codes/church-donation-${Date.now()}.png`;
            donationDetails.transactionId = `BANK-${req.body.bankName?.toUpperCase()}-${Date.now()}`;
          }
        }
        
        // Create the donation with properly typed data
        const [newDonation] = await storage.createDonation({
          amount: donationDetails.amount,
          paymentMethod: donationDetails.paymentMethod,
          transactionId: donationDetails.transactionId || null,
          qrImageUrl: donationDetails.qrImageUrl || null,
          esewaReference: donationDetails.esewaReference || null,
          userId: req.user.id,
          status: donationStatus
        });
        
        // Log the activity
        await logActivity({
          userId: req.user.id,
          action: "donation",
          details: `Made a donation of $${newDonation.amount} using ${donationData.paymentMethod.replace('_', ' ')}`
        });
        
        res.status(201).json(newDonation);
      } catch (error) {
        if (error instanceof ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.message });
        }
        
        console.error("Create donation error:", error);
        res.status(500).json({ message: "An error occurred while processing your donation" });
      }
    });

    // Get donation history for the current user
    router.get("/history", authenticateJWT, async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 10;
        
        const { donations, total } = await storage.getDonationsByUserId(req.user.id, page, perPage);
        
        res.status(200).json(donations);
      } catch (error) {
        console.error("Get donation history error:", error);
        res.status(500).json({ message: "An error occurred while fetching your donation history" });
      }
    });
  }

  return router;
}
