# Caire AI

> A reference point, not a diagnosis.

Caire AI is a home health triage tool that helps everyday people decide whether a health situation needs urgent attention. It sends your symptom description and uploaded photos or documents to three leading AI models simultaneously — Claude, GPT-4o, and Gemini — then compares their responses and surfaces where they agree, where they differ, and what that means for you.

Built for the moments between "I don't know if this is serious" and "I'm at the doctor's office."

---

## What It Does

Most symptom checkers give you one answer from one black-box AI with no way to know how confident it actually is. Caire runs three frontier models in parallel and shows you the seams — so you can make a more informed decision about your next step.

**Input**
- Describe your symptoms in plain text
- Optionally upload photos (rash, injury) or documents (lab results, prescriptions)

**Output**
- Urgency tier from the most conservative model result
- Individual assessment from each model — framed as questions to bring to a doctor
- Consensus summary showing where models agree and where they diverge
- Actionable insights: what to watch for, what to mention at your appointment
- Printable report to bring to your doctor

**Urgency Tiers**
| Level | Meaning |
|---|---|
| 🔴 1 | Seek emergency care now |
| 🟠 2 | See a doctor within 24 hours |
| 🟢 3 | Monitor at home, see doctor if worsens |
| 🔵 4 | Low concern, monitor |

---

## What Caire Is Not

Caire is not a diagnostic tool. It does not prescribe medications, recommend treatments, or replace a licensed healthcare professional. Every assessment is preceded by a mandatory disclaimer the user must explicitly accept. Every result screen carries a persistent disclaimer. All model outputs are framed as considerations to discuss with a doctor — never as definitive findings.

**In an emergency, call 911. Do not wait for an assessment.**

---

## How It Works

```
User Input (symptoms + optional images/PDFs)
        ↓
  ┌─────────────────────────────────┐
  │     Parallel API Calls          │
  │  Claude  │  GPT-4o  │  Gemini  │
  └─────────────────────────────────┘
        ↓
  Urgency Escalation Rule
  (always show highest urgency — never average down)
        ↓
  Consensus Analysis
  (agreement, divergence, actionable insights)
        ↓
  Structured Output + Printable Report
```

Each model receives an identical structured system prompt that explicitly prohibits medication recommendations and definitive diagnoses at the prompt level — not just in the UI. The urgency escalation rule is enforced in code: if any single model returns urgency level 1 (emergency), the entire interface shows level 1 regardless of what the other models return.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React / HTML + CSS + JS |
| Backend | Node.js + Express |
| AI Models | Anthropic Claude, OpenAI GPT-4o, Google Gemini 1.5 Pro |
| File Handling | Base64 encoding for images, server-side PDF text extraction |
| API Calls | Parallel via Promise.all — never sequential |
| Deployment | Replit |

---

## Getting Started

### Prerequisites

- Node.js 18+
- API keys for Anthropic, OpenAI, and Google

### Installation

```bash
git clone https://github.com/avaidun-account/caire-ai
cd caire-ai
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key
```

**Never expose API keys in client-side code.** All three AI API calls are made server-side only.

### Run Locally

```bash
npm start
```

Open `http://localhost:3000` in your browser.

---

## Project Structure

```
caire-ai/
├── server.js          # Express backend, API routes, LLM calls
├── public/
│   ├── index.html     # Main app UI
│   ├── style.css      # Styling
│   └── script.js      # Frontend logic, consensus engine
├── .env               # API keys (never commit this)
├── .gitignore
└── README.md
```

---

## Safety Architecture

Caire was designed with safety constraints at every layer:

**Prompt level** — All three models are instructed via system prompt to never prescribe medications, never diagnose definitively, always frame findings as considerations for a doctor, and always escalate when uncertain.

**Logic level** — The urgency escalation rule is enforced in the comparison function. The lowest urgency number (highest urgency) always wins. No averaging.

**UI level** — A mandatory disclaimer gate blocks all app functionality until the user explicitly acknowledges the tool's limitations. A persistent disclaimer appears on every results screen and cannot be dismissed.

**Data level** — No user health data is stored beyond the lifetime of a single request. No accounts, no history, no database of assessments.

---

## Research

Caire AI is the subject of an ongoing undergraduate research study at UC Riverside examining whether multi-LLM consensus triage tools improve lay user care-seeking decisions compared to single-model tools. The study uses a randomized vignette-based experimental design. Target publication: Journal of Medical Internet Research (JMIR).

The research question: *Does a multi-LLM consensus triage tool produce more appropriate care-seeking intentions in lay users than a single-LLM tool or no AI assistance?*

---

## Roadmap

**V1.0 — Current**
- [x] Three-model parallel assessment
- [x] Urgency escalation logic
- [x] Consensus and divergence panel
- [x] Image and document upload
- [x] Printable report
- [x] Mandatory disclaimer gate

**V1.1 — Planned**
- [ ] IRB-approved research study integration
- [ ] Mobile-responsive refinements
- [ ] PDF export for printed report
- [ ] Expanded file type support

**V2.0 — Future**
- [ ] Optional session history (with explicit user consent)
- [ ] Telehealth handoff integration
- [ ] API for third-party health platforms

---

## Legal

Caire AI is an informational reference tool. It is not a medical device, does not provide medical advice, and is not subject to FDA medical device classification based on its informational-only positioning. Users must explicitly accept terms of use before accessing any functionality.

This tool does not diagnose, prescribe, or recommend medical treatment of any kind. Always consult a licensed healthcare professional for any health concern.

---

## About

Built by [Arjun Vaidun](https://avaidun-account.github.io) — UC Riverside, Psychology, Class of 2028.

Motivated by two family members living with Parkinson's disease and a sibling who sustained multiple concussions — and by the gap between health uncertainty and accessible, honest guidance.

- **Portfolio:** avaidun-account.github.io
- **GitHub:** github.com/avaidun-account
- **Email:** a.vaidun@gmail.com

---

*Caire AI is in active development. If you are experiencing a medical emergency, call 911 immediately.*
