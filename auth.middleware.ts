import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { verifyToken } from "../utils/jwt";

// Extend the Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        name: string;
        email: string;
        role: string;
        notificationOptIn: boolean;
        profilePictureUrl?: string;
        createdAt: string;
      };
    }
  }
}

// Middleware to set user info if the user is authenticated
export const setUserInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if cookies object exists
    if (!req.cookies) {
      console.log("No cookies object in request");
      return next();
    }
    
    const token = req.cookies.auth_token;
    
    if (!token) {
      console.log("No auth token found in request");
      return next(); // No token, continue without setting user
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded || !decoded.id) {
      console.log("Invalid token or missing ID in token");
      return next(); // Invalid token, continue without setting user
    }
    
    const user = await storage.getUserById(decoded.id);
    
    if (!user) {
      console.log(`User not found for ID: ${decoded.id}`);
      return next(); // User not found, continue without setting user
    }
    
    if (user.status === "inactive") {
      console.log(`User is inactive: ${user.email}`);
      return next(); // User is inactive, continue without setting user
    }
    
    // Set user info on the request object
    const { password, ...userWithoutPassword } = user;
    
    // Create a properly typed user object with guaranteed non-null values
    req.user = {
      id: userWithoutPassword.id,
      name: userWithoutPassword.name,
      email: userWithoutPassword.email,
      role: userWithoutPassword.role,
      notificationOptIn: !!userWithoutPassword.notificationOptIn, // Convert to boolean
      profilePictureUrl: userWithoutPassword.profilePictureUrl || undefined,
      createdAt: userWithoutPassword.createdAt.toISOString()
    };
    
    console.log(`User authenticated: ${user.email}, Role: ${user.role}`);
    next();
  } catch (error) {
    console.error("Error in setUserInfo middleware:", error);
    next(); // Error verifying token, continue without setting user
  }
};

// Middleware to require authentication
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized - Authentication required" });
  }
  
  next();
};

// Middleware to check if user has admin access (admin or owner role)
export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    console.log("isAdmin middleware: No user found in request");
    return res.status(401).json({ message: "Unauthorized - Authentication required" });
  }
  
  console.log(`isAdmin middleware: User ${req.user.email} has role ${req.user.role}`);
  
  if (req.user.role !== "admin" && req.user.role !== "owner") {
    console.log(`isAdmin middleware: User ${req.user.email} does not have admin privileges`);
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }
  
  console.log(`isAdmin middleware: User ${req.user.email} authorized as admin`);
  next();
};
