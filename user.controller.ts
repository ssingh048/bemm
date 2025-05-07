import { Router } from "express";
import bcrypt from "bcrypt";
import { storage } from "../storage";
import { authenticateJWT } from "../middleware/auth.middleware";
import { insertUserSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logActivity } from "../utils/activity";

export function register(isAdmin = false) {
  const router = Router();

  if (isAdmin) {
    // Admin routes - these are already protected by the isOwner middleware in routes.ts

    // Get all users (admin)
    router.get("/", async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 10;
        const search = (req.query.search as string) || "";
        
        const { users, total } = await storage.getAllUsers(page, perPage, search);
        
        // Remove passwords from the response
        const usersWithoutPasswords = users.map(user => {
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        });
        
        res.status(200).json({ users: usersWithoutPasswords, total });
      } catch (error) {
        console.error("Get all users error:", error);
        res.status(500).json({ message: "An error occurred while fetching users" });
      }
    });

    // Create a user (admin)
    router.post("/", async (req, res) => {
      try {
        // Validate the request data
        const userData = insertUserSchema.parse(req.body);
        
        // Check if user already exists
        const existingUser = await storage.getUserByEmail(userData.email);
        if (existingUser) {
          return res.status(409).json({ message: "User with this email already exists" });
        }
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        // Create the user
        const [newUser] = await storage.createUser({
          ...userData,
          password: hashedPassword
        });
        
        // Log the activity
        await logActivity({
          userId: req.user?.id,
          action: "user_update",
          details: `Admin created a new user: ${newUser.email}`
        });
        
        // Return success message
        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json(userWithoutPassword);
      } catch (error) {
        if (error instanceof ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.message });
        }
        
        console.error("Create user error:", error);
        res.status(500).json({ message: "An error occurred while creating the user" });
      }
    });

    // Get a user by ID (admin)
    router.get("/:id", async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
          return res.status(400).json({ message: "Invalid user ID" });
        }
        
        const user = await storage.getUserById(userId);
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      } catch (error) {
        console.error("Get user by ID error:", error);
        res.status(500).json({ message: "An error occurred while fetching the user" });
      }
    });

    // Update a user (admin)
    router.patch("/:id", async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
          return res.status(400).json({ message: "Invalid user ID" });
        }
        
        const user = await storage.getUserById(userId);
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Special protection for the owner account (shahidsingh1432@gmail.com)
        if (user.email === "shahidsingh1432@gmail.com" && req.body.role === "user") {
          return res.status(403).json({ message: "Cannot change the owner's role" });
        }
        
        // If password is being updated, hash it
        let updatedData: any = { ...req.body };
        
        if (updatedData.password) {
          updatedData.password = await bcrypt.hash(updatedData.password, 10);
        }
        
        // Update the user
        const [updatedUser] = await storage.updateUser(userId, updatedData);
        
        // Log the activity
        await logActivity({
          userId: req.user?.id,
          action: "user_update",
          details: `Admin updated user: ${user.email}`
        });
        
        // Remove password from response
        const { password, ...userWithoutPassword } = updatedUser;
        res.status(200).json(userWithoutPassword);
      } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ message: "An error occurred while updating the user" });
      }
    });

    // Delete a user (admin)
    router.delete("/:id", async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
          return res.status(400).json({ message: "Invalid user ID" });
        }
        
        const user = await storage.getUserById(userId);
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Prevent deletion of the owner account
        if (user.email === "shahidsingh1432@gmail.com") {
          return res.status(403).json({ message: "Cannot delete the owner account" });
        }
        
        await storage.deleteUser(userId);
        
        // Log the activity
        await logActivity({
          userId: req.user?.id,
          action: "user_delete",
          details: `Admin deleted user: ${user.email}`
        });
        
        res.status(200).json({ message: "User deleted successfully" });
      } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ message: "An error occurred while deleting the user" });
      }
    });
  } else {
    // User routes

    // Update current user's profile
    router.patch("/profile", authenticateJWT, async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        // Only allow certain fields to be updated
        const allowedFields = ["name", "notificationOptIn", "profilePictureUrl"];
        const updateData: any = {};
        
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updateData[field] = req.body[field];
          }
        }
        
        // Update the user
        const [updatedUser] = await storage.updateUser(req.user.id, updateData);
        
        // Log the activity
        await logActivity({
          userId: req.user.id,
          action: "user_update",
          details: `User updated their profile: ${req.user.email}`
        });
        
        // Remove password from response
        const { password, ...userWithoutPassword } = updatedUser;
        res.status(200).json(userWithoutPassword);
      } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ message: "An error occurred while updating your profile" });
      }
    });

    // Delete current user's account
    router.delete("/profile", authenticateJWT, async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        // Prevent deletion of the owner account
        if (req.user.email === "shahidsingh1432@gmail.com") {
          return res.status(403).json({ message: "Cannot delete the owner account" });
        }
        
        // Delete the user
        await storage.deleteUser(req.user.id);
        
        // Log the activity (system log since user is being deleted)
        await logActivity({
          userId: req.user.id,
          action: "user_delete",
          details: `User deleted their account: ${req.user.email}`
        });
        
        // Clear the authentication cookie
        res.clearCookie("auth_token");
        
        res.status(200).json({ message: "Account deleted successfully" });
      } catch (error) {
        console.error("Delete account error:", error);
        res.status(500).json({ message: "An error occurred while deleting your account" });
      }
    });
  }

  return router;
}
