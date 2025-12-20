
/**
 * Compresses a Base64 image string to ensure it fits within Firestore limits.
 * Resizes to max 600px width and reduces JPEG quality.
 */
export const compressImage = (base64Str: string, maxWidth = 600, quality = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    // If it's already a short string (likely not an image or very small), return as is
    if (base64Str.length < 1000) {
        resolve(base64Str);
        return;
    }

    const img = new Image();
    img.src = base64Str;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        // Export as JPEG with reduced quality (0.5 = 50%)
        const compressedData = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedData);
      } else {
        // Fallback if canvas fails
        resolve(base64Str);
      }
    };

    img.onerror = () => {
      // Return original if loading fails
      resolve(base64Str);
    };
  });
};
