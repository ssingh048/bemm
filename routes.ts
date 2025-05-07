import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { register as registerAuthRoutes } from "./controllers/auth.controller";
import { register as registerUserRoutes } from "./controllers/user.controller";
import { register as registerEventRoutes } from "./controllers/event.controller";
import { register as registerDonationRoutes } from "./controllers/donation.controller";
import { register as registerContactRoutes } from "./controllers/contact.controller";
import { register as registerSermonRoutes } from "./controllers/sermon.controller";
import { register as registerMediaRoutes } from "./controllers/media.controller";
import { register as registerActivityRoutes } from "./controllers/activity.controller";
import { authenticateJWT, setUserInfo } from "./middleware/auth.middleware";
import { isOwner } from "./middleware/owner.middleware";

export async function registerRoutes(app: Express): Promise<Server> {
  // Define API prefix
  const apiPrefix = "/api";

  // Apply middleware to all routes to check if user is authenticated
  // but don't block unauthenticated requests - just attach user info if available
  app.use(setUserInfo);

  // Auth routes (login, signup, etc.)
  app.use(`${apiPrefix}/auth`, registerAuthRoutes());

  // User routes
  app.use(`${apiPrefix}/users`, registerUserRoutes());

  // Event routes
  app.use(`${apiPrefix}/events`, registerEventRoutes());

  // Donation routes
  app.use(`${apiPrefix}/donations`, registerDonationRoutes());

  // Contact routes
  app.use(`${apiPrefix}/contacts`, registerContactRoutes());

  // Sermon routes
  app.use(`${apiPrefix}/sermons`, registerSermonRoutes());

  // Media routes (no auth required for public access)
  app.use(`${apiPrefix}/media`, registerMediaRoutes());

  // Admin routes - all require authentication and owner role
  const adminPrefix = `${apiPrefix}/admin`;
  
  app.use(`${adminPrefix}/users`, authenticateJWT, isOwner, registerUserRoutes(true));
  app.use(`${adminPrefix}/media`, authenticateJWT, isOwner, registerMediaRoutes(true));
  app.use(`${adminPrefix}/contacts`, authenticateJWT, isOwner, registerContactRoutes(true));
  app.use(`${adminPrefix}/donations`, authenticateJWT, isOwner, registerDonationRoutes(true));
  app.use(`${adminPrefix}/activity`, authenticateJWT, isOwner, registerActivityRoutes());
  
  // Dashboard stats
  app.get(`${adminPrefix}/dashboard/stats`, authenticateJWT, isOwner, async (req, res) => {
    try {
      const totalUsers = await storage.getTotalUsers();
      const totalDonations = await storage.getTotalDonationAmount();
      const monthlyDonations = await storage.getMonthlyDonationAmount();
      const upcomingEvents = await storage.getUpcomingEventsCount();
      const newContacts = await storage.getNewContactsCount();
      const unreadContacts = await storage.getUnreadContactsCount();
      const userGrowth = await storage.getUserGrowthPercentage();
      const donationGrowth = await storage.getDonationGrowthPercentage();
      
      res.json({
        totalUsers,
        totalDonations,
        monthlyDonations,
        upcomingEvents,
        newContacts,
        unreadContacts,
        userGrowth,
        donationGrowth
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Error fetching dashboard statistics" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
