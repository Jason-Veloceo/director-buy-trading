"use client";

import { useState } from "react";
import { uploadFile } from "../lib/aws/storageUtils";

interface ImageUploadProps {
  onUploadComplete?: (url: string) => void;
  folder?: string;
}

export default function ImageUpload({ onUploadComplete, folder = "images" }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, GIF, etc.)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size exceeds 5MB limit");
      return;
    }

    setIsUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      // Create a unique filename using timestamp and original filename
      const timestamp = new Date().getTime();
      const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.]/g, "-")}`;
      const path = `${folder}/${fileName}`;
      
      // Upload file to S3
      const fileKey = await uploadFile(file, path);
      
      // Get the public URL and pass it to the parent component
      if (onUploadComplete && fileKey) {
        onUploadComplete(fileKey);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      setError("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      <label className="flex flex-col items-center px-4 py-6 bg-white rounded-lg shadow-md tracking-wide border border-blue-200 cursor-pointer hover:bg-blue-50 transition">
        <svg
          className="w-8 h-8 text-blue-500"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z" />
        </svg>
        <span className="mt-2 text-base leading-normal">
          {isUploading ? "Uploading..." : "Select a file"}
        </span>
        <input
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </label>
      
      {isUploading && (
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
