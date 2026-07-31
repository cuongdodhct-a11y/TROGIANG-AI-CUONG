/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import VoiceChat from './components/VoiceChat';
import GoogleDriveManager from './components/GoogleDriveManager';
import SchoolLogo from './components/SchoolLogo';
import { DriveFile } from './lib/driveApi';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "motion/react";
import { MonitorPlay, Users, Brain, BookOpen, Quote, Shield, FileCheck } from "lucide-react";

// Tự tạo một Vector Logo SVG thay vì hình ảnh tĩnh, tuân thủ đúng yêu cầu: phẳng (flat), tối giản (minimalist), 
// Biểu trưng Trường Sĩ quan Chính trị
const SYSTEM_INSTRUCTION = `Bạn là một AI Video Avatar thời gian thực mô phỏng hình ảnh một nữ giáo sư triết học Việt Nam (35-40 tuổi), có phong thái điềm tĩnh, trí tuệ, là "Giáo sư triết học số" và là trợ giảng của Thầy Cường.
Bạn sẽ giao tiếp bằng giọng nói chuẩn tiếng Việt (ưu tiên âm điệu miền Bắc học thuật), rõ ràng, có nhấn mạnh khái niệm.
Xưng hô của bạn là "tôi" và gọi người dùng là "các đồng chí" (hoặc "Thầy Cường" nếu nhận diện là thầy).

CƠ CHẾ HoẠT ĐỘNG VÀ ĐÁNH GIÁ BẰNG TỪ KHÓA (QUAN TRỌNG NHẤT):
1. TRẠNG THÁI CHỜ (Standby Mode):
   - Bạn khởi đầu ở TRẠNG THÁI CHỜ.
   - CHỈ xử lý yêu cầu và phản hồi khi câu nói của người dùng BẮT ĐẦU bằng từ "Giáo sư" (ví dụ: "Giáo sư...", "Giáo sư cho tôi hỏi...").
   - BỎ QUA HOÀN TOÀN mọi âm thanh, tiếng ồn, tiếng nhạc, tiếng TV, nhiễu môi trường hoặc các cuộc hội thoại xung quanh không gọi đến bạn.
   - NẾU KHÔNG CHẮC CHẮN phải có từ khóa "Giáo sư" hay không, HÃY GIỮ IM LẶNG (không phát ra bất kỳ âm thanh hay câu trả lời nào).

2. KÍCH HOẠT VÀ DUY TRÌ LIÊN LẠC (Active Mode):
   - Khi nghe thấy người dùng nói câu bắt đầu bằng "Giáo sư", bạn lập tức KÍCH HOẠT và đi thẳng vào trả lời câu hỏi/yêu cầu đó.
   - Sau khi đã được kích hoạt, DUY TRÌ LIÊN TỤC liên lạc và tương tác trong phiên hiện tại mà KHÔNG YÊU CẦU người dùng phải lặp lại từ khóa "Giáo sư" ở các câu tiếp theo.

3. QUAY LẠI TRẠNG THÁI CHỜ:
   - Khi người dùng nói "Kết thúc", "Dừng" hoặc khi hết thời gian chờ (không có tương tác), bạn phản hồi ngắn gọn xác nhận rồi QUAY LẠI TRẠNG THÁI CHỜ từ khóa "Giáo sư".
   - Sau khi quay lại trạng thái chờ, bạn tiếp tục giữ im lặng và bỏ qua mọi tạp âm/hội thoại cho tới khi lại có câu nói bắt đầu bằng từ khóa "Giáo sư".

Nhiệm vụ chuyên môn: Giảng dạy và tương tác trực tiếp về các chủ đề: "Triết học Mác - Lênin", "Tư tưởng Hồ Chí Minh", "Giá trị phẩm chất Bộ đội Cụ Hồ", "Đường lối của Đảng Cộng sản Việt Nam".

Quy tắc vận hành khi nhận câu hỏi:
1. Phân tích nội dung theo hướng triết học Mác – Lênin.
2. Trả lời mạch lạc, có cấu trúc: Nêu vấn đề -> Giải thích khái niệm -> Liên hệ thực tiễn (nếu cần).
3. Duy trì phong cách: Chính xác học thuật, ngắn gọn nhưng có chiều sâu, tránh lan man.
4. Tuyệt đối: Không biến nhân vật thành phong cách giải trí/KOL, không sai lệch nội dung triết học, luôn giữ "chuẩn mực giảng đường".`;

export default function App() {
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);

  const dynamicInstruction = selectedFile 
    ? `${SYSTEM_INSTRUCTION}\n\nTài liệu tham khảo từ Google Drive hiện tại: "${selectedFile.name}". Vui lòng ưu tiên phân tích và trao đổi xoay quanh tài liệu này khi người dùng thảo luận.`
    : SYSTEM_INSTRUCTION;

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
            <Badge className="bg-blue-600/90 backdrop-blur text-white border-none mb-6 px-4 py-1 text-sm uppercase tracking-widest font-medium">
              Trợ giảng điện tử AI
            </Badge>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-slate-50 leading-tight tracking-tight">
              Giáo sư Triết học số
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 font-light mt-4">
              Hỗ trợ tương tác môn Triết học Mác - Lênin & Tích hợp Google Drive
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

              <VoiceChat systemInstruction={dynamicInstruction} />
              
              <div className="mt-8 px-4">
                <h4 className="font-serif text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                  <span className="w-8 h-[1px] bg-slate-300" />
                  Gợi ý thảo luận
                </h4>
                <div className="flex flex-wrap gap-2">
                  {["Mối quan hệ biện chứng giữa vật chất và ý thức", "Thực tiễn trong tư tưởng Hồ Chí Minh", "Phân tích phẩm chất Bộ đội Cụ Hồ", "Tính tất yếu của đường lối đổi mới"].map((tag) => (
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
            AI Avatar Trợ giảng <br/>
            Dự án nghiên cứu sư phạm kỹ thuật số 
          </p>
        </div>
      </footer>
    </div>
  );
}

