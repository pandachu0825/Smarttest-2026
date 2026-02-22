
import { Question, LessonConfig, Lesson } from "../types";

/**
 * Lấy toàn bộ dữ liệu JSON của một khối lớp
 */
export async function fetchGradeData(grade: string): Promise<Record<string, Lesson[]>> {
  try {
    // Đảm bảo đường dẫn đúng khi chạy trong thư mục con XAMPP
    const response = await fetch(`./grade-${grade}.json`);
    if (!response.ok) throw new Error("Không tìm thấy dữ liệu lớp học");
    return await response.json();
  } catch (error) {
    console.error(`Lỗi tải dữ liệu khối lớp ${grade}:`, error);
    return {};
  }
}

/**
 * Lấy danh sách bài học của một môn học cụ thể trong khối lớp
 */
export async function fetchLessons(subject: string, grade: string): Promise<Lesson[]> {
  const data = await fetchGradeData(grade);
  return data[subject] || [];
}

/**
 * Gọi API Backend (Node.js/PHP Proxy) để tạo nội dung
 */
async function callBackendApi(prompt: string, systemInstruction: string): Promise<string> {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemInstruction })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Lỗi API');
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error("Lỗi gọi Backend API:", error);
    throw error;
  }
}

export async function generateQuestions(config: LessonConfig): Promise<Question[]> {
  const lessonContexts = config.lessons.map(l => `[${l.lesson}]: ${l.summary}`).join("\n");
  
  const lessonSource = config.lessons.length > 0 
    ? `Dựa trên nội dung các bài học sau:\n${lessonContexts}` 
    : `Dựa TRÊN DUY NHẤT nội dung tài liệu sau: ${config.content}`;

  const systemInstruction = `Bạn là chuyên gia khảo thí giáo dục chuyên nghiệp IVS SmartTest AI.
  YÊU CẦU QUAN TRỌNG NHẤT: BẠN PHẢI TẠO CHÍNH XÁC ${config.numQuestions} CÂU HỎI. 
  TRẢ VỀ: Một mảng JSON gồm đúng ${config.numQuestions} phần tử.
  Định dạng mỗi phần tử: { text, options (mảng 4), correctIndex (0-3), explanation }.
  
  QUY TẮC NGÔN NGỮ:
  - TOÀN BỘ nội dung giải thích đáp án (explanation) PHẢI được viết bằng Tiếng Việt, ngôn ngữ thân thiện, dễ hiểu.
  - Giải thích rõ tại sao đáp án đó đúng và các đáp án khác sai.`;

  const prompt = `NGUỒN DỮ LIỆU ĐỂ TẠO CÂU HỎI:
  ${lessonSource}

  CẤU HÌNH CHI TIẾT:
  - Môn: ${config.subject}, Khối: ${config.grade}, Độ khó: ${config.difficulty}.
  - Số lượng yêu cầu: ${config.numQuestions} câu hỏi.
  - VĂN BẢN: Dùng Unicode cho các ký hiệu (x², H₂O, √). Tuyệt đối không dùng LaTeX.`;

  try {
    const responseText = await callBackendApi(prompt, systemInstruction);
    const cleanText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const rawData = JSON.parse(cleanText || '[]');
    
    return rawData.map((q: any, index: number) => ({
      ...q,
      subject: config.subject,
      grade: config.grade,
      id: `q-${index}-${Date.now()}`
    }));
  } catch (error) {
    console.error("Lỗi tạo câu hỏi:", error);
    throw error;
  }
}

export async function generateAdvice(
  score: number, 
  total: number, 
  subject: string, 
  grade: string, 
  lessons: Lesson[],
  wrongQuestions: { text: string, explanation: string }[]
): Promise<string> {
  const lessonsContext = lessons.length > 0 
    ? `Các bài học: ${lessons.map(l => l.lesson).join(", ")}.`
    : `Nội dung: Tài liệu cá nhân.`;

  const wrongQuestionsContext = wrongQuestions.length > 0
    ? `Học sinh đã làm sai các câu hỏi sau:\n${wrongQuestions.map((q, i) => `${i+1}. ${q.text}`).join("\n")}`
    : "Học sinh đã làm đúng tất cả các câu hỏi.";

  const systemInstruction = `Bạn là giáo viên IVS SmartTest AI môn ${subject}. Học sinh đạt ${score}/${total} câu đúng.
  Bạn phải trả về một đối tượng JSON có cấu trúc: { "assessment": "...", "advice": "..." }.
  - "assessment": Nhận xét ngắn gọn về kết quả làm bài của học sinh dựa trên môn học và các câu sai.
  - "advice": Lời khuyên cụ thể để cải thiện kiến thức, tập trung vào các chủ đề của những câu làm sai.
  
  QUY TẮC:
  - Ngôn ngữ: Tiếng Việt 100%.
  - Không sáo rỗng, phải trúng đích dựa trên ngữ cảnh bài học và lỗi sai.`;
  
  const prompt = `NGỮ CẢNH:
  - Môn học: ${subject}
  - Khối: ${grade}
  - ${lessonsContext}
  - ${wrongQuestionsContext}
  
  YÊU CẦU: Phân tích các câu sai và đưa ra nhận xét, lời khuyên chuyên môn.`;

  try {
    const responseText = await callBackendApi(prompt, systemInstruction);
    return responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  } catch (error) {
    return JSON.stringify({ 
      assessment: "Kết quả cho thấy bạn cần rà soát lại các khái niệm cơ bản.", 
      advice: "Hãy tập trung ôn tập các nội dung trọng tâm của bài học." 
    });
  }
}
