import { storage } from "../storage";
import { InsertActivity } from "@shared/schema";

type ActionType = 
  | "login" 
  | "signup" 
  | "logout" 
  | "media_upload" 
  | "donation" 
  | "contact_message" 
  | "user_update" 
  | "user_delete" 
  | "event_create" 
  | "event_update" 
  | "event_delete" 
  | "sermon_create" 
  | "sermon_update" 
  | "sermon_delete";

interface ActivityLogParams {
  userId?: number;
  action: ActionType;
  details: string;
}

export async function logActivity(params: ActivityLogParams) {
  try {
    const { userId, action, details } = params;
    
    const activityData = {
      userId: userId || null,
      action,
      details
    };
    
    // Use the storage helper
    await storage.createActivity(activityData);
    
    return true;
  } catch (error) {
    console.error("Error logging activity:", error);
    return false;
  }
}