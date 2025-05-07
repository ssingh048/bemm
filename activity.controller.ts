import { Router } from "express";
import { storage } from "../storage";

export function register() {
  const router = Router();

  // Get activity logs with pagination, search, filtering, and sorting
  router.get("/", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 15;
      const search = (req.query.search as string) || "";
      const action = (req.query.action as string) || "all";
      const period = (req.query.period as string) || "all_time";
      const sort = (req.query.sort as string) || "date";
      const direction = (req.query.direction as string) || "desc";
      
      const { activities, total } = await storage.getAllActivities(
        page, perPage, search, action, period, sort, direction
      );
      
      res.status(200).json({ activities, total });
    } catch (error) {
      console.error("Get activity logs error:", error);
      res.status(500).json({ message: "An error occurred while fetching activity logs" });
    }
  });

  // Get a specific activity log by ID
  router.get("/:id", async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      
      if (isNaN(activityId)) {
        return res.status(400).json({ message: "Invalid activity ID" });
      }
      
      const activity = await storage.getActivityById(activityId);
      
      if (!activity) {
        return res.status(404).json({ message: "Activity log not found" });
      }
      
      // Format the response
      const formattedActivity = {
        id: activity.id,
        userId: activity.userId,
        userName: activity.user?.name || null,
        userEmail: activity.user?.email || null,
        action: activity.action,
        details: activity.details,
        createdAt: activity.createdAt.toISOString()
      };
      
      res.status(200).json(formattedActivity);
    } catch (error) {
      console.error("Get activity by ID error:", error);
      res.status(500).json({ message: "An error occurred while fetching the activity log" });
    }
  });

  return router;
}
