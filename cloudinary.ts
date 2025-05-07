import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
  secure: true
});

// Upload a file to Cloudinary
export const uploadToCloudinary = async (file: Express.Multer.File, resourceType: "image" | "video") => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary credentials are not configured");
    }
    
    // Convert the file buffer to a base64 string (for uploads via API)
    const fileBase64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

    // Set the folder where the file should be uploaded
    const folder = "grace_church";
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(fileBase64, {
      resource_type: resourceType,
      folder: folder,
      overwrite: true,
      unique_filename: true,
      invalidate: true
    });
    
    return result;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

// Delete a file from Cloudinary
export const deleteFromCloudinary = async (publicId: string, resourceType: "image" | "video") => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary credentials are not configured");
    }
    
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    
    return result;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw error;
  }
};
