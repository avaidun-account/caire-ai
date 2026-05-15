import React, { useState, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRunTriage } from "@workspace/api-client-react";
import type { TriageResult } from "@workspace/api-zod";
import type { ModelResult } from "@workspace/api-zod";
import { X, FileText, AlertCircle } from "lucide-react";

const queryClient = new QueryClient();

const URGENCY = {
  1: { bg: "#FCEBEB", text: "#501313", num: "#A32D2D", label: "Seek emergency care now", sub: "Call 911 or go to the ER immediately.", pillBg: "#FCEBEB", pillText: "#791F1F", short: "Seek ER care" },
  2: { bg: "#FAEEDA", text: "#412402", num: "#854F0B", label: "See a doctor within 24 hours", sub: "Contact your doctor or urgent care today.", pillBg: "#FAEEDA", pillText: "#633806", short: "See doctor soon" },
  3: { bg: "#EAF3DE", text: "#173404", num: "#3B6D11", label: "Monitor at home", sub: "Schedule an appointment if symptoms persist or worsen.", pillBg: "#EAF3DE", pillText: "#27500A", short: "Monitor at home" },
  4: { bg: "#E6F1FB", text: "#042C53", num: "#185FA5", label: "Low concern — monitor", sub: "Rest and monitor. Seek care if anything changes.", pillBg: "#E6F1FB", pillText: "#0C447C", short: "Low concern" },
} as const;

function getEscalationTriggers(validResults: ModelResult[]): string {
  const urgencies = validResults.map((r: ModelResult) => r.urgency as number).filter(Boolean);
  const urgencyLevel = urgencies.length > 0 ? Math.min(...urgencies) : 4;
  if (urgencyLevel === 1) return "Go to the ER immediately — do not wait.";
  const allText = validResults.flatMap((r: ModelResult) => r.considerations || []).join(" ").toLowerCase();
  if (allText.includes("er") || allText.includes("emergency") || allText.includes("911")) {
    return "Any rapid worsening — go to the ER immediately if that occurs.";
  }
  return "Any significant worsening, new symptoms, or gut feeling something is wrong — seek care sooner.";
}

type UploadedFile = {
  name: string;
  mimeType: string;
  content: string;
  preview?: string;
};

