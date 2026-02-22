
export enum Difficulty {
  RECOGNITION = 'Nhận biết',
  UNDERSTANDING = 'Thông hiểu',
  APPLICATION = 'Vận dụng',
  COMBINED = 'Tổng hợp'
}

export interface Lesson {
  chapter: string;
  lesson: string;
  summary: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonConfig {
  subject: string;
  grade: string;
  lessonNames: string[]; // Tên bài để hiển thị
  lessons: Lesson[];     // Dữ liệu đầy đủ để gửi cho AI
  difficulty: Difficulty;
  numQuestions: number;
  content?: string;
}

export type AppState = 'HOME' | 'QUIZ' | 'RESULT';
