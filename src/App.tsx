/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import VoiceChat from './components/VoiceChat';
import GoogleDriveManager from './components/GoogleDriveManager';
import SchoolLogo from './components/SchoolLogo';
import { DriveFile } from './lib/driveApi';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "motion/react";
import { MonitorPlay, Users, Brain, BookOpen, Quote, Shield, FileCheck, Globe, Clock, CheckCircle2, Sparkles } from "lucide-react";

export default function App() {
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
      setCurrentTimeStr(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getSystemInstruction = () => {
    const now = new Date();
    const formattedDate = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(now);

    return `Bạn là một AI Video Avatar thời gian thực mô phỏng hình ảnh một nữ giáo sư triết học Việt Nam (35-40 tuổi), có phong thái điềm tĩnh, trí tuệ, là "Giáo sư triết học số" và là trợ giảng của Thầy Cường.
Bạn sẽ giao tiếp bằng giọng nói chuẩn tiếng Việt (ưu tiên âm điệu miền Bắc học thuật), rõ ràng, có nhấn mạnh khái niệm.
Xưng hô của bạn là "tôi" và gọi người dùng là "các đồng chí" (hoặc "Thầy Cường" nếu nhận diện là thầy).

BỐI CẢNH THỜI GIAN THỰC TẾ & CƠ CHẾ CẬP NHẬT DỮ LIỆU MỞ THEO THỜI GIAN THỰC (RẤT QUAN TRỌNG):
1. Thời điểm thực tế trong hệ thống: ${formattedDate} (Thời gian thực: ${now.toISOString()}). Hệ thống của bạn hoạt động theo cơ chế cập nhật mở theo thời gian thực — đến thời điểm nào thì cập nhật dữ liệu chính xác ở thời điểm đó.
2. Nắm vững và cập nhật toàn diện các Văn kiện, Nghị quyết, Chỉ thị chính thống mới nhất của Đảng Cộng sản Việt Nam, Nhà nước, Quân ủy Trung ương và Bộ Quốc phòng tính đến thời điểm hiện tại và liên tục mở rộng.
3. Khi người dùng hỏi về các vấn đề thời sự, chính sách, quy định, nghị quyết hay số liệu mới nhất:
   - Hãy chủ động sử dụng cơ chế tìm kiếm dữ liệu thời gian thực (Google Search Grounding) để tra cứu thông tin chính thống từ các nguồn chuẩn mực: Báo Nhân Dân, Tạp chí Cộng sản, Báo Quân đội Nhân dân, Cổng Thông tin điện tử Chính phủ (chinhphu.vn), Trang Thông tin điện tử Đảng Cộng sản Việt Nam (dangcongsan.vn), Thông tấn xã Việt Nam (TTXVN).
   - Đảm bảo tính trung thực, chuẩn xác lý luận, gắn liền chủ nghĩa Mác - Lênin và tư tưởng Hồ Chí Minh với thực tiễn phát triển đất nước, bảo vệ Tổ quốc trong tình hình mới.

QUY TẮC BẮT BUỘC VỀ TỪ KHÓA VÀ TRẠNG THÁI (TUYỆT ĐỐI TUÂN THỦ):
1. TRẠNG THÁI CHỜ (Standby Mode - Mặc định khi bắt đầu):
   - Bạn bắt đầu ở TRẠNG THÁI CHỜ và PHẢI TUYỆT ĐỐI GIỮ IM LẶNG.
   - TUYỆT ĐỐI KHÔNG tự ý lên tiếng hay phát ra bất kỳ âm thanh nào khi chưa nhận được từ khóa kích hoạt "Giáo sư" (ví dụ: "Giáo sư...", "Giáo sư cho tôi hỏi...", "Thưa Giáo sư...").
   - BỎ QUA HOÀN TOÀN mọi tạp âm, tiếng ồn, tiếng nói chuyện xung quanh, tiếng tivi, nhạc hoặc câu nói không có từ khóa "Giáo sư".
   - NẾU KHÔNG CÓ TỪ KHÓA "GIÁO SƯ", BẠN KHÔNG ĐƯỢC PHÉP TRẢ LỜI HAY LÊN TIẾNG DƯỚI BẤT KỲ HÌNH THỨC NÀO.

2. KÍCH HOẠT VÀ DUY TRÌ PHIÊN LÀM VIỆC (Active Mode):
   - Khi nghe thấy từ khóa "Giáo sư", bạn lập tức KÍCH HOẠT và trả lời câu hỏi/nhiệm vụ đó với phong thái chuẩn mực, khúc chiết.
   - Khi đã kích hoạt, bạn duy trì trao đổi liên tục trong phiên thảo luận mà người dùng không cần lặp lại từ khóa ở từng câu.

3. TẠM DỪNG VÀ QUAY VỀ TRẠNG THÁI CHỜ (Keywords: "Dừng", "Kết thúc"):
   - Khi người dùng nói "Dừng", "Kết thúc", "Tạm dừng" hoặc "Dừng lại": Bạn chỉ xác nhận ngắn gọn tối đa 1 câu (ví dụ: "Rõ, tôi chuyển về trạng thái chờ.") rồi NGAY LẬP TỨC NGẮT LỜI và QUAY LẠI TRẠNG THÁI CHỜ.
   - Khi đã về trạng thái chờ, bạn TUYỆT ĐỐI KHÔNG THAM GIA HOẶC LÊN TIẾNG nữa cho đến khi nghe thấy từ khóa kích hoạt "Giáo sư" tiếp theo.

Nhiệm vụ chuyên môn: Giảng dạy và tương tác trực tiếp về các chủ đề: "Triết học Mác - Lênin", "Tư tưởng Hồ Chí Minh", "Giá trị phẩm chất Bộ đội Cụ Hồ", "Đường lối của Đảng Cộng sản Việt Nam", "Các văn kiện, nghị quyết và chính sách mới nhất của Đảng và Nhà nước".

Quy tắc vận hành khi nhận câu hỏi:
1. Phân tích nội dung theo hướng triết học Mác – Lênin, gắn liền lý luận với bối cảnh thực tiễn thời gian thực.
2. Trả lời mạch lạc, có cấu trúc: Nêu vấn đề -> Giải thích khái niệm -> Liên hệ thực tiễn & Văn kiện chính thống.
3. Duy trì phong cách: Chính xác học thuật, ngắn gọn nhưng có chiều sâu, chuẩn mực giảng đường.${
      selectedFile
        ? `\n\nTài liệu tham khảo từ Google Drive hiện tại: "${selectedFile.name}". Vui lòng ưu tiên phân tích và trao đổi xoay quanh tài liệu này khi người dùng thảo luận.`
        : ''
    }`;
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans selection:bg-slate-200">
      {/* Hero Section */}
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden bg-slate-900">
        <div className="absolute inset-0 opacity-40">
          <img 
            src="https://picsum.photos/seed/philosophy-lecture/1920/1080?blur=1" 
            alt="Giảng đường hiện đại" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900" />
        </div>
        
        <div className="relative z-10 max-w-4xl px-6 text-center space-y-6">
          <div className="mb-6 flex justify-center">
            <SchoolLogo className="w-36 h-36 md:w-44 md:h-44" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <Badge className="bg-blue-600/90 backdrop-blur text-white border-none px-4 py-1 text-xs uppercase tracking-widest font-medium">
                Trợ giảng điện tử AI
              </Badge>
              <Badge className="bg-emerald-600/90 backdrop-blur text-white border-none px-3 py-1 text-xs flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                Cập nhật mở thời gian thực
              </Badge>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-slate-50 leading-tight tracking-tight">
              Giáo sư Triết học số
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 font-light mt-4">
              Hỗ trợ tương tác môn Triết học Mác - Lênin & Dữ liệu Văn kiện thời gian thực
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12 -mt-20 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Context & Google Drive Manager */}
          <div className="lg:col-span-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              {/* Real-time Data Sync Status Card */}
              <Card className="border-none shadow-xl bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider">Đồng bộ dữ liệu trực tiếp</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-300 border-emerald-500/40 bg-emerald-950/40">
                      Live Grounding
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-medium">{currentTimeStr || "Đang cập nhật..."}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Mô hình tự động cập nhật dữ liệu và văn kiện chính thống liên tục theo thời gian thực.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-300">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Văn kiện Đại hội & Nghị quyết Trung ương mới nhất</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Nghị quyết Quân ủy Trung ương & Bộ Quốc phòng</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Nguồn báo chí chính thống (Nhân Dân, QĐND, TCCS)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Curriculum Card */}
              <Card className="border-none shadow-xl bg-white rounded-2xl overflow-hidden">
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center gap-4 text-blue-800">
                    <MonitorPlay className="w-6 h-6" />
                    <h3 className="font-serif text-xl font-bold">Bảng điện tử</h3>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-sm">
                    Buổi học hôm nay tập trung vào các chuyên đề trọng tâm. Mời các đồng chí tham khảo nội dung dưới đây:
                  </p>
                  <Separator className="bg-slate-100" />
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="mt-1 bg-blue-50 p-2 rounded-lg">
                        <Brain className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">Triết học Mác - Lênin</h4>
                        <p className="text-xs text-slate-500">Nền tảng tư tưởng, kim chỉ nam cho hành động.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="mt-1 bg-emerald-50 p-2 rounded-lg">
                        <BookOpen className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">Tư tưởng Hồ Chí Minh</h4>
                        <p className="text-xs text-slate-500">Hệ thống quan điểm toàn diện và sâu sắc về cách mạng Việt Nam.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="mt-1 bg-violet-50 p-2 rounded-lg">
                        <Users className="w-4 h-4 text-violet-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">Giá trị phẩm chất Bộ đội Cụ Hồ</h4>
                        <p className="text-xs text-slate-500">Biểu tượng sáng ngời của chủ nghĩa anh hùng cách mạng.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="mt-1 bg-red-50 p-2 rounded-lg">
                        <Quote className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">Đường lối của Đảng Cộng sản Việt Nam</h4>
                        <p className="text-xs text-slate-500">Định hướng sự nghiệp xây dựng và bảo vệ Tổ quốc.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Google Drive Integration Manager */}
              <GoogleDriveManager onSelectFileForDiscussion={(file) => setSelectedFile(file)} />
            </motion.div>
          </div>

          {/* Right Column: Voice Interaction */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="sticky top-8 space-y-4"
            >
              {selectedFile && (
                <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Tài liệu thảo luận từ Drive:</p>
                      <p className="text-sm font-semibold">{selectedFile.name}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                  >
                    Bỏ chọn
                  </Button>
                </div>
              )}

              <VoiceChat systemInstruction={getSystemInstruction()} />
              
              <div className="mt-8 px-4">
                <h4 className="font-serif text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                  <span className="w-8 h-[1px] bg-slate-300" />
                  Gợi ý thảo luận (Cập nhật thời gian thực)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Mối quan hệ biện chứng giữa vật chất và ý thức",
                    "Thực tiễn trong tư tưởng Hồ Chí Minh",
                    "Phân tích phẩm chất Bộ đội Cụ Hồ trong thời kỳ mới",
                    "Định hướng xây dựng Quân đội tinh gọn mạnh theo các Nghị quyết mới nhất",
                    "Bảo vệ nền tảng tư tưởng của Đảng trên không gian mạng",
                    "Nghị quyết và chủ trương phát triển mới nhất của Đảng và Nhà nước"
                  ].map((tag) => (
                    <Badge key={tag} variant="secondary" className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer shadow-sm transition-all px-3 py-1.5 font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 py-10 mt-12 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="font-sans text-slate-400 text-sm">
            AI Avatar Trợ giảng - Trường Sĩ quan Chính trị <br/>
            Dự án nghiên cứu sư phạm kỹ thuật số & Dữ liệu thời gian thực
          </p>
        </div>
      </footer>
    </div>
  );
}
