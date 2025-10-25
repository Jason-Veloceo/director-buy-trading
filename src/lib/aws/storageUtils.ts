import { Storage } from 'aws-amplify';
import { s3Client } from './config';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Upload a file to S3
export const uploadFile = async (file: File, path: string) => {
  try {
    const result = await Storage.put(path, file, {
      contentType: file.type,
      progressCallback(progress) {
        console.log(`Uploaded: ${progress.loaded}/${progress.total}`);
      },
    });
    return result.key;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Get a public URL for a file
export const getFileUrl = async (key: string) => {
  try {
    const url = await Storage.get(key);
    return url;
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw error;
  }
};

// Delete a file from S3
export const deleteFile = async (key: string) => {
  try {
    await Storage.remove(key);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

// Get a list of files from a prefix/folder
export const listFiles = async (prefix: string) => {
  try {
    const result = await Storage.list(prefix);
    return result.results;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
};

// Generate a pre-signed URL for uploading a file directly
export const getPresignedUploadUrl = async (key: string, contentType: string, expiresIn = 3600) => {
  try {
    const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET;
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
};

// Generate a pre-signed URL for downloading a file
export const getPresignedDownloadUrl = async (key: string, expiresIn = 3600) => {
  try {
    const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET;
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
}; 