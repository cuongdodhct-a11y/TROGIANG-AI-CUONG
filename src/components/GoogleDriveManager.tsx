import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { User } from "firebase/auth";
import { googleSignIn, logout, initAuth } from "../lib/auth";
import { listDriveFiles, uploadDriveFile, deleteDriveFile, DriveFile } from "../lib/driveApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FolderOpen, 
  Upload, 
  Search, 
  Trash2, 
  ExternalLink, 
  RefreshCw, 
  FileText, 
  FileSpreadsheet, 
  FileCode, 
  Image as ImageIcon, 
  File, 
  LogOut, 
  AlertCircle,
  CheckCircle2,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GoogleDriveManagerProps {
  onSelectFileForDiscussion?: (file: DriveFile) => void;
}

export default function GoogleDriveManager({ onSelectFileForDiscussion }: GoogleDriveManagerProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Confirmation modal state
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, token) => {
        setUser(u);
        setAccessToken(token);
        fetchFiles(token, searchQuery);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setFiles([]);
      }
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const fetchFiles = async (token = accessToken, query = searchQuery) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const driveFiles = await listDriveFiles(token, query);
      setFiles(driveFiles);
    } catch (err: any) {
      console.error("Error fetching drive files:", err);
      setError(err.message || "Không thể tải danh sách tệp Google Drive.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        fetchFiles(res.accessToken, searchQuery);
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setError("Đăng nhập Google thất bại: " + (err.message || "Vui lòng thử lại."));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setFiles([]);
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (accessToken) {
      fetchFiles(accessToken, searchQuery);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !accessToken) return;

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const newFile = await uploadDriveFile(accessToken, selectedFile);
      setSuccessMsg(`Đã tải tệp "${newFile.name}" lên Google Drive thành công!`);
      fetchFiles(accessToken, searchQuery);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Không thể tải tệp lên Google Drive.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmDelete = async () => {
    if (!fileToDelete || !accessToken) return;
    setIsDeleting(true);
    setError(null);

    try {
      await deleteDriveFile(accessToken, fileToDelete.id);
      setSuccessMsg(`Đã xóa tệp "${fileToDelete.name}" khỏi Google Drive.`);
      setFileToDelete(null);
      fetchFiles(accessToken, searchQuery);
    } catch (err: any) {
      console.error("Delete error:", err);
      const msg = err.message || "";
      if (msg.includes("sufficient permissions") || msg.includes("permission") || msg.includes("Permission")) {
        setError(`Không thể xóa tệp "${fileToDelete.name}": Tài khoản của bạn không có quyền xóa tệp này trên Google Drive (chỉ chủ sở hữu mới có quyền xóa).`);
      } else {
        setError(msg || "Không thể xóa tệp khỏi Google Drive.");
      }
      setFileToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("document") || mimeType.includes("text")) return <FileText className="w-5 h-5 text-blue-600" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <FileCode className="w-5 h-5 text-amber-600" />;
    if (mimeType.includes("image")) return <ImageIcon className="w-5 h-5 text-purple-600" />;
    return <File className="w-5 h-5 text-stone-500" />;
  };

  const formatFileSize = (bytesStr?: string) => {
    if (!bytesStr) return "N/A";
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return "N/A";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <Card className="border-none shadow-xl bg-white rounded-2xl overflow-hidden">
      <CardHeader className="bg-slate-900 text-slate-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-lg">
              <FolderOpen className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-serif">Tài liệu Google Drive</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Đồng bộ tài liệu học tập & chuyên đề Triết học
              </CardDescription>
            </div>
          </div>

          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Đăng xuất
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Unauthenticated State */}
        {!user || !accessToken ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="font-serif font-bold text-lg text-slate-800">Kết nối Google Drive</h3>
            <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
              Đăng nhập bằng tài khoản Google để truy cập, lưu trữ và đưa tài liệu nghiên cứu Triết học từ Drive vào thảo luận cùng Giáo sư.
            </p>

            <div className="pt-2 flex justify-center">
              <button 
                onClick={handleSignIn}
                disabled={isLoggingIn}
                className="gsi-material-button hover:shadow-md transition-shadow disabled:opacity-50 cursor-pointer"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">{isLoggingIn ? "Đang đăng nhập..." : "Đăng nhập với Google"}</span>
                  <span style={{ display: 'none' }}>Đăng nhập với Google</span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* Authenticated State */
          <div className="space-y-6">
            {/* User Banner */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || "User"} className="w-9 h-9 rounded-full border" />
                ) : (
                  <div className="w-9 h-9 bg-blue-600 text-white font-bold rounded-full flex items-center justify-center text-sm">
                    {user.displayName?.[0] || "U"}
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-slate-800">{user.displayName || "Đồng chí"}</p>
                  <p className="text-[11px] text-slate-500">{user.email}</p>
                </div>
              </div>

              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
                <CheckCircle2 className="w-3 h-3" /> Đã kết nối Drive
              </Badge>
            </div>

            {/* Error / Success Notifications */}
            {error && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <form onSubmit={handleSearchSubmit} className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm tài liệu trên Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </form>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchFiles(accessToken, searchQuery)}
                  disabled={loading}
                  className="text-xs h-9 px-3 gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Làm mới
                </Button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-3 gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "Đang tải..." : "Tải tệp lên Drive"}
                </Button>
              </div>
            </div>

            {/* Files List */}
            <div className="space-y-2">
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                  <p>Đang tải danh sách tệp Drive...</p>
                </div>
              ) : files.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                  Không tìm thấy tài liệu nào trên Google Drive.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                          {getFileIcon(file.mimeType)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Kích thước: {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onSelectFileForDiscussion && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onSelectFileForDiscussion(file)}
                            className="text-[11px] h-7 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                          >
                            Đưa vào thảo luận
                          </Button>
                        )}

                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Xem trên Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => setFileToDelete(file)}
                          disabled={file.capabilities?.canDelete === false}
                          className={`p-1.5 rounded-lg transition-colors ${
                            file.capabilities?.canDelete === false
                              ? "text-slate-300 cursor-not-allowed opacity-50"
                              : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                          }`}
                          title={
                            file.capabilities?.canDelete === false
                              ? "Bạn không có quyền xóa tệp này trên Drive"
                              : "Xóa tệp khỏi Drive"
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Modal (MANDATORY per SKILL.md rules) */}
      <AnimatePresence>
        {fileToDelete && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border"
            >
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h4 className="font-serif font-bold text-lg text-slate-900">Xác nhận xóa tài liệu?</h4>
                <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                  Đồng chí có chắc chắn muốn xóa tệp <span className="font-semibold text-slate-900">"{fileToDelete.name}"</span> khỏi Google Drive? Hành động này không thể hoàn tác.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFileToDelete(null)}
                  disabled={isDeleting}
                  className="text-xs"
                >
                  Hủy
                </Button>
                <Button
                  size="sm"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5"
                >
                  {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Card>
  );
}
