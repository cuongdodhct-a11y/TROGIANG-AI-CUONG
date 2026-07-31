export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
  size?: string;
  modifiedTime?: string;
  capabilities?: {
    canDelete?: boolean;
    canTrash?: boolean;
  };
}

export async function listDriveFiles(accessToken: string, searchKeyword = ""): Promise<DriveFile[]> {
  try {
    let q = "trashed = false";
    if (searchKeyword.trim()) {
      const sanitized = searchKeyword.replace(/'/g, "\\'");
      q += ` and name contains '${sanitized}'`;
    }

    const fields = "files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink, iconLink, size, modifiedTime, capabilities)";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=30&orderBy=modifiedTime desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Google Drive API error (${response.status})`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (error: any) {
    console.error("Error listing Drive files:", error);
    throw error;
  }
}

export async function uploadDriveFile(accessToken: string, file: File): Promise<DriveFile> {
  const metadata = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
  };

  const formData = new FormData();
  formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  formData.append("file", file);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,modifiedTime", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Failed to upload file to Google Drive");
  }

  return response.json();
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || "";
    if (response.status === 403 || errMsg.includes("sufficient permissions") || errMsg.includes("permission")) {
      throw new Error("Không thể xóa tệp: Bạn không có quyền xóa tệp này trên Google Drive (chỉ chủ sở hữu hoặc quản trị viên có quyền xóa tệp).");
    }
    throw new Error(errMsg || "Failed to delete file from Google Drive");
  }
}
