
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Difficulty, Question, LessonConfig, AppState, Lesson } from './types';
import { GRADES, DIFFICULTIES } from './constants';
import { generateQuestions, fetchLessons, generateAdvice, fetchGradeData } from './services/geminiService';
import QuestionCard from './components/QuestionCard';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('HOME');
  const [activeTab, setActiveTab] = useState<'SGK' | 'CUSTOM'>('SGK');
  const [selectionMode, setSelectionMode] = useState<'SINGLE' | 'MULTIPLE'>('SINGLE');
  
  const [config, setConfig] = useState<LessonConfig>({
    subject: '',
    grade: '',
    lessonNames: [],
    lessons: [],
    difficulty: Difficulty.COMBINED,
    numQuestions: 10,
    content: ''
  });

  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [lessonList, setLessonList] = useState<Lesson[]>([]);
  const [isFetchingLessons, setIsFetchingLessons] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load state from LocalStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('ivs_smarttest_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setAppState(parsed.appState || 'HOME');
        setConfig(parsed.config || {
          subject: '',
          grade: '',
          lessonNames: [],
          lessons: [],
          difficulty: Difficulty.COMBINED,
          numQuestions: 10,
          content: ''
        });
        setQuestions(parsed.questions || []);
        setUserAnswers(parsed.userAnswers || []);
        setCurrentIndex(parsed.currentIndex || 0);
        setCorrectCount(parsed.correctCount || 0);
        setAiAdvice(parsed.aiAdvice || '');
      } catch (e) {
        console.error("Error parsing saved state", e);
      }
    }
  }, []);

  // Save state to LocalStorage whenever it changes
  useEffect(() => {
    const stateToSave = {
      appState,
      config,
      questions,
      userAnswers,
      currentIndex,
      correctCount,
      aiAdvice
    };
    localStorage.setItem('ivs_smarttest_state', JSON.stringify(stateToSave));
  }, [appState, config, questions, userAnswers, currentIndex, correctCount, aiAdvice]);

  const resetToEmpty = useCallback(() => {
    setConfig({
      subject: '',
      grade: '',
      lessonNames: [],
      lessons: [],
      difficulty: Difficulty.COMBINED,
      numQuestions: 10,
      content: ''
    });
    setLessonList([]);
    setAvailableSubjects([]);
    setAiAdvice('');
  }, []);

  // Effect để tải danh sách môn học khi khối lớp thay đổi
  useEffect(() => {
    if (activeTab === 'SGK' && config.grade) {
      fetchGradeData(config.grade).then(data => {
        const subjects = Object.keys(data);
        setAvailableSubjects(subjects);
        // Nếu môn học hiện tại không có trong khối lớp mới, hãy reset nó
        if (config.subject && !subjects.includes(config.subject)) {
          setConfig(prev => ({ ...prev, subject: '', lessonNames: [], lessons: [] }));
        }
      });
    } else {
      setAvailableSubjects([]);
    }
  }, [config.grade, activeTab]);

  // Effect để tải danh sách bài học khi môn học hoặc khối lớp thay đổi
  useEffect(() => {
    if (activeTab === 'SGK' && config.subject && config.grade) {
      setIsFetchingLessons(true);
      fetchLessons(config.subject, config.grade).then(lessons => {
        setLessonList(lessons);
        setConfig(prev => ({ ...prev, lessonNames: [], lessons: [] }));
        setIsFetchingLessons(false);
      });
    } else if (activeTab === 'SGK') {
      setLessonList([]);
      setConfig(prev => ({ ...prev, lessonNames: [], lessons: [] }));
    }
  }, [config.subject, config.grade, activeTab]);

  const toggleLessonSelection = (lessonObj: Lesson) => {
    if (selectionMode === 'SINGLE') {
      setConfig(prev => ({ 
        ...prev, 
        lessonNames: [lessonObj.lesson],
        lessons: [lessonObj]
      }));
    } else {
      setConfig(prev => {
        const isSelected = prev.lessonNames.includes(lessonObj.lesson);
        if (isSelected) {
          return { 
            ...prev, 
            lessonNames: prev.lessonNames.filter(l => l !== lessonObj.lesson),
            lessons: prev.lessons.filter(l => l.lesson !== lessonObj.lesson)
          };
        } else {
          return { 
            ...prev, 
            lessonNames: [...prev.lessonNames, lessonObj.lesson],
            lessons: [...prev.lessons, lessonObj]
          };
        }
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setConfig(prev => ({ ...prev, content: text }));
    };
    reader.readAsText(file);
  };

  const startQuiz = async () => {
    setIsLoading(true);
    try {
      const generated = await generateQuestions(config);
      setQuestions(generated);
      setUserAnswers(new Array(generated.length).fill(null));
      setCurrentIndex(0);
      setCorrectCount(0);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setAiAdvice('');
      setAppState('QUIZ');
    } catch (error) {
      alert("Lỗi khi xử lý nội dung. Vui lòng thử lại!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (index: number) => {
    setSelectedAnswer(index);
    setShowFeedback(true);
    
    const newAnswers = [...userAnswers];
    newAnswers[currentIndex] = index;
    setUserAnswers(newAnswers);

    if (index === questions[currentIndex].correctIndex) {
      setCorrectCount(prev => prev + 1);
    }
  };

  const nextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      setAppState('RESULT');
      setLoadingAdvice(true);
      
      const wrongQuestions = questions.filter((q, idx) => userAnswers[idx] !== q.correctIndex)
        .map(q => ({ text: q.text, explanation: q.explanation }));

      const advice = await generateAdvice(
        correctCount, 
        questions.length, 
        config.subject, 
        config.grade,
        config.lessons,
        wrongQuestions
      );
      setAiAdvice(advice);
      setLoadingAdvice(false);
    }
  };

  const goHome = () => {
    resetToEmpty();
    localStorage.removeItem('ivs_smarttest_state');
    setAppState('HOME');
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-indigo-600 text-white p-12 text-center animate-pulse">
        <div className="w-32 h-32 border-8 border-white border-t-transparent rounded-full animate-spin mb-10"></div>
        <h1 className="text-6xl font-black mb-4 uppercase tracking-tighter">Đang chuẩn bị câu hỏi...</h1>
        <p className="text-2xl font-bold opacity-70">Hệ thống AI đang phân tích nội dung bài giảng chuyên sâu.</p>
      </div>
    );
  }

  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  return (
    <div className="h-screen w-screen bg-blue-50 overflow-hidden flex flex-col font-['Quicksand']">
      {appState === 'HOME' && (
        <div className="flex-1 flex flex-col overflow-hidden animate-fade-in p-4 lg:p-8">
          <header className="mb-4 flex items-center justify-between shrink-0">
            <div className="flex items-center">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">IVS SmartTest AI</h1>
                <p className="text-indigo-600 font-black uppercase text-[8px] tracking-[0.4em] mt-1 italic">HỆ THỐNG GIÁO DỤC IVS</p>
              </div>
            </div>
            <div className="bg-white px-4 py-2 rounded-xl border-2 border-slate-100 shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
              <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest">DỮ LIỆU CHUẨN SGK</span>
            </div>
          </header>

          <main className="flex-1 min-h-0 flex flex-col items-center justify-center">
            <div className="w-full max-w-7xl h-full bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col border-[6px] border-white">
              <div className="flex bg-slate-100 p-1.5 gap-1.5 shrink-0">
                <button 
                  onClick={() => { setActiveTab('SGK'); resetToEmpty(); }}
                  className={`flex-1 py-3 text-base font-black rounded-xl transition-all flex items-center justify-center gap-3 ${activeTab === 'SGK' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:bg-slate-200/50'}`}
                >
                  <span className="text-lg">📚</span> SÁCH GIÁO KHOA
                </button>
                <button 
                  onClick={() => { setActiveTab('CUSTOM'); resetToEmpty(); }}
                  className={`flex-1 py-3 text-base font-black rounded-xl transition-all flex items-center justify-center gap-3 ${activeTab === 'CUSTOM' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:bg-slate-200/50'}`}
                >
                  <span className="text-lg">📝</span> NHẬP NỘI DUNG RIÊNG
                </button>
              </div>

              <div className="flex-1 min-h-0 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
                <div className="lg:col-span-4 flex flex-col gap-4 min-h-0 overflow-y-auto no-scrollbar pr-2">
                  <div className="space-y-4">
                    {/* KHỐI LỚP TRƯỚC */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Khối lớp</label>
                      <select 
                        className="w-full p-3 text-base border-4 border-slate-50 rounded-2xl bg-slate-50 focus:border-indigo-600 outline-none font-black text-slate-900 shadow-inner"
                        value={config.grade}
                        onChange={(e) => setConfig({...config, grade: e.target.value})}
                      >
                        <option value="">-- Chọn Lớp --</option>
                        {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                      </select>
                    </div>

                    {/* MÔN HỌC SAU - DỰA TRÊN JSON */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Môn học</label>
                      <select 
                        disabled={!config.grade}
                        className="w-full p-3 text-base border-4 border-slate-50 rounded-2xl bg-slate-50 focus:border-indigo-600 outline-none font-black text-slate-900 shadow-inner disabled:opacity-50"
                        value={config.subject}
                        onChange={(e) => setConfig({...config, subject: e.target.value})}
                      >
                        <option value="">{config.grade ? "-- Chọn Môn --" : "-- Chọn lớp trước --"}</option>
                        {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-[2rem] border-2 border-slate-100 space-y-6">
                    <div className="space-y-3">
                      <label className="block text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Số câu hỏi</label>
                      <div className="flex justify-center gap-2">
                        {[10, 20, 30].map(n => (
                          <button
                            key={n}
                            onClick={() => setConfig({...config, numQuestions: n})}
                            className={`w-11 h-11 rounded-xl font-black text-sm transition-all border-4 ${config.numQuestions === n ? 'bg-indigo-600 border-indigo-400 text-white scale-110 shadow-lg' : 'bg-white border-white text-slate-300'}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="block text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Độ khó</label>
                      <div className="grid grid-cols-2 gap-2">
                        {DIFFICULTIES.map(d => (
                          <button 
                            key={d}
                            onClick={() => setConfig({...config, difficulty: d})}
                            className={`py-2 rounded-xl text-[8px] font-black transition-all border-2 ${config.difficulty === d ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white border-white text-slate-400'}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 h-full flex flex-col min-h-0 overflow-hidden">
                  {activeTab === 'SGK' ? (
                    <div className="flex flex-col h-full border-4 border-slate-50 rounded-[2rem] bg-slate-50/30 overflow-hidden">
                      <div className="p-3 bg-white border-b-2 border-slate-100 flex items-center justify-between shrink-0">
                         <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest ml-2">Kết nối tri thức với cuộc sống</span>
                         <div className="flex gap-2">
                            <button onClick={() => {setSelectionMode('SINGLE'); setConfig({...config, lessonNames: [], lessons: []})}} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${selectionMode === 'SINGLE' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>Từng bài</button>
                            <button onClick={() => {setSelectionMode('MULTIPLE'); setConfig({...config, lessonNames: [], lessons: []})}} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${selectionMode === 'MULTIPLE' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>Học nhiều bài</button>
                         </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                        {(!config.subject || !config.grade) ? (
                          <div className="h-full flex flex-col items-center justify-center opacity-30 text-center p-6">
                            <span className="text-5xl mb-4">📚</span>
                            <p className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Vui lòng chọn khối lớp và môn học để hiển thị bài học</p>
                          </div>
                        ) : isFetchingLessons ? (
                          <div className="h-full flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : (
                          Object.entries(
                            lessonList.reduce((acc: any, curr) => {
                              if (!acc[curr.chapter]) acc[curr.chapter] = [];
                              acc[curr.chapter].push(curr);
                              return acc;
                            }, {})
                          ).map(([chapter, lessons]: [any, any]) => (
                            <div key={chapter} className="space-y-2">
                              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1">{chapter}</h3>
                              {lessons.map((item: Lesson) => (
                                <button 
                                  key={item.lesson}
                                  onClick={() => toggleLessonSelection(item)}
                                  className={`w-full p-4 rounded-xl text-left font-black transition-all border-4 flex items-center gap-4 ${config.lessonNames.includes(item.lesson) ? 'bg-indigo-600 text-white border-indigo-400 shadow-md translate-x-1' : 'bg-white text-slate-700 border-white hover:border-indigo-100'}`}
                                >
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 ${config.lessonNames.includes(item.lesson) ? 'bg-white text-indigo-600 border-white' : 'bg-slate-100 border-slate-200'}`}>
                                    {config.lessonNames.includes(item.lesson) && <span className="text-[9px]">✓</span>}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="truncate uppercase text-[10px] tracking-tight">{item.lesson}</span>
                                    <span className={`text-[8px] font-medium opacity-60 italic truncate max-w-[400px]`}>{item.summary}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col gap-4 overflow-hidden">
                      <div className="flex-1 flex flex-col border-4 border-slate-50 rounded-[2rem] bg-white shadow-inner overflow-hidden">
                        <div className="p-3 bg-indigo-50 flex items-center justify-between border-b-2 border-indigo-100 shrink-0">
                          <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest ml-2">Soạn thảo nội dung</span>
                          <span className="text-[9px] font-black text-indigo-400 uppercase">{config.content?.length || 0} ký tự</span>
                        </div>
                        <textarea 
                          className="flex-1 p-5 text-base font-medium outline-none resize-none bg-transparent placeholder:text-slate-200 no-scrollbar"
                          placeholder="Dán hoặc nhập nội dung bài giảng của bạn để AI tự động chuyển thành câu hỏi..."
                          value={config.content}
                          onChange={(e) => setConfig({...config, content: e.target.value})}
                        />
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-14 bg-slate-50 hover:bg-indigo-50 border-4 border-dashed border-slate-200 hover:border-indigo-200 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all group shrink-0"
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">📎</span>
                        <p className="font-black text-slate-500 group-hover:text-indigo-600 uppercase text-[9px] tracking-widest">Đính kèm tệp văn bản (.txt)</p>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 md:p-6 bg-slate-50 border-t-4 border-slate-100 flex items-center justify-center shrink-0">
                <button 
                  disabled={activeTab === 'SGK' ? (config.lessonNames.length === 0) : !config.content}
                  onClick={startQuiz}
                  className="w-full max-w-2xl py-4 bg-indigo-600 text-white text-xl font-black rounded-[1.5rem] shadow-xl hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-20 disabled:pointer-events-none uppercase tracking-tighter border-b-[6px] border-indigo-900"
                >
                  BẮT ĐẦU CHINH PHỤC 🚀
                </button>
              </div>
            </div>
          </main>
        </div>
      )}

      {appState === 'QUIZ' && (
        <div className="flex-1 flex flex-col overflow-hidden relative animate-fade-in">
          <header className="absolute top-0 left-0 w-full p-6 flex items-center justify-between z-20 pointer-events-none">
             <button onClick={goHome} className="pointer-events-auto bg-white/95 backdrop-blur-md px-6 py-3 rounded-xl shadow-xl border-2 border-slate-100 font-black text-slate-800 text-[10px] hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest">🏠 Trang chủ</button>
             <div className="bg-slate-900/90 backdrop-blur-md px-8 py-3 rounded-xl text-white font-black text-lg border-2 border-slate-700 shadow-2xl">
               {currentIndex + 1} / {questions.length}
             </div>
             <div className="bg-amber-400 px-6 py-3 rounded-xl border-4 border-white shadow-xl flex items-center gap-3">
                <span className="text-amber-950 font-black text-2xl leading-none">{questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0}</span>
                <span className="text-[7px] font-black text-amber-900 uppercase leading-none">ĐIỂM</span>
             </div>
          </header>
          <div className="flex-1">
            <QuestionCard 
              question={questions[currentIndex]}
              onAnswer={handleAnswer}
              showFeedback={showFeedback}
              selectedAnswer={selectedAnswer}
              onNext={nextQuestion}
            />
          </div>
        </div>
      )}

      {appState === 'RESULT' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 bg-indigo-900 animate-fade-in overflow-hidden h-screen">
          <div className="w-full max-w-2xl bg-white rounded-[3.5rem] p-8 md:p-10 text-center animate-zoom-in border-[10px] border-indigo-400 shadow-2xl flex flex-col max-h-[90vh]">
             <div className="shrink-0">
               <div className="mb-4 text-6xl md:text-7xl drop-shadow-2xl">🏆</div>
               <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-2 tracking-tighter uppercase leading-none">KẾT QUẢ</h2>
               <p className="text-base md:text-lg font-black text-indigo-600 uppercase tracking-[0.3em] mb-6 opacity-60 italic">BẠN ĐÃ HOÀN THÀNH BÀI TẬP</p>
             </div>
             
             <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
                <div className="bg-slate-50 p-4 md:p-6 rounded-3xl border-2 border-slate-100">
                   <p className="text-[9px] font-black text-slate-400 uppercase mb-1">ĐIỂM SỐ</p>
                   <p className="text-4xl md:text-6xl font-black text-indigo-600 leading-none">{score}</p>
                </div>
                <div className="bg-slate-50 p-4 md:p-6 rounded-3xl border-2 border-slate-100">
                   <p className="text-[9px] font-black text-slate-400 uppercase mb-1">CHÍNH XÁC</p>
                   <p className="text-4xl md:text-6xl font-black text-emerald-500 leading-none">{correctCount}/{questions.length}</p>
                </div>
             </div>

             <div className="mb-6 p-6 md:p-8 bg-indigo-50 rounded-[2.5rem] border-4 border-dashed border-indigo-200 text-left relative flex flex-col min-h-0">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">📝</div>
                <h4 className="text-indigo-600 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2 shrink-0">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
                  Nhận xét chuyên môn từ AI
                </h4>
                <div className="overflow-y-auto custom-scrollbar pr-2">
                  {loadingAdvice ? (
                    <div className="flex items-center gap-4 py-4">
                      <div className="w-5 h-5 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-indigo-400 font-bold italic text-sm">AI đang phân tích thực trạng kiến thức...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        try {
                          const parsed = JSON.parse(aiAdvice || '{}');
                          return (
                            <>
                              <div>
                                <h5 className="font-black text-indigo-900 text-sm uppercase mb-1">Nhận xét:</h5>
                                <p className="text-slate-700 font-medium text-base md:text-lg leading-relaxed italic">
                                  "{parsed.assessment || aiAdvice}"
                                </p>
                              </div>
                              {parsed.advice && (
                                <div>
                                  <h5 className="font-black text-indigo-900 text-sm uppercase mb-1">Lời khuyên:</h5>
                                  <p className="text-slate-700 font-medium text-base md:text-lg leading-relaxed">
                                    {parsed.advice}
                                  </p>
                                </div>
                              )}
                            </>
                          );
                        } catch (e) {
                          return (
                            <p className="text-slate-700 font-medium text-base md:text-lg leading-relaxed italic">
                              "{aiAdvice}"
                            </p>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
             </div>

             <div className="flex flex-col gap-3 shrink-0">
                <button onClick={startQuiz} className="w-full py-4 md:py-5 bg-indigo-600 text-white text-xl md:text-2xl font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 border-b-[8px] border-indigo-800 uppercase tracking-tighter">ÔN TẬP LẠI →</button>
                <button onClick={goHome} className="w-full py-3 bg-slate-100 text-slate-400 text-base md:text-lg font-black rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest">VỀ TRANG CHỦ</button>
             </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes zoom-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-zoom-in { animation: zoom-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        select { background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 1rem center; background-size: 1.2rem; }
      `}</style>
    </div>
  );
};

export default App;
