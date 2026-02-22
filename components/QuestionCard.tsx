
import React, { useState } from 'react';
import { Question } from '../types';

interface QuestionCardProps {
  question: Question;
  onAnswer: (index: number) => void;
  showFeedback: boolean;
  selectedAnswer: number | null;
  onNext: () => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, onAnswer, showFeedback, selectedAnswer, onNext }) => {
  const [hideOverlay, setHideOverlay] = useState(false);

  return (
    <div className="h-full w-full flex items-center justify-center p-4 md:p-8 lg:p-12">
      {/* Lời giải Overlay */}
      {showFeedback && !hideOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-indigo-950/40 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl border-[10px] border-indigo-600 overflow-hidden flex flex-col animate-zoom-in max-h-[90vh]">
            <div className={`p-6 flex items-center justify-between shrink-0 ${selectedAnswer === question.correctIndex ? 'bg-green-500' : 'bg-red-500'}`}>
               <div className="flex items-center gap-6">
                 <span className="text-5xl">{selectedAnswer === question.correctIndex ? '🌟' : '💡'}</span>
                 <h3 className="text-3xl font-black text-white uppercase tracking-tighter">
                   {selectedAnswer === question.correctIndex ? 'Đáp án đúng!' : 'Cần cố gắng thêm!'}
                 </h3>
               </div>
               <div className="flex gap-4">
                  <button onClick={() => setHideOverlay(true)} className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-xl text-white font-bold border border-white/40 transition-all uppercase text-[10px] tracking-widest">Xem câu hỏi</button>
                  <div className="bg-white text-indigo-900 px-8 py-2 rounded-xl font-black text-xl shadow-lg">ĐÁP ÁN: {String.fromCharCode(65 + question.correctIndex)}</div>
               </div>
            </div>
            
            <div className="p-10 md:p-14 flex-1 overflow-y-auto no-scrollbar">
               <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-1.5 bg-indigo-600 rounded-full"></div>
                 <h4 className="text-indigo-600 font-black text-lg uppercase tracking-widest">Hướng dẫn giải chi tiết</h4>
               </div>
               <div className="text-2xl md:text-3xl text-slate-800 font-medium leading-[1.8] whitespace-pre-wrap">
                 {question.explanation}
               </div>
            </div>

            <div className="p-8 bg-slate-50 border-t-4 border-slate-100 flex justify-center items-center shrink-0">
               <button onClick={onNext} className="bg-indigo-600 text-white text-3xl font-black px-16 py-6 rounded-[2rem] shadow-xl hover:bg-indigo-700 transition-all transform hover:scale-105 active:scale-95 border-b-[10px] border-indigo-900 uppercase tracking-tighter">
                 TIẾP TỤC HỌC TẬP →
               </button>
            </div>
          </div>
        </div>
      )}

      {showFeedback && hideOverlay && (
        <button onClick={() => setHideOverlay(false)} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-indigo-600 text-white px-10 py-4 rounded-full text-xl font-black shadow-2xl animate-bounce border-4 border-white">QUAY LẠI LỜI GIẢI</button>
      )}

      {/* Nội dung câu hỏi trong Card trắng */}
      <div className={`w-full max-w-5xl bg-white rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.1)] p-8 md:p-14 flex flex-col transition-all duration-500 border-[8px] border-white ${showFeedback && !hideOverlay ? 'scale-95 opacity-5 blur-md' : 'scale-100 opacity-100 blur-0'}`}>
        <div className="mb-10 text-center">
          <span className="inline-block bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-lg font-black text-[10px] uppercase mb-6 tracking-widest border border-indigo-100">
            Môn {(question as any).subject} - Lớp {(question as any).grade}
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.25] tracking-tight">{question.text}</h2>
        </div>
        
        {/* Đáp án dạng Grid 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {question.options.map((option, idx) => (
            <button key={idx} disabled={showFeedback} onClick={() => onAnswer(idx)}
              className={`group relative p-6 text-left border-[3px] rounded-[2rem] transition-all duration-300 flex items-center shadow-md ${showFeedback ? (idx === question.correctIndex ? 'bg-green-50 border-green-500 text-green-800 scale-[1.02] z-10' : (idx === selectedAnswer ? 'bg-red-50 border-red-500 text-red-800' : 'bg-slate-50 border-slate-100 text-slate-400 opacity-50')) : 'bg-white border-slate-50 hover:border-indigo-500 hover:-translate-y-1 text-slate-700 active:scale-95'}`}>
              <span className={`w-12 h-12 flex items-center justify-center rounded-xl mr-5 text-2xl font-black border-4 shrink-0 transition-all ${showFeedback && idx === question.correctIndex ? 'bg-green-600 text-white border-green-400' : 'bg-slate-100 text-slate-500 border-white group-hover:bg-indigo-600 group-hover:text-white'}`}>
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="text-xl md:text-2xl font-bold leading-tight flex-1">{option}</span>
              {showFeedback && idx === question.correctIndex && <div className="absolute -top-3 -right-3 bg-green-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-lg border-2 border-white animate-bounce">✓</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuestionCard;
