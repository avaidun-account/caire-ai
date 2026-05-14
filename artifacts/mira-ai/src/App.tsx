import React, { useState, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useRunTriage } from "@workspace/api-client-react";
import { TriageResult } from "@workspace/api-zod/src/generated/types/triageResult";
import { 
  AlertCircle,
  Ambulance, 
  Clock, 
  Home, 
  CheckCircle2, 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  X,
  ShieldAlert,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const queryClient = new QueryClient();

// Types for file handling
type UploadedFile = {
  name: string;
  mimeType: string;
  content: string; // base64
  preview?: string; // object url for images
};

// Urgency details mapping
const URGENCY_DETAILS = {
  1: {
    bg: "bg-red-500",
    text: "text-white",
    icon: Ambulance,
    title: "Seek emergency care now",
    desc: "Call 911 or go to the ER immediately.",
    badgeClass: "bg-red-100 text-red-800 border-red-200"
  },
  2: {
    bg: "bg-orange-500",
    text: "text-white",
    icon: Clock,
    title: "See a doctor within 24 hours",
    desc: "Contact your doctor or urgent care today.",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200"
  },
  3: {
    bg: "bg-green-600",
    text: "text-white",
    icon: Home,
    title: "Monitor at home",
    desc: "Schedule an appointment if symptoms persist or worsen.",
    badgeClass: "bg-green-100 text-green-800 border-green-200"
  },
  4: {
    bg: "bg-blue-500",
    text: "text-white",
    icon: CheckCircle2,
    title: "Low concern — monitor",
    desc: "Rest and monitor. Seek care if anything changes.",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200"
  }
} as const;

function TriageApp() {
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState<boolean>(() => {
    return localStorage.getItem("mira-disclaimer-accepted") === "true";
  });
  
  const [symptoms, setSymptoms] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [result, setResult] = useState<TriageResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triageMutation = useRunTriage();

  const handleAcceptDisclaimer = () => {
    localStorage.setItem("mira-disclaimer-accepted", "true");
    setHasAcceptedDisclaimer(true);
  };

  const handleReset = () => {
    setSymptoms("");
    setFiles([]);
    setResult(null);
    triageMutation.reset();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    if (files.length + selectedFiles.length > 4) {
      alert("Maximum 4 files allowed.");
      return;
    }

    selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        const base64Content = base64String.split(',')[1];
        
        const isImage = file.type.startsWith('image/');
        
        setFiles(prev => [...prev, {
          name: file.name,
          mimeType: file.type,
          content: base64Content,
          preview: isImage ? URL.createObjectURL(file) : undefined
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleAnalyze = () => {
    if (!symptoms.trim()) return;
    
    triageMutation.mutate(
      {
        data: {
          symptoms,
          files: files.length > 0 ? files.map(f => ({
            name: f.name,
            mimeType: f.mimeType,
            content: f.content
          })) : undefined
        }
      },
      {
        onSuccess: (data) => {
          setResult(data as unknown as TriageResult);
        }
      }
    );
  };

  const renderDisclaimer = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[100dvh] flex items-center justify-center p-4 bg-background"
    >
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
            <ShieldAlert size={24} />
          </div>
          <CardTitle className="text-2xl font-serif text-foreground">Important Notice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            This is AI-generated reference info only, not medical advice or diagnosis. Not a substitute for a doctor.
          </p>
          <p>
            No medications or treatments recommended. In a life-threatening emergency, call 911 immediately.
          </p>
          <p className="font-medium text-foreground">
            By continuing, user agrees to consult a healthcare professional.
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full text-base h-12" 
            size="lg" 
            onClick={handleAcceptDisclaimer}
            data-testid="button-accept-disclaimer"
          >
            I understand — continue
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );

  const renderInput = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-2xl mx-auto w-full space-y-8"
    >
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground">Caire AI</h1>
        <p className="text-muted-foreground">Home health triage reference</p>
      </div>

      <div className="space-y-4 bg-card p-6 rounded-2xl shadow-sm border">
        <div className="space-y-2">
          <label htmlFor="symptoms" className="text-sm font-medium text-foreground block">
            Describe the symptoms
          </label>
          <Textarea 
            id="symptoms"
            placeholder="My 7-year-old has had a fever of 103°F for 2 days, sore throat, and won't eat. No rash."
            className="min-h-[150px] resize-y text-base p-4"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            disabled={triageMutation.isPending}
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-foreground">Attachments (Optional)</span>
            <span className="text-xs text-muted-foreground">{files.length}/4 files</span>
          </div>
          
          {files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {files.map((file, idx) => (
                <div key={idx} className="relative group rounded-xl border bg-muted/50 aspect-square overflow-hidden flex flex-col items-center justify-center p-2">
                  {file.preview ? (
                    <img src={file.preview} alt={file.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                  )}
                  {!file.preview && <span className="text-[10px] text-muted-foreground truncate w-full text-center px-1">{file.name}</span>}
                  
                  <button 
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    type="button"
                    disabled={triageMutation.isPending}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {files.length < 4 && (
            <div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,application/pdf"
                multiple
                onChange={handleFileUpload}
                disabled={triageMutation.isPending}
              />
              <Button 
                type="button" 
                variant="outline" 
                className="w-full border-dashed border-2 hover:bg-muted/50 h-auto py-4"
                onClick={() => fileInputRef.current?.click()}
                disabled={triageMutation.isPending}
              >
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <UploadCloud size={20} />
                  <span className="text-sm">Click to upload images or PDF</span>
                </div>
              </Button>
            </div>
          )}
        </div>

        <Button 
          className="w-full h-14 text-base" 
          size="lg"
          disabled={!symptoms.trim() || triageMutation.isPending}
          onClick={handleAnalyze}
          data-testid="button-analyze"
        >
          Analyze symptoms
        </Button>
      </div>

      {triageMutation.isError && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>There was an error connecting to the AI models. Please try again.</p>
        </div>
      )}
    </motion.div>
  );

  const renderAnalyzing = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto w-full space-y-8"
    >
      <div className="text-center space-y-2 opacity-50 pointer-events-none">
        <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground">Caire AI</h1>
        <p className="text-muted-foreground">Home health triage reference</p>
      </div>

      <div className="text-center py-12 space-y-8">
        <Spinner size="lg" className="mx-auto text-primary" />
        <p className="text-lg font-medium animate-pulse text-foreground">Consulting 3 AI models simultaneously...</p>
        
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
          {['Claude', 'GPT', 'Gemini'].map(model => (
            <div key={model} className="bg-card border rounded-xl p-4 flex flex-col items-center gap-3">
              <Spinner size="sm" className="text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">{model}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderResults = () => {
    if (!result) return null;

    const urgencyInfo = URGENCY_DETAILS[result.consensus_urgency as keyof typeof URGENCY_DETAILS] || URGENCY_DETAILS[4];
    const UrgencyIcon = urgencyInfo.icon;

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto w-full space-y-6 pb-24"
      >
        <div className="flex justify-between items-center pb-4 border-b">
          <h1 className="text-2xl font-serif font-medium text-foreground">Caire AI</h1>
          <Button variant="ghost" onClick={handleReset} data-testid="button-reset">
            Start a new assessment
          </Button>
        </div>

        {/* Urgency Banner */}
        <div className={`rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${urgencyInfo.bg} ${urgencyInfo.text} shadow-md`}>
          <div className="bg-white/20 p-3 rounded-full shrink-0">
            <UrgencyIcon size={32} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-semibold mb-1">{urgencyInfo.title}</h2>
            <p className="opacity-90 text-sm md:text-base">{urgencyInfo.desc}</p>
          </div>
        </div>

        {/* Model Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {result.results.map((modelResult, idx) => {
            if (!modelResult.success || !modelResult.urgency) {
              return (
                <Card key={idx} className="border-red-100 bg-red-50/50" data-testid={`card-error-${modelResult.model}`}>
                  <CardHeader>
                    <CardTitle className="text-lg">{modelResult.model}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Could not reach this model
                  </CardContent>
                </Card>
              );
            }

            const cardUrgencyInfo = URGENCY_DETAILS[modelResult.urgency as keyof typeof URGENCY_DETAILS] || URGENCY_DETAILS[4];
            
            return (
              <Card key={idx} className="shadow-sm h-full flex flex-col" data-testid={`card-model-${modelResult.model}`}>
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">{modelResult.model}</CardTitle>
                    <Badge variant="outline" className={`font-medium ${cardUrgencyInfo.badgeClass}`}>
                      {modelResult.urgency_label || `Tier ${modelResult.urgency}`}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex-grow space-y-4">
                  <p className="text-sm text-foreground leading-relaxed">{modelResult.summary}</p>
                  
                  {modelResult.considerations && modelResult.considerations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ask your doctor about:</p>
                      <ul className="text-sm space-y-1.5">
                        {modelResult.considerations.map((item, i) => (
                          <li key={i} className="flex gap-2 items-start text-foreground/80">
                            <span className="text-primary mt-1 shrink-0">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Consensus Panel */}
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-1">
                {result.agreement_level === 'full' && <div className="w-4 h-4 rounded-full bg-green-500 shadow-sm" />}
                {result.agreement_level === 'partial' && <div className="w-4 h-4 rounded-full bg-orange-400 shadow-sm" />}
                {result.agreement_level === 'none' && <div className="w-4 h-4 rounded-full bg-red-500 shadow-sm" />}
              </div>
              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground">
                  {result.agreement_level === 'full' && "All models agree on urgency level — this consensus increases confidence in the assessment."}
                  {result.agreement_level === 'partial' && "Models differ by one tier on urgency. Out of caution, the higher urgency recommendation is shown."}
                  {result.agreement_level === 'none' && "Models disagree significantly on urgency level. This uncertainty is itself a reason to consult a healthcare professional."}
                </p>

                {result.common_considerations && result.common_considerations.length > 0 && (
                  <div className="space-y-2 bg-white p-4 rounded-xl border border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Common observations</p>
                    <ul className="text-sm space-y-1.5">
                      {result.common_considerations.map((item, i) => (
                        <li key={i} className="flex gap-2 items-start text-foreground/80">
                          <span className="text-primary mt-1 shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground italic border-t pt-4">
                  These are AI-generated observations, not diagnoses. Use this as a starting point for a conversation with a doctor.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Disclaimer */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t border-border z-10">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-3 text-xs text-muted-foreground text-center">
            <Info className="w-4 h-4 shrink-0" />
            <p>
              These assessments are generated by AI and are not medical diagnoses. Always consult a licensed healthcare professional. This tool does not prescribe, diagnose, or provide medical treatment of any kind.
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  if (!hasAcceptedDisclaimer) {
    return renderDisclaimer();
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background p-4 md:p-8 pt-12 md:pt-16">
      <AnimatePresence mode="wait">
        {triageMutation.isPending ? (
          <div key="analyzing">{renderAnalyzing()}</div>
        ) : result ? (
          <div key="results">{renderResults()}</div>
        ) : (
          <div key="input">{renderInput()}</div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={TriageApp} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
