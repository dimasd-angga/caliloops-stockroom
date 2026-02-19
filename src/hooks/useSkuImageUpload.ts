import { useState, useCallback } from 'react';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface UploadResult {
  url: string;
  path: string;
}

interface UseSkuImageUploadReturn {
  uploadImage: (file: File, storeId: string, skuCode: string) => Promise<UploadResult>;
  uploading: boolean;
  progress: number;
  error: string | null;
  resetState: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function useSkuImageUpload(): UseSkuImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): void => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size must be less than 5MB');
    }

    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Only JPG, PNG, WebP, and GIF images are allowed');
    }
  };

  const uploadImage = useCallback(
    async (file: File, storeId: string, skuCode: string): Promise<UploadResult> => {
      setError(null);
      setProgress(0);

      try {
        // Validate file before upload
        validateFile(file);

        setUploading(true);

        // Create storage path
        const timestamp = Date.now();
        const safeSku = skuCode.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `skus/${storeId}/${timestamp}_${safeSku}_${fileName}`;

        // Create storage reference
        const storageRef = ref(storage, path);

        // Upload file with progress tracking
        const uploadTask = uploadBytesResumable(storageRef, file);

        return new Promise<UploadResult>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              // Track upload progress
              const progressPercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setProgress(Math.round(progressPercent));
            },
            (error) => {
              // Handle upload error
              setUploading(false);
              setError(error.message);
              reject(error);
            },
            async () => {
              // Upload completed successfully
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                setUploading(false);
                setProgress(100);
                resolve({ url: downloadURL, path });
              } catch (error) {
                setUploading(false);
                const errorMessage = error instanceof Error ? error.message : 'Failed to get download URL';
                setError(errorMessage);
                reject(error);
              }
            }
          );
        });
      } catch (error) {
        setUploading(false);
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setError(errorMessage);
        throw error;
      }
    },
    []
  );

  const resetState = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    uploadImage,
    uploading,
    progress,
    error,
    resetState,
  };
}
