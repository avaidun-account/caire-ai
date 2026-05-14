import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ai } from "@workspace/integrations-gemini-ai";
import { RunTriageBody } from "@workspace/api-zod";
import { logger } from "../../lib/logger";

const router = Router();

const SYSTEM_PROMPT = `You are a medical triage assistant helping a consumer decide urgency level for a health concern.

CRITICAL RULES:
- NEVER prescribe medications, dosages, or specific treatments
- NEVER diagnose conditions definitively
- ALWAYS frame findings as "considerations to discuss with a doctor"
- When uncertain about urgency, escalate — never reassure falsely
- Output ONLY valid JSON, no markdown fences

Return this exact JSON structure:
{
  "urgency": <1-4 integer>,
  "urgency_label": "<one of: Seek emergency care now | See a doctor within 24 hours | Monitor at home, see doctor if worsens | Low concern, monitor>",
  "summary": "<2-3 sentence plain-language summary framed as questions or considerations to bring to a doctor>",
  "considerations": ["<up to 3 things to mention to a doctor or watch for>"],
  "reasoning": "<1 sentence explaining the urgency level>"
}

Urgency scale:
1 = ER now
2 = Doctor within 24 hours
3 = Monitor / schedule appointment
4 = Low concern`;

interface TriageFileInput {
  name: string;
  mimeType: string;
  content: string;
}

interface ModelResponse {
  urgency: number;
  urgency_label: string;
  summary: string;
  considerations: string[];
  reasoning: string;
}

function parseModelResponse(raw: string): ModelResponse {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as ModelResponse;
  if (
    typeof parsed.urgency !== "number" ||
    parsed.urgency < 1 ||
    parsed.urgency > 4
  ) {
    throw new Error("Invalid urgency value");
  }
  return parsed;
}

async function extractPdfText(base64Content: string): Promise<string> {
  try {
    const { default: pdfParse } = await import("pdf-parse");
    const buffer = Buffer.from(base64Content, "base64");
    const result = await pdfParse(buffer);
    return result.text.slice(0, 8000);
  } catch (err) {
    logger.warn({ err }, "PDF text extraction failed");
    return "[PDF document — text extraction unavailable]";
  }
}

function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

async function callClaude(
  symptoms: string,
  files: TriageFileInput[]
): Promise<ModelResponse> {
  const contentParts: Anthropic.MessageParam["content"] = [];

  let userText = `Patient symptoms: ${symptoms}`;

  for (const file of files) {
    if (isImageMimeType(file.mimeType)) {
      contentParts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.mimeType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: file.content,
        },
      });
    } else if (file.mimeType === "application/pdf") {
      const text = await extractPdfText(file.content);
      userText += `\n\nDocument (${file.name}):\n${text}`;
    }
  }

  contentParts.push({ type: "text", text: userText });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: contentParts }],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return parseModelResponse(block.text);
}

async function callGPT(
  symptoms: string,
  files: TriageFileInput[]
): Promise<ModelResponse> {
  const contentParts: OpenAI.Chat.ChatCompletionContentPart[] = [];

  let userText = `Patient symptoms: ${symptoms}`;

  for (const file of files) {
    if (isImageMimeType(file.mimeType)) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${file.mimeType};base64,${file.content}`,
        },
      });
    } else if (file.mimeType === "application/pdf") {
      const text = await extractPdfText(file.content);
      userText += `\n\nDocument (${file.name}):\n${text}`;
    }
  }

  contentParts.unshift({ type: "text", text: userText });

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: contentParts },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  return parseModelResponse(text);
}

async function callGemini(
  symptoms: string,
  files: TriageFileInput[]
): Promise<ModelResponse> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  let userText = `Patient symptoms: ${symptoms}`;

  for (const file of files) {
    if (isImageMimeType(file.mimeType)) {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.content,
        },
      });
    } else if (file.mimeType === "application/pdf") {
      const text = await extractPdfText(file.content);
      userText += `\n\nDocument (${file.name}):\n${text}`;
    }
  }

  parts.push({ text: userText });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  return parseModelResponse(text);
}

function findCommonConsiderations(results: ModelResponse[]): string[] {
  const allConsiderations = results.flatMap((r) =>
    r.considerations.map((c) => c.toLowerCase().trim())
  );
  const counts = new Map<string, number>();
  const originals = new Map<string, string>();

  for (let i = 0; i < results.length; i++) {
    for (const c of results[i].considerations) {
      const key = c.toLowerCase().trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!originals.has(key)) originals.set(key, c);
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([key]) => originals.get(key) ?? key);
}

router.post("/triage", async (req, res) => {
  const parsed = RunTriageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { symptoms, files = [] } = parsed.data;

  const triageFiles: TriageFileInput[] = (files ?? []).map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    content: f.content,
  }));

  const [claudeResult, gptResult, geminiResult] = await Promise.allSettled([
    callClaude(symptoms, triageFiles),
    callGPT(symptoms, triageFiles),
    callGemini(symptoms, triageFiles),
  ]);

  const modelNames = ["Claude", "GPT", "Gemini"];
  const settled = [claudeResult, gptResult, geminiResult];

  const results = settled.map((result, i) => {
    if (result.status === "fulfilled") {
      return {
        model: modelNames[i],
        success: true,
        urgency: result.value.urgency,
        urgency_label: result.value.urgency_label,
        summary: result.value.summary,
        considerations: result.value.considerations,
        reasoning: result.value.reasoning,
        error: null,
      };
    } else {
      logger.warn(
        { err: result.reason, model: modelNames[i] },
        "Model call failed"
      );
      return {
        model: modelNames[i],
        success: false,
        urgency: null,
        urgency_label: null,
        summary: null,
        considerations: null,
        reasoning: null,
        error: "Could not reach this model",
      };
    }
  });

  const successfulResults = results.filter(
    (r): r is typeof r & { success: true; urgency: number } =>
      r.success && r.urgency !== null
  );

  if (successfulResults.length === 0) {
    res.status(502).json({ error: "All AI models failed to respond" });
    return;
  }

  const consensusUrgency = Math.min(...successfulResults.map((r) => r.urgency));

  const urgencyValues = successfulResults.map((r) => r.urgency);
  const uniqueUrgencies = new Set(urgencyValues);
  let agreementLevel: "full" | "partial" | "none";
  if (uniqueUrgencies.size === 1) {
    agreementLevel = "full";
  } else if (successfulResults.length >= 2) {
    const maxCount = Math.max(
      ...Array.from(uniqueUrgencies).map(
        (u) => urgencyValues.filter((v) => v === u).length
      )
    );
    agreementLevel = maxCount >= 2 ? "partial" : "none";
  } else {
    agreementLevel = "full";
  }

  const successfulModelResponses = successfulResults.map((r) => ({
    urgency: r.urgency,
    urgency_label: r.urgency_label ?? "",
    summary: r.summary ?? "",
    considerations: r.considerations ?? [],
    reasoning: r.reasoning ?? "",
  }));

  const commonConsiderations = findCommonConsiderations(successfulModelResponses);

  res.json({
    results,
    consensus_urgency: consensusUrgency,
    agreement_level: agreementLevel,
    common_considerations: commonConsiderations,
  });
});

export default router;
