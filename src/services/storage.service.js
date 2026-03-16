const { supabase } = require('../utils/supabase');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class StorageService {
  constructor() {
    this.bucketName = 'attachments';
  }

  // Generate safe storage filename using UUID
  generateStorageFileName(originalFileName) {
    if (!originalFileName) return `unknown_${crypto.randomUUID()}.bin`;
    
    const ext = path.extname(originalFileName) || '.bin';
    const uuid = crypto.randomUUID();
    
    // ใช้เฉพาะ UUID + extension เพื่อป้องกันการซ้ำ
    return `${uuid}${ext}`;
  }

  // Create safe storage path
  createSafePath(userId, originalFileName) {
    const storageFileName = this.generateStorageFileName(originalFileName);
    return `${userId}/${storageFileName}`;
  }

  // Upload file to Supabase Storage
  async uploadFile(fileName, userId, mimeType = null, buffer = null) {
    try {
      // Create safe storage path
      const storagePath = this.createSafePath(userId, fileName);
      
      let fileBuffer;
      if (buffer) {
        // ใช้ buffer ตรงๆ (สำหรับ upload จาก memory)
        fileBuffer = buffer;
      } else {
        // Read file from local path
        const filePath = fileName; // assuming fileName is the local path
        fileBuffer = fs.readFileSync(filePath);
      }
      
      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType || 'application/octet-stream',
          upsert: false
        });

      if (error) {
        console.error('Storage upload error:', error);
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(storagePath);

      console.log(`✅ File uploaded: ${fileName} -> ${storagePath}`);
      
      return {
        path: storagePath,
        publicUrl,
        size: fileBuffer.length,
        originalFileName: fileName
      };

    } catch (error) {
      console.error('Upload file error:', error);
      throw error;
    }
  }

  // Download file from Supabase Storage
  async downloadFile(storagePath, localPath) {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .download(storagePath);

      if (error) {
        console.error('Storage download error:', error);
        throw error;
      }

      // Save to local path
      fs.writeFileSync(localPath, data);

      console.log(`✅ File downloaded: ${storagePath} -> ${localPath}`);
      return localPath;

    } catch (error) {
      console.error('Download file error:', error);
      throw error;
    }
  }

  // Delete file from Supabase Storage
  async deleteFile(storagePath) {
    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([storagePath]);

      if (error) {
        console.error('Storage delete error:', error);
        throw error;
      }

      console.log(`✅ File deleted: ${storagePath}`);
      return true;

    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  }

  // Upload email attachment
  async uploadAttachment(filePath, fileName, userId, emailId, buffer = null, mimeType = null) {
    try {
      // ใช้ UUID-based filename สำหรับ storage
      const result = await this.uploadFile(fileName, userId, mimeType || 'application/octet-stream', buffer);
      
      return {
        ...result,
        fileName, // Original Thai filename for display
        emailId,
        userId,
        cloudProvider: 'supabase'
      };

    } catch (error) {
      console.error('Upload attachment error:', error);
      throw error;
    }
  }

  // Migrate existing local files to Supabase
  async migrateLocalFiles(localStoragePath, userId) {
    try {
      if (!fs.existsSync(localStoragePath)) {
        console.log('Local storage path does not exist');
        return { migrated: 0, errors: [] };
      }

      const files = fs.readdirSync(localStoragePath, { withFileTypes: true });
      let migrated = 0;
      const errors = [];

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(localStoragePath, file.name);
          
          try {
            await this.uploadFile(filePath, file.name, userId);
            
            // Optionally delete local file after successful upload
            // fs.unlinkSync(filePath);
            
            migrated++;
          } catch (error) {
            errors.push({ file: file.name, error: error.message });
          }
        }
      }

      console.log(`✅ Migration complete: ${migrated} files migrated`);
      if (errors.length > 0) {
        console.log(`❌ Migration errors: ${errors.length} files failed`);
      }

      return { migrated, errors };

    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }
}

module.exports = new StorageService();
