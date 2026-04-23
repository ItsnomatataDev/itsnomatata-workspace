import { supabase } from "../../../lib/supabase/client";

export interface UploadOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  generateThumbnail?: boolean;
  compressImage?: boolean;
  quality?: number; // 0-100
}

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  metadata?: {
    width?: number;
    height?: number;
    thumbnail?: string;
    originalName?: string;
  };
}

export class ImageUploadService {
  private static readonly DEFAULT_OPTIONS: UploadOptions = {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ],
    generateThumbnail: true,
    compressImage: true,
    quality: 85,
  };

  static async uploadImage(
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // Validate file
    this.validateFile(file, opts);

    try {
      // Compress image if needed
      const processedFile = opts.compressImage 
        ? await this.compressImage(file, opts.quality || 85)
        : file;

      // Generate unique filename
      const fileName = this.generateUniqueFileName(file.name);
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from("chat-images")
        .upload(fileName, processedFile, {
          contentType: processedFile.type,
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("chat-images")
        .getPublicUrl(fileName);

      // Get image dimensions
      const dimensions = await this.getImageDimensions(processedFile);

      // Generate thumbnail if requested
      let thumbnail: string | undefined;
      if (opts.generateThumbnail && dimensions.width && dimensions.height) {
        thumbnail = await this.generateThumbnail(processedFile);
      }

      return {
        url: publicUrl,
        name: fileName,
        size: processedFile.size,
        mimeType: processedFile.type,
        metadata: {
          width: dimensions.width,
          height: dimensions.height,
          thumbnail,
          originalName: file.name,
        },
      };
    } catch (error) {
      console.error("Error uploading image:", error);
      throw new Error("Failed to upload image");
    }
  }

  static async uploadMultipleImages(
    files: File[],
    options: UploadOptions = {}
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.uploadImage(file, options);
        results.push(result);
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        // Continue with other files
      }
    }

    return results;
  }

  static async deleteImage(url: string): Promise<void> {
    try {
      // Extract filename from URL
      const fileName = url.split("/").pop();
      if (!fileName) throw new Error("Invalid URL");

      const { error } = await supabase.storage
        .from("chat-images")
        .remove([fileName]);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting image:", error);
      throw new Error("Failed to delete image");
    }
  }

  static async getImageInfo(url: string): Promise<{
    size: number;
    mimeType: string;
    dimensions?: { width: number; height: number };
  }> {
    try {
      // Extract filename from URL
      const fileName = url.split("/").pop();
      if (!fileName) throw new Error("Invalid URL");

      // Get file info from Supabase
      const { data } = supabase.storage
        .from("chat-images")
        .getPublicUrl(fileName);

      // For now, return basic info
      // In a real implementation, you might store metadata in a separate table
      return {
        size: 0, // Would need to be stored separately
        mimeType: "image/jpeg", // Would need to be stored separately
      };
    } catch (error) {
      console.error("Error getting image info:", error);
      throw new Error("Failed to get image info");
    }
  }

  private static validateFile(file: File, options: UploadOptions): void {
    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      throw new Error(
        `File size ${this.formatFileSize(file.size)} exceeds maximum ${this.formatFileSize(options.maxSize)}`
      );
    }

    // Check file type
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`);
    }

    // Check if it's actually an image
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }
  }

  private static generateUniqueFileName(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split(".").pop();
    return `${timestamp}_${random}.${extension}`;
  }

  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  private static async compressImage(
    file: File,
    quality: number
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions if needed
        let { width, height } = img;
        const maxDimension = 1920; // Max width/height

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          file.type,
          quality / 100
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  }

  private static async getImageDimensions(file: File): Promise<{
    width: number;
    height: number;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
        });
        URL.revokeObjectURL(img.src);
      };
      
      img.onerror = () => {
        reject(new Error("Failed to load image"));
        URL.revokeObjectURL(img.src);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  private static async generateThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        // Thumbnail dimensions
        const thumbSize = 150;
        canvas.width = thumbSize;
        canvas.height = thumbSize;

        // Calculate crop and resize
        const { width, height } = img;
        const aspectRatio = width / height;
        
        let drawWidth = thumbSize;
        let drawHeight = thumbSize;
        let offsetX = 0;
        let offsetY = 0;

        if (aspectRatio > 1) {
          // Landscape
          drawHeight = thumbSize / aspectRatio;
          offsetY = (thumbSize - drawHeight) / 2;
        } else {
          // Portrait
          drawWidth = thumbSize * aspectRatio;
          offsetX = (thumbSize - drawWidth) / 2;
        }

        // Draw thumbnail
        ctx?.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const thumbnailUrl = URL.createObjectURL(blob);
              resolve(thumbnailUrl);
            } else {
              reject(new Error("Failed to generate thumbnail"));
            }
          },
          "image/jpeg",
          80
        );
      };

      img.onerror = () => reject(new Error("Failed to load image for thumbnail"));
      img.src = URL.createObjectURL(file);
    });
  }

  static async createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to create preview"));
        }
      };
      
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  static async processImagesForChat(files: File[]): Promise<{
    previews: Array<{ file: File; preview: string; name: string; size: string }>;
    uploads: Promise<UploadResult>[];
  }> {
    const previews = await Promise.all(
      files.map(async (file) => {
        const preview = await this.createImagePreview(file);
        return {
          file,
          preview,
          name: file.name,
          size: this.formatFileSize(file.size),
        };
      })
    );

    const uploads = files.map(file => this.uploadImage(file));

    return { previews, uploads };
  }

  static validateImageFile(file: File): {
    isValid: boolean;
    error?: string;
  } {
    try {
      this.validateFile(file, this.DEFAULT_OPTIONS);
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
