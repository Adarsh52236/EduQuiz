import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, GripVertical, Save, Sparkles, Eye, Settings, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface QuizQuestion {
  id: string;
  questionText: string;
  questionType: 'multiple-choice' | 'true-false' | 'short-answer';
  points: number;
  options: string[];
  correctAnswer: string;
}

interface Class {
  id: string;
  name: string;
  classCode: string;
}

export default function CreateQuiz() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showClassDialog, setShowClassDialog] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [useAiGrading, setUseAiGrading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        await loadClasses();
        const initialId = `q-${Date.now()}`;
        setQuestions([{
          id: initialId,
          questionText: 'What is the time complexity of binary search?',
          questionType: 'multiple-choice',
          points: 10,
          options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
          correctAnswer: 'O(log n)'
        }]);
        setActiveQuestionId(initialId);
      } catch (error: any) {
        toast.error('Failed to initialize: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, []);

  const loadClasses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setClasses(data);
    } catch (error) {
      console.error(error);
    }
  };

  const addQuestion = () => {
    const id = `q-${Date.now()}`;
    setQuestions([...questions, {
      id,
      questionText: '',
      questionType: 'multiple-choice',
      points: 10,
      options: ['Option 1', 'Option 2'],
      correctAnswer: ''
    }]);
    setActiveQuestionId(id);
  };

  const updateQuestion = (id: string, field: keyof QuizQuestion, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleQuestionTypeChange = (id: string, type: 'multiple-choice' | 'true-false' | 'short-answer') => {
    setQuestions(questions.map(q => {
      if (q.id === id) {
        let options = q.options;
        if (type === 'true-false') options = ['True', 'False'];
        else if (type === 'short-answer') options = [];
        else if (type === 'multiple-choice' && q.questionType !== 'multiple-choice') options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
        return { ...q, questionType: type, options, correctAnswer: '' };
      }
      return q;
    }));
  };

  const handleSaveAndPublish = async () => {
    if (!selectedClassId) return toast.error('Please select a class');
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
      const quizType = questions[0]?.questionType || 'multiple-choice';

      const quizResponse = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quizTitle || 'Untitled Assessment',
          description: quizDescription,
          type: quizType,
          classId: selectedClassId,
          timeLimit,
          totalPoints,
          startTime: startTime ? new Date(startTime).toISOString() : null,
          endTime: endTime ? new Date(endTime).toISOString() : null,
          isPublished: true
        })
      });

      const quizData = await quizResponse.json();
      if (!quizResponse.ok) throw new Error(quizData.message);

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quizId: quizData.id,
            questionText: q.questionText,
            questionType: q.questionType,
            points: q.points,
            orderIndex: i,
            options: q.questionType === 'short-answer' ? null : JSON.stringify(q.options),
            correctAnswer: q.correctAnswer
          })
        });
      }

      toast.success('Assessment provisioned to cohort!');
      navigate('/teacher/quizzes');
    } catch (error: any) {
      toast.error(error.message || 'Deployment failed');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const activeQuestion = questions.find(q => q.id === activeQuestionId) || questions[0];

  return (
    <div className="flex h-[calc(100vh-56px)] bg-slate-50 -m-6 md:-m-8">
      {/* LEFT PANE: Builder */}
      <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white shadow-[10px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
        <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-slate-500" />
            <span className="font-semibold text-sm text-slate-700">Curriculum Builder</span>
          </div>
          <Button size="sm" onClick={() => setShowClassDialog(true)} className="h-8 shadow-sm">
            Deploy Assessment
          </Button>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-8 max-w-2xl mx-auto pb-20">
            {/* Assessment Meta */}
            <div className="space-y-4">
              <Input
                placeholder="Assessment Title (e.g., Module 1: Data Structures)"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                className="text-2xl font-bold h-14 bg-slate-50 border-slate-200 focus-visible:ring-primary/20"
              />
              <Textarea
                placeholder="Assessment directives for students..."
                value={quizDescription}
                onChange={(e) => setQuizDescription(e.target.value)}
                className="resize-none bg-slate-50 border-slate-200 focus-visible:ring-primary/20"
                rows={2}
              />
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Time Limit (Min)</Label>
                  <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(parseInt(e.target.value) || 30)} className="bg-slate-50 h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Start Time (Opt)</Label>
                  <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-slate-50 h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">End Time (Opt)</Label>
                  <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-slate-50 h-9 text-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-md">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-900">OmniBot AI Rubric</h4>
                    <p className="text-xs text-indigo-700/70">Auto-grade short answers & generate dynamic hints</p>
                  </div>
                </div>
                <Switch checked={useAiGrading} onCheckedChange={setUseAiGrading} />
              </div>
            </div>

            <div className="border-t border-slate-100 my-8"></div>

            {/* Questions List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Questions ({questions.length})</h3>
                <Badge variant="outline" className="bg-slate-50">{questions.reduce((a,b)=>a+b.points,0)} Total XP</Badge>
              </div>

              {questions.map((q, i) => (
                <Card 
                  key={q.id} 
                  className={`border-2 transition-all cursor-pointer ${activeQuestionId === q.id ? 'border-primary shadow-sm bg-white' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'}`}
                  onClick={() => setActiveQuestionId(q.id)}
                >
                  <div className="flex">
                    <div className="w-8 flex flex-col items-center py-4 border-r border-slate-100 text-slate-400">
                      <span className="text-xs font-bold">{i + 1}</span>
                      <GripVertical className="h-4 w-4 mt-2 opacity-50" />
                    </div>
                    <div className="flex-1 p-4">
                      {activeQuestionId === q.id ? (
                        <div className="space-y-4">
                          <Textarea
                            value={q.questionText}
                            onChange={(e) => updateQuestion(q.id, 'questionText', e.target.value)}
                            placeholder="Enter question text..."
                            className="text-base font-medium resize-none min-h-[80px]"
                          />
                          <div className="flex items-center gap-3">
                            <Select value={q.questionType} onValueChange={(v:any) => handleQuestionTypeChange(q.id, v)}>
                              <SelectTrigger className="w-[180px] h-9 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                                <SelectItem value="true-false">True / False</SelectItem>
                                <SelectItem value="short-answer">Short Answer</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs font-bold text-slate-500">XP:</Label>
                              <Input type="number" value={q.points} onChange={(e) => updateQuestion(q.id, 'points', parseInt(e.target.value)||1)} className="w-16 h-9" />
                            </div>
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setQuestions(questions.filter(x => x.id !== q.id)); }} className="ml-auto text-red-500 hover:bg-red-50 h-9 w-9">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="pt-4 border-t border-slate-100">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Options & Correct Answer</Label>
                            
                            {q.questionType === 'multiple-choice' && (
                              <div className="space-y-2">
                                {q.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex items-center gap-2">
                                    <input type="radio" checked={q.correctAnswer === opt} onChange={() => updateQuestion(q.id, 'correctAnswer', opt)} className="h-4 w-4 text-primary" />
                                    <Input value={opt} onChange={(e) => {
                                      const newOpts = [...q.options]; newOpts[oIdx] = e.target.value;
                                      updateQuestion(q.id, 'options', newOpts);
                                    }} className="h-9 text-sm" />
                                  </div>
                                ))}
                                <Button variant="ghost" size="sm" onClick={() => updateQuestion(q.id, 'options', [...q.options, `Option ${q.options.length+1}`])} className="text-primary mt-2">
                                  <Plus className="h-4 w-4 mr-2" /> Add Option
                                </Button>
                              </div>
                            )}

                            {q.questionType === 'true-false' && (
                              <div className="flex gap-4">
                                {['True', 'False'].map(opt => (
                                  <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" checked={q.correctAnswer === opt} onChange={() => updateQuestion(q.id, 'correctAnswer', opt)} className="h-4 w-4" />
                                    {opt}
                                  </label>
                                ))}
                              </div>
                            )}

                            {q.questionType === 'short-answer' && (
                              <Input value={q.correctAnswer} onChange={(e) => updateQuestion(q.id, 'correctAnswer', e.target.value)} placeholder="Exact answer or keyword (AI will use this to grade)" className="font-mono text-sm" />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium text-sm text-slate-800 line-clamp-2">{q.questionText || 'Empty Question'}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-mono">
                            <span>{q.questionType}</span>
                            <span>•</span>
                            <span className="text-primary font-bold">{q.points} XP</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}

              <Button variant="outline" onClick={addQuestion} className="w-full h-12 border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-primary transition-colors">
                <Plus className="h-4 w-4 mr-2" /> Append New Question
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT PANE: Live Preview (Student E-Sports view) */}
      <div className="w-1/2 flex flex-col bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
        
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 backdrop-blur z-10">
          <div className="flex items-center gap-2 text-slate-400">
            <Eye className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest font-bold">Live Student Preview</span>
          </div>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">Arena Engine v2.0</Badge>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-12 z-10 flex flex-col items-center justify-center">
          {activeQuestion ? (
            <div className="w-full max-w-xl animate-fade-in">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  <span className="text-slate-400 font-mono text-sm uppercase">Previewing Q{questions.findIndex(q => q.id === activeQuestion.id) + 1}</span>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/30 font-mono">
                  {activeQuestion.points} XP
                </Badge>
              </div>

              <h2 className="text-3xl font-bold text-white leading-tight mb-10 drop-shadow-md">
                {activeQuestion.questionText || 'Enter a question text to preview...'}
              </h2>

              <div className="space-y-4">
                {activeQuestion.questionType === 'multiple-choice' && activeQuestion.options.map((opt, i) => (
                  <div key={i} className="flex items-center space-x-3 p-5 rounded-xl border-2 border-white/10 bg-white/5 hover:border-white/20 transition-all text-white cursor-not-allowed">
                    <div className="h-5 w-5 rounded-full border border-white/30 flex items-center justify-center">
                      {activeQuestion.correctAnswer === opt && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </div>
                    <span className="text-lg font-medium">{opt || `Option ${i + 1}`}</span>
                  </div>
                ))}

                {activeQuestion.questionType === 'true-false' && (
                  <div className="grid grid-cols-2 gap-4">
                    {['True', 'False'].map((opt) => (
                      <div key={opt} className={`flex items-center justify-center p-6 rounded-xl border-2 transition-all cursor-not-allowed ${activeQuestion.correctAnswer === opt ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5 text-white/70'}`}>
                        <span className="text-xl font-bold tracking-wider uppercase">{opt}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeQuestion.questionType === 'short-answer' && (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-primary font-mono">{'>'}</span>
                    </div>
                    <Input disabled className="h-14 bg-white/5 border-white/10 text-white pl-10 font-mono text-lg" placeholder="Student terminal input..." />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-slate-600 font-mono text-sm text-center">
              [No question selected for preview]
            </div>
          )}
        </div>
      </div>

      {/* Class Deploy Dialog */}
      <Dialog open={showClassDialog} onOpenChange={setShowClassDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deploy Assessment</DialogTitle>
            <DialogDescription>
              Select the target cohort for this curriculum module. It will be instantly provisioned to all enrolled students.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {classes.map((cls) => (
              <div
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedClassId === cls.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-slate-900">{cls.name}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-1">ID: {cls.classCode}</p>
                  </div>
                  {selectedClassId === cls.id && <div className="h-2 w-2 rounded-full bg-primary" />}
                </div>
              </div>
            ))}
            {classes.length === 0 && (
              <div className="text-center p-4 border border-dashed rounded-lg text-slate-500 text-sm">
                No active cohorts found. Please provision a class first.
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowClassDialog(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSaveAndPublish} disabled={!selectedClassId || isSaving} className="flex-1 bg-primary">
              {isSaving ? 'Deploying...' : 'Deploy to Cohort'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
