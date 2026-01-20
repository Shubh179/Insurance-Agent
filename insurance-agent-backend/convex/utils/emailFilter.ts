interface EmailInput {
  sender?: string;
  subject?: string;
  snippet?: string;
  body?: string;
  attachments?: string[];
}

interface ClassificationResult {
  is_spam: boolean;
  is_insurance_related: boolean;
  category: string;
  confidence: number;
  classified_by: "deterministic" | "gemini_fallback";
  deterministic_score?: number; // For logging/debugging
}

interface DeterministicResult {
  score: number;
  isBorderline: boolean; // true if score 3-5
  category: "renewal" | "claim" | "payment" | "new_policy" | "general";
  reason: string;
  hasStrongSignal?: boolean;
}

const SPAM_SENDER_TOKENS = ["noreply", "no-reply", "promo", "marketing"];
const SPAM_SUBJECT_KEYWORDS = [
  "free",
  "win",
  "offer",
  "limited time",
  "discount",
  "sale",
  "cashback",
];

// Deterministic classification scoring rules
const POLICY_NUMBER_REGEX = /\b[A-Z]{2,}\d{6,}\b/; // Policy number format
const CLAIM_LIFECYCLE_TERMS = [
  "claim",
  "settlement",
  "approval",
  "denied",
  "approved",
  "processing",
  "status",
];
const INSURANCE_KEYWORDS = [
  "policy",
  "premium",
  "renewal",
  "claim",
  "coverage",
  "sum assured",
  "endorsement",
  "policy number",
  "insured",
  "beneficiary",
];
const REGULATORY_PHRASES = [
  "irda",
  "irdai",
  "terms and conditions",
  "policy document",
  "statutory",
  "compliance",
  "regulation",
];

const INSURANCE_PROVIDERS = [
  "lic",
  "hdfc life",
  "icici lombard",
  "bajaj allianz",
  "tata aig",
  "max life",
];