function TriageApp() {
  const [hasAccepted, setHasAccepted] = useState<boolean>(() =>
    localStorage.getItem("caire-accepted") === "true"
  );
  const [symptoms, setSymptoms] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [result, setResult] = useState<TriageResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const triageMutation = useRunTriage();

  const handleAccept = () => {
    localStorage.setItem("caire-accepted", "true");
    setHasAccepted(true);
  };

  const handleReset = () => {
    setSymptoms("");
    setFiles([]);
    setResult(null);
    triageMutation.reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    if (files.length + selected.length > 4) { alert("Maximum 4 files."); return; }
    selected.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        setFiles(prev => [...prev, {
          name: file.name,
          mimeType: file.type,
          content: base64,
          preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (i: number) => {
    setFiles(prev => {
      const next = [...prev];
      if (next[i].preview) URL.revokeObjectURL(next[i].preview!);
      next.splice(i, 1);
      return next;
    });
  };

  const handleAnalyze = () => {
    if (!symptoms.trim()) return;
    triageMutation.mutate(
      {
        data: {
          symptoms,
          files: files.length > 0 ? files.map(f => ({ name: f.name, mimeType: f.mimeType, content: f.content })) : undefined,
        },
      },
      {
        onSuccess: (data) => {
          setResult(data as unknown as TriageResult);
          setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        },
      }
    );
  };

  const printReport = () => {
    if (!result) return;
    const urg = URGENCY[result.consensus_urgency as keyof typeof URGENCY] || URGENCY[4];
    const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const modelSections = result.results.map((r: ModelResult) => {
      if (!r.success) return `<div class="mc"><strong>${r.model}</strong>Could not reach this model.</div>`;
      return `<div class="mc"><strong>${r.model}</strong>${r.summary || ""}<br/><em>${(r.considerations || []).join("; ")}</em></div>`;
    }).join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Caire AI — Assessment Report</title>
    <style>body{font-family:Georgia,serif;max-width:680px;margin:40px auto;padding:0 24px;color:#1a1a1a;}
    .hd{border-bottom:2px solid #1a1a1a;padding-bottom:16px;margin-bottom:24px;}
    .hd h1{font-size:22px;margin:0 0 4px;}.hd p{font-size:13px;color:#666;margin:0;}
    .ub{border:1.5px solid #1a1a1a;border-radius:4px;padding:14px 18px;margin-bottom:24px;}
    .ub h2{font-size:17px;margin:0 0 4px;}.ub p{font-size:13px;margin:0;color:#444;}
    .st{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#888;margin:24px 0 10px;}
    .sb{background:#f5f5f5;border-radius:4px;padding:12px 16px;font-size:14px;line-height:1.6;}
    .mg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;}
    .mc{border:1px solid #ddd;border-radius:4px;padding:12px;font-size:12px;line-height:1.5;}
    .mc strong{display:block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#888;margin-bottom:6px;}
    .ds{margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#888;line-height:1.6;}
    @media print{button{display:none}}</style></head><body>
    <div class="hd"><h1>Caire AI — Assessment Report</h1><p>Generated ${date} · For reference only — not a medical diagnosis</p></div>
    <div class="st">Symptoms described</div><div class="sb">${symptoms}</div>
    <div class="st">Urgency assessment</div><div class="ub"><h2>${urg.label}</h2><p>${urg.sub}</p></div>
    <div class="st">What each AI assessed</div><div class="mg">${modelSections}</div>
    <div class="ds">This report was generated by Caire AI and contains AI-generated observations only. It is not a medical diagnosis, does not constitute medical advice, and must not be used as a substitute for professional medical evaluation. Always consult a licensed healthcare professional. In an emergency, call 911.</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  const nav = (
    <nav className="caire-nav">
      <div className="caire-wordmark">Caire <span>AI</span></div>
      <div className="caire-nav-tag">Reference only</div>
    </nav>
  );

  if (!hasAccepted) {
    return (
      <div style={{ minHeight: "100vh", background: "#F7F5F0" }}>
        {nav}
        <div className="caire-gate">
          <div className="caire-gate-inner">
            <div className="caire-eyebrow">Before you begin</div>
            <h1 className="caire-gate-title">
              A reference point,<br /><em>not</em> a diagnosis.
            </h1>
            <p className="caire-gate-body">
              Caire uses three AI models to help you decide whether a health situation needs urgent attention — not to replace your doctor.
            </p>
            <ul className="caire-gate-list">
              <li>AI-generated reference information only</li>
              <li>No medications or treatments are recommended</li>
              <li>Always consult a licensed healthcare professional</li>
              <li>For emergencies, call 911 immediately</li>
            </ul>
            <button className="caire-btn-dark" onClick={handleAccept} data-testid="button-accept-disclaimer">
              I understand — continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  const validResults = result
    ? result.results.filter((r: ModelResult) => r.success && r.urgency)
    : [];

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0", paddingBottom: "4rem" }}>
      {nav}

      {/* Input */}
      <div className="caire-section">
        <div className="caire-field-label">Describe what's happening</div>
        <textarea
          className="caire-textarea"
          placeholder="e.g. My 7-year-old has had a fever of 103°F for 2 days, sore throat, and won't eat. No rash. No known sick contacts."
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          disabled={triageMutation.isPending}
          data-testid="input-symptoms"
        />

        {files.length > 0 && (
          <div className="caire-files-grid">
            {files.map((f, i) => (
              <div key={i} className="caire-file-thumb">
                {f.preview
                  ? <img src={f.preview} alt={f.name} />
                  : <div className="caire-file-icon"><FileText size={16} /></div>}
                {!f.preview && <span>{f.name}</span>}
                <button onClick={() => removeFile(i)} type="button" disabled={triageMutation.isPending}>
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {files.length < 4 && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*,application/pdf"
              multiple
              onChange={handleFileUpload}
              disabled={triageMutation.isPending}
            />
            <div
              className="caire-upload"
              onClick={() => !triageMutation.isPending && fileInputRef.current?.click()}
            >
              <div className="caire-upload-icon">↑</div>
              <p>Add photos or documents<br />Rash photos, lab results, prescription documents</p>
            </div>
          </>
        )}
      </div>

      <div className="caire-section" style={{ paddingTop: "1rem" }}>
        {triageMutation.isPending ? (
          <div className="caire-loading">Consulting 3 AI models simultaneously…</div>
        ) : (
          <button
            className="caire-analyze-btn"
            onClick={handleAnalyze}
            disabled={!symptoms.trim()}
            data-testid="button-analyze"
          >
            Assess with 3 AI models
          </button>
        )}
        {triageMutation.isError && (
          <div className="caire-error">
            <AlertCircle size={14} />
            There was an error connecting to the AI models. Please try again.
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div ref={resultsRef}>
          <div className="caire-divider" />

          {/* Urgency */}
          <div className="caire-urgency-wrap">
            <div className="caire-field-label">Urgency assessment</div>
            {(() => {
              const urg = URGENCY[result.consensus_urgency as keyof typeof URGENCY] || URGENCY[4];
              return (
                <div className="caire-urgency" style={{ background: urg.bg, color: urg.text }}>
                  <div className="caire-urg-num" style={{ color: urg.num }}>
                    {result.consensus_urgency}
                  </div>
                  <div>
                    <div className="caire-urg-title">{urg.label}</div>
                    <div className="caire-urg-sub">{urg.sub}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Consensus */}
          {validResults.length >= 2 && (() => {
            const urgencies = validResults.map((r: ModelResult) => r.urgency as number);
            const allAgree = urgencies.every((u: number) => u === urgencies[0]);
            const maxDiff = urgencies.length > 1 ? Math.max(...urgencies) - Math.min(...urgencies) : 0;
            const allConsiderations = validResults.flatMap((r: ModelResult) => r.considerations || []);

            const countMap: Record<string, { text: string; count: number }> = {};
            allConsiderations.forEach((c: string) => {
              const key = c.toLowerCase().slice(0, 40);
              if (!countMap[key]) countMap[key] = { text: c, count: 0 };
              countMap[key].count++;
            });
            const shared = Object.values(countMap).filter(v => v.count >= 2).map(v => v.text).slice(0, 3);
            const uniquePoints = validResults
              .map((r: ModelResult) => ({
                model: r.model,
                unique: (r.considerations || []).filter((p: string) => countMap[p.toLowerCase().slice(0, 40)]?.count === 1),
              }))
              .filter((m: { model: string; unique: string[] }) => m.unique.length > 0);

            let dotClass: string;
            let alignHtml: string;
            if (allAgree) {
              dotClass = "caire-dot-g";
              const firstUrg = URGENCY[validResults[0]?.urgency as keyof typeof URGENCY] || URGENCY[4];
              alignHtml = `All ${validResults.length} models agree on urgency: <strong>${firstUrg.label}.</strong> This consistency increases confidence in the assessment.`;
            } else if (maxDiff <= 1) {
              dotClass = "caire-dot-a";
              alignHtml = "Models differ by one urgency tier. The most cautious recommendation is shown above. When in doubt, treat as the higher urgency.";
            } else {
              dotClass = "caire-dot-r";
              alignHtml = "Models disagree significantly on urgency. This level of uncertainty is itself a reason to consult a healthcare professional promptly.";
            }

            return (
              <div className="caire-consensus-wrap">
                <div className="caire-field-label">Consensus summary</div>
                <div className="caire-consensus">
                  <div className="caire-c-header">Where the models align and differ</div>

                  <div className="caire-c-block">
                    <div className="caire-c-block-title">Where models align</div>
                    <div className="caire-c-row">
                      <div className={`caire-dot ${dotClass}`} />
                      <div dangerouslySetInnerHTML={{ __html: alignHtml }} />
                    </div>
                    {shared.length > 0 && (
                      <div className="caire-c-row">
                        <div className="caire-dot caire-dot-g" />
                        <div>All models flagged: {shared.join(" · ")}</div>
                      </div>
                    )}
                  </div>

                  {uniquePoints.length > 0 && (
                    <div className="caire-c-block">
                      <div className="caire-c-block-title">Key differences</div>
                      {uniquePoints.map((m: { model: string; unique: string[] }, i: number) => (
                        <div key={i} className="caire-c-row">
                          <div className="caire-dot caire-dot-a" />
                          <div><strong>{m.model} only flagged:</strong> {m.unique.join("; ")}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="caire-c-block">
                    <div className="caire-c-block-title">Actionable insights for caregivers</div>
                    <div className="caire-c-row">
                      <div className="caire-dot caire-dot-g" />
                      <div><strong>Watch for immediately:</strong> {getEscalationTriggers(validResults)}</div>
                    </div>
                    <div className="caire-c-row">
                      <div className="caire-dot caire-dot-g" />
                      <div>
                        <strong>When you see the doctor, mention:</strong>{" "}
                        {shared.slice(0, 2).join("; ") || "the timeline, severity, and any changes in symptoms"}
                      </div>
                    </div>
                    <div className="caire-c-row">
                      <div className="caire-dot caire-dot-a" />
                      <div>These are AI-generated observations, not diagnoses. Use this as a starting point for a conversation with a doctor.</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Model Cards */}
          <div className="caire-cards-wrap">
            <div className="caire-field-label">What each model assessed</div>
            <div className="caire-cards">
              {result.results.map((r: ModelResult, i: number) => {
                if (!r.success || !r.urgency) {
                  return (
                    <div key={i} className="caire-card" data-testid={`card-error-${r.model}`}>
                      <div className="caire-card-model">{r.model}</div>
                      <div className="caire-card-error">
                        <AlertCircle size={12} /> Could not reach this model
                      </div>
                    </div>
                  );
                }
                const urg = URGENCY[r.urgency as keyof typeof URGENCY] || URGENCY[4];
                return (
                  <div key={i} className="caire-card" data-testid={`card-model-${r.model}`}>
                    <div className="caire-card-model">{r.model}</div>
                    <div className="caire-pill" style={{ background: urg.pillBg, color: urg.pillText }}>
                      {r.urgency_label || urg.short}
                    </div>
                    <div className="caire-card-summary">{r.summary}</div>
                    {r.considerations && r.considerations.length > 0 && (
                      <div className="caire-card-asks">
                        <strong>Ask your doctor about</strong>
                        {r.considerations.join(" · ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="caire-disclaimer">
            <div className="caire-disclaimer-inner">
              <span style={{ flexShrink: 0, marginTop: "1px" }}>!</span>
              <span>These assessments are generated by AI and are not medical diagnoses. Always consult a licensed healthcare professional. This tool does not prescribe, diagnose, or provide medical treatment of any kind.</span>
            </div>
          </div>

          {/* Actions */}
          <div className="caire-actions">
            <button className="caire-btn-print" onClick={printReport} data-testid="button-print">
              ↓ Save or print this report
              <span style={{ fontSize: "11px", color: "#C8C4BC", marginLeft: "4px" }}>— bring to your appointment</span>
            </button>
            <button className="caire-btn-reset" onClick={handleReset} data-testid="button-reset">
              Start a new assessment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={TriageApp} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
