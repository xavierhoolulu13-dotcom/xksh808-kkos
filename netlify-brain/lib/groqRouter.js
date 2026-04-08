// ============================================================
// LLM ROUTER — Groq Backend
// ============================================================
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = {
  primary: "llama3-70b-versatile",
  fallback1: "mixtral-8x7b-32768",
  fallback2: "llama3-8b-8192",
};

async function callLLM(messages, { model, temperature = 0.3, maxTokens = 1024 } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const modelsToTry = [model || MODELS.primary, MODELS.fallback1, MODELS.fallback2];

  for (const m of modelsToTry) {
    try {
      const res = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: m,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`[GROQ] Model ${m} failed: ${err}`);
        continue;
      }

      const data = await res.json();
      return {
        content: data.choices[0].message.content,
        model: m,
        usage: data.usage,
      };
    } catch (e) {
      console.error(`[GROQ] Exception on model ${m}:`, e.message);
    }
  }

  throw new Error("[GROQ] All models failed. Check API key and quota.");
}

module.exports = { callLLM, MODELS };
