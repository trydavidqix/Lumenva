export interface DriveConfig {
  credentialsJson: string;
}

export async function uploadFileToDrive(config: DriveConfig, fileBuffer: ArrayBuffer, mimeType: string, folderId?: string) {
  // Stub for Drive upload
  throw new Error("Not implemented");
}

export async function listFiles(config: DriveConfig, folderId: string) {
  // Stub for Drive list
  throw new Error("Not implemented");
}
