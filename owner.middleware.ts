import { Request, Response, NextFunction } from "express";

// Middleware to check if the authenticated user has the owner role
export const isOwner = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    console.log("isOwner middleware: No user found in request");
    return res.status(401).json({ message: "Unauthorized - Authentication required" });
  }
  
  console.log(`isOwner middleware: User ${req.user.email} has role ${req.user.role}`);
  
  if (req.user.role !== "owner") {
    console.log(`isOwner middleware: User ${req.user.email} does not have owner role`);
    return res.status(403).json({ message: "Forbidden - Owner access required" });
  }
  
  console.log(`isOwner middleware: User ${req.user.email} authorized as owner`);
  next();
};