const CATEGORY_RULES: Record<string, string[]> = {
  renewal: ["renew", "expiry", "due", "reminder", "upcoming"],
  claim: ["claim", "settlement", "approval", "denied", "processing"],
  new_policy: ["issued", "welcome", "policy document", "congratulations"],
  payment: ["premium received", "receipt", "payment confirmed", "transaction"],
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function normalize(text?: string): string {
  return (text || "").toLowerCase();
}

function containsKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

/**
 * Rule-based spam detection (deterministic, no AI)
 */
export function isSpamEmail(email: EmailInput): boolean {
  const sender = normalize(email.sender);
  const subject = normalize(email.subject);
  const snippet = normalize(email.snippet);

  if (SPAM_SENDER_TOKENS.some((token) => sender.includes(token))) return true;
  if (SPAM_SUBJECT_KEYWORDS.some((kw) => subject.includes(kw))) return true;

  // Promotional language heuristic: many exclamation marks or all caps words
  const promoScore = [subject, snippet].filter(Boolean).join(" ");
  const exclamations = (promoScore.match(/!/g) || []).length;
  if (exclamations >= 3) return true;

  const uppercaseWords = promoScore.split(/\s+/).filter((w) => w.length > 4 && w === w.toUpperCase());
  if (uppercaseWords.length >= 3) return true;

  return false;
}

/**
 * STAGE 1: Deterministic Insurance Classification
 * 
 * Scores based on Subject, Snippet AND Body.
 */
function deterministicInsuranceCheck(email: EmailInput): DeterministicResult {
  const sender = normalize(email.sender);
  const subject = normalize(email.subject);
  const snippet = normalize(email.snippet);
  const body = normalize(email.body);
  const combined = `${subject} ${snippet} ${body}`; // Search in body too!

  let score = 0;
  let reasons: string[] = [];

  // ...
  const STRONG_SIGNAL_PHRASES = [
    "premium receipt",
    "renewal notice",
    "policy schedule",
    "policy document",
    "welcome letter",
    "insurance advice",
    "claim approval",
    "claim settlement",
  ];

  let hasStrongSignal = false;

  // Policy number regex match → +5
  // This is a STRONG SIGNAL
  if (POLICY_NUMBER_REGEX.test(combined)) {
    score += 5;
    reasons.push("policy_number_detected");
    hasStrongSignal = true;
  }

  // Check for other strong signal phrases
  if (containsKeyword(subject, STRONG_SIGNAL_PHRASES) || containsKeyword(snippet, STRONG_SIGNAL_PHRASES)) {
    hasStrongSignal = true;
    reasons.push("strong_signal_phrase_found");
  }

  // Insurance keywords in subject → +2
  if (containsKeyword(subject, INSURANCE_KEYWORDS)) {
    score += 2;
    reasons.push("insurance_keywords_in_subject");
  }



  // Claim lifecycle terms → +3
  if (containsKeyword(combined, CLAIM_LIFECYCLE_TERMS)) {
    score += 3;
    reasons.push("claim_lifecycle_terms");
  }

  // Currency + duration coupling (e.g., "$500/year") → +2
  if (/\$\d+\/\w+|₹\d+\/\w+|currency\s*\d+\s*\w+/i.test(combined)) {
    score += 2;
    reasons.push("currency_duration_coupling");
  }

  // Regulatory/legal phrases → +1
  if (containsKeyword(combined, REGULATORY_PHRASES)) {
    score += 1;
    reasons.push("regulatory_phrases");
  }

  const NEGATIVE_FINANCE_TERMS = [
    "mutual fund",
    "systematic investment plan",
    "sip",
    "portfolio",
    "demat",
    "sharekhan",
    "zerodha",
    "groww",
    "nse",
    "bse",
    "securities",
    "stock broker",
    "trading member",
    "depository",
    "cibil",
    "credit score",
    "experian",
    "crc",
    "personal loan",
    "home loan",
    "credit card statement",
    "bank statement",
  ];



  // NEGATIVE FILTER: Exclude general finance/investments
  const hasNegative = containsKeyword(combined, NEGATIVE_FINANCE_TERMS);
  if (hasNegative) {
    console.log(`[EmailFilter] ⛔ NEGATIVE TERM DETECTED in: "${subject}"`);
    console.log(`[EmailFilter] Term found! Score -> 0. Reason: negative_finance_term_detected`);
    return {
      score: 0,
      isBorderline: false,
      category: "general",
      reason: "negative_finance_term_detected",
    };
  } else {
    // Debug log to see why it passed
    if (subject.includes("nse") || subject.includes("securities")) {
      console.log(`[EmailFilter] ⚠️ WARNING: NSE/Securities in subject but NOT caught by negative list?!`);
      console.log(`[EmailFilter] Combined Text Dump (First 100): ${combined.substring(0, 100)}`);
      console.log(`[EmailFilter] Checking against terms: ${JSON.stringify(NEGATIVE_FINANCE_TERMS)}`);
    }
  }

  // Insurance provider names → +2 (additional signal)
  if (INSURANCE_PROVIDERS.some((p) => sender.includes(p) || combined.includes(p))) {
    score += 2;
    reasons.push("insurance_provider_match");
  }

  // Determine category based on keywords
  let category: "renewal" | "claim" | "payment" | "new_policy" | "general" = "general";
  for (const [cat, keywords] of Object.entries(CATEGORY_RULES)) {
    if (containsKeyword(combined, keywords)) {
      category = cat as "renewal" | "claim" | "payment" | "new_policy" | "general";
      break;
    }
  }

  const isBorderline = score >= 3 && score <= 5;

  return {
    score,
    isBorderline,
    category,
    reason: reasons.join(",") || "no_insurance_signals",
  };
}

/**
 * STAGE 2: Gemini Fallback Validation
 * Included Body in the prompt for deeper analysis.
 */
async function geminiInsuranceFallback(email: EmailInput): Promise<{ isInsurance: boolean; confidence: number }> {
  if (!GEMINI_API_KEY) {
    console.log(`[EmailFilter] Gemini API key not set, defaulting to deterministic only`);
    return { isInsurance: false, confidence: 0 };
  }

  // Strict validation prompt - Gemini validates, doesn't classify
  // Strict validation prompt - Gemini validates, doesn't classify
  const prompt = `You are an expert Insurance Email Analyzer.
Your goal is to determine if this email is a VALID, TRANSACTIONAL Insurance communication (e.g., Policy Issued, Premium Due, Claim Status, Renewal Notice).

STRICTLY EXCLUDE (Return false):
- Mutual Fund / Investment / Stock Market emails (SIP, NFO, Portfolio, Demat)
- Credit Score reports (CIBIL, Experian, Highmark)
- Loan offers or General Bank Statements (unless specifically for an Insurance Premium)
- Marketing/spam/promotional emails ("Buy now", "Limited offer", "Get insurance")
- General "Newsletters" or "Articles" about insurance

Signals to look for (Positive):
- Policy Numbers (e.g., "Policy No:", "Pol No:")
- Premium Amounts / Due Dates
- Specific Insurance Types: Life, Health, Motor, Term, Travel
- Terms: "Sum Assured", "Coverage", "Claim ID", "Premium Receipt", "Renewal Notice"

Given Email:
Subject: ${email.subject || ""}
Sender: ${email.sender || ""}
Snippet: ${email.snippet || ""}
Body: ${email.body ? email.body.substring(0, 5000) : "(no body)"}

Respond ONLY with valid JSON:
{
  "is_insurance": boolean, // true ONLY if it matches the Positive signals and is NOT in Exclude list
  "confidence": number, // 0.0 to 1.0 (0.9+ for clear policy docs, 0.1 for mutual funds)
  "reason": string // Short explanation (e.g., "Related to Mutual Funds", "Valid Life Insurance Renewal")
}`;

  console.log(`[EmailFilter] 📤 Sending to Gemini (Length: ${(email.body || "").length} chars):`);
  console.log(`[EmailFilter] PROMPT PREVIEW:\n${prompt.substring(0, 500)}...\n[...truncated...]`);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          safetySettings: [
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[EmailFilter] Gemini validation call failed: ${errText}`);
      return { isInsurance: false, confidence: 0 };
    }

    const data = (await res.json()) as any;
    const combinedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log(`[EmailFilter] 📥 Gemini Response:\n${combinedText.substring(0, 500)}...`);
    const parsed = JSON.parse(combinedText.replace(/```json|```/g, "").trim()) as {
      is_insurance?: boolean;
      confidence?: number;
    };

    const isInsurance = Boolean(parsed.is_insurance);
    const confidence = Math.min(Math.max(parsed.confidence || 0, 0), 1);

    return { isInsurance, confidence };
  } catch (err) {
    console.warn(`[EmailFilter] Gemini fallback error: ${String(err)}, treating as non-insurance`);
    return { isInsurance: false, confidence: 0 };
  }
}

function categorizeDeterministic(email: EmailInput): "insurance" | "spam" | "other" {
  const combined = `${normalize(email.subject)} ${normalize(email.snippet)}`;

  for (const keywords of Object.values(CATEGORY_RULES)) {
    if (containsKeyword(combined, keywords)) {
      return "insurance";
    }
  }

  return "insurance";
}

export async function classifyEmail(email: EmailInput): Promise<ClassificationResult> {
  // Stage 1: Spam check
  if (isSpamEmail(email)) {
    return {
      is_spam: true,
      is_insurance_related: false,
      category: "spam",
      confidence: 0.95,
      classified_by: "deterministic",
      deterministic_score: -1,
    };
  }

  // Stage 1: Deterministic insurance classification
  const deterministicResult = deterministicInsuranceCheck(email);
  const { score, isBorderline, category, hasStrongSignal } = deterministicResult;

  console.log(
    `[EmailFilter] Deterministic score: ${score}, StrongSignal: ${hasStrongSignal}, reason: ${deterministicResult.reason}`
  );

  // STRICTER RULE: To auto-accept (skip Gemini), must have score >= 6 AND a Strong Signal.
  // NSE/Finance emails often get score 6 just from footer keywords ("Policy", "Claims"), but lack Strong Signals.
  if (score >= 6 && hasStrongSignal) {
    console.log(`[EmailFilter] Skipping Gemini: High score (${score}) + Strong Signal. (Accepted).`);
    return {
      is_spam: false,
      is_insurance_related: true,
      category: categorizeDeterministic(email),
      confidence: Math.min(0.8 + (score - 6) * 0.05, 0.95),
      classified_by: "deterministic",
      deterministic_score: score,
    };
  } else if (score >= 6 && !hasStrongSignal) {
    console.log(`[EmailFilter] Score is High (${score}) but NO Strong Signal. Demoting to Gemini check.`);
  }

  if (score <= 2) {
    console.log(`[EmailFilter] Skipping Gemini: Deterministic score ${score} is too low (Rejected).`);
    return {
      is_spam: false,
      is_insurance_related: false,
      category: "other",
      confidence: Math.max(0.2 - score * 0.05, 0),
      classified_by: "deterministic",
      deterministic_score: score,
    };
  }

  // Borderline: Call Gemini with FULL BODY if available
  console.log(`[EmailFilter] Borderline score (${score}), calling Gemini validator...`);
  const geminiResult = await geminiInsuranceFallback(email);

  if (geminiResult.isInsurance && geminiResult.confidence >= 0.7) {
    console.log(
      `[EmailFilter] Gemini accepted (is_insurance=true, confidence=${geminiResult.confidence})`
    );
    return {
      is_spam: false,
      is_insurance_related: true,
      category: categorizeDeterministic(email),
      confidence: geminiResult.confidence,
      classified_by: "gemini_fallback",
      deterministic_score: score,
    };
  }

  console.log(
    `[EmailFilter] Gemini rejected or low confidence (is_insurance=${geminiResult.isInsurance}, confidence=${geminiResult.confidence})`
  );
  return {
    is_spam: false,
    is_insurance_related: false,
    category: "other",
    confidence: Math.min(score * 0.1, 0.3),
    classified_by: "deterministic",
    deterministic_score: score,
  };
}
