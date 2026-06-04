import type { AnalyzeApiResponse } from "@/lib/types/market";

export type NarratorSource = "template" | "llm";

export interface DeskNarratorResult {
  text: string;
  source: NarratorSource;
  locale: "th" | "en";
}

function formatTemplateNarrator(
  data: AnalyzeApiResponse,
  locale: "th" | "en",
): string {
  const desk = data.tradingDesk;
  const verdict = desk?.committee.finalVerdict ?? "WAIT";
  const veto = desk?.committee.riskVeto ?? false;
  const btc = data.step1_marketSnapshot.spotPrice;
  const ivHv = data.step1_marketSnapshot.ivHvRatio;

  if (locale === "th") {
    const head = veto
      ? "Risk Manager ใช้ veto — คณะกรรมการไม่สามารถอนุมัติ TRADE"
      : verdict === "TRADE"
        ? "คณะกรรมการเห็นชอบ TRADE (วิเคราะห์เท่านั้น ไม่ส่งออเดอร์จริง)"
        : verdict === "SKIP"
          ? "โต๊ะแนะนำ SKIP — ไม่เปิดความเสี่ยงใหม่"
          : "ยังไม่มีฉันทามติ TRADE — รอข้อมูลหรือสัญญาณชัดขึ้น";
    const market = `BTC ${btc > 0 ? btc.toLocaleString() : "n/a"} · IV/HV ${ivHv > 0 ? ivHv.toFixed(2) : "n/a"} · ${desk?.marketRegime ?? "—"}`;
    const reason = desk?.committee.topReasons[0] ?? desk?.committee.consensusSummary ?? "";
    return `${head}. ${market}. ${reason}`.slice(0, 500);
  }

  const head = veto
    ? "Risk veto active — committee cannot approve TRADE."
    : verdict === "TRADE"
      ? "Committee TRADE — analysis only, no live execution."
      : verdict === "SKIP"
        ? "Desk SKIP — stand aside."
        : "No TRADE consensus — wait for clearer tape.";
  const market = `BTC ${btc > 0 ? btc.toLocaleString() : "n/a"} · IV/HV ${ivHv > 0 ? ivHv.toFixed(2) : "n/a"}`;
  const reason = desk?.committee.topReasons[0] ?? "";
  return `${head} ${market}. ${reason}`.slice(0, 500);
}

export async function runDeskNarrator(
  data: AnalyzeApiResponse,
  options?: { locale?: "th" | "en" },
): Promise<DeskNarratorResult> {
  const locale = options?.locale ?? "th";
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return {
      text: formatTemplateNarrator(data, locale),
      source: "template",
      locale,
    };
  }

  const desk = data.tradingDesk;
  const structured = {
    verdict: desk?.committee.finalVerdict,
    riskVeto: desk?.committee.riskVeto,
    regime: desk?.marketRegime,
    topReasons: desk?.committee.topReasons,
    btc: data.step1_marketSnapshot.spotPrice,
    ivHv: data.step1_marketSnapshot.ivHvRatio,
    playbook: data.step5_verdict.recommendation,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        max_tokens: 180,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are a crypto options desk narrator. Use ONLY the JSON facts. 3-5 sentences. Never change verdict. Analysis only.",
          },
          {
            role: "user",
            content: `Locale: ${locale}. JSON:\n${JSON.stringify(structured)}`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty LLM response");

    return { text: text.slice(0, 600), source: "llm", locale };
  } catch {
    return {
      text: formatTemplateNarrator(data, locale),
      source: "template",
      locale,
    };
  }
}
