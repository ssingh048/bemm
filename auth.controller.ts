import { Router } from "express";
import bcrypt from "bcrypt";
import { storage } from "../storage";
import { authenticateJWT } from "../middleware/auth.middleware";
import { generateToken } from "../utils/jwt";
import { sendSignupConfirmationEmail } from "../utils/email";
import { insertUserSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logActivity } from "../utils/activity";

export function register() {
  const router = Router();

  // Login
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log(`Login attempt for email: ${email}`);

      if (!email || !password) {
        console.log("Login failed: Email or password missing");
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);

      if (!user) {
        console.log(`Login failed: No user found with email ${email}`);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.status === "inactive") {
        console.log(`Login failed: User ${email} is inactive`);
        return res.status(403).json({ message: "Your account has been deactivated. Please contact an administrator." });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        console.log(`Login failed: Invalid password for ${email}`);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = generateToken(user);
      console.log(`Generated token for ${email}, role: ${user.role}`);

      // Set token in cookie
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        sameSite: "strict"
      });
      console.log(`Auth cookie set for ${email}`);

      // Log the login activity
      await logActivity({
        userId: user.id,
        action: "login",
        details: `User logged in: ${user.email}`
      });

      // Return user info (excluding password)
      const { password: _, ...userWithoutPassword } = user;
      console.log(`Login successful: ${email}, role: ${user.role}`);
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "An error occurred during login" });
    }
  });

  // Signup
  router.post("/signup", async (req, res) => {
    try {
      // Validate the request data
      const userData = insertUserSchema
        .omit({ role: true }) // Don't allow role to be set during signup
        .parse({
          ...req.body,
          role: "user" // Force role to be "user"
        });

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
        password: hashedPassword,
        role: "user", // Force role to be "user"
        status: "active"
      });

      // Send confirmation email
      if (userData.notificationOptIn) {
        try {
          await sendSignupConfirmationEmail(userData.email, userData.name);
        } catch (emailError) {
          console.error("Failed to send confirmation email:", emailError);
          // Continue with signup process even if email fails
        }
      }

      // Log the signup activity
      await logActivity({
        userId: newUser.id,
        action: "signup",
        details: `New user registered: ${newUser.email}`
      });

      // Return success message
      res.status(201).json({ message: "User created successfully" });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Signup error:", error);
      res.status(500).json({ message: "An error occurred during signup" });
    }
  });

  // Logout - Removed authenticateJWT middleware to allow anyone to logout
  router.post("/logout", async (req, res) => {
    try {
      // If user is authenticated, log the activity
      if (req.user) {
        await logActivity({
          userId: req.user.id,
          action: "logout",
          details: `User logged out: ${req.user.email}`
        });
      }

      // Clear the authentication cookie
      res.clearCookie("auth_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
      });
      
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "An error occurred during logout" });
    }
  });

  // Get current user (me)
  router.get("/me", authenticateJWT, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.status(200).json(req.user);
  });

  // Change password
  router.post("/change-password", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      // Get the user with the password
      const user = await storage.getUserById(req.user.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the password
      await storage.updateUser(user.id, { password: hashedPassword });

      // Log the password change activity
      await logActivity({
        userId: user.id,
        action: "user_update",
        details: `User changed password: ${user.email}`
      });

      res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "An error occurred while changing password" });
    }
  });

  return router;
}
