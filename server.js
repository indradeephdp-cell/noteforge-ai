require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const fetch   = require("node-fetch");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname)));

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.post("/api/generate", async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY not set on server." });

  const { prompt, pdfBase64, pageFrom, pageTo } = req.body;
  const parts = [];

  if (pdfBase64) {
    parts.push({ inline_data: { mime_type: "application/pdf", data: pdfBase64 } });
    parts.push({ text: `Create comprehensive exam-ready notes from this PDF. Pages ${pageFrom || 1} to ${pageTo || 999}.\n\n${getSystemPrompt()}` });
  } else {
    parts.push({ text: `Create comprehensive exam-ready notes from this content.\n\n${getSystemPrompt()}\n\nCONTENT:\n${prompt}` });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192, topP: 0.95 }
      })
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: "Gemini API call failed: " + e.message });
  }
});

function getSystemPrompt() {
  return `You are a world-class academic note synthesizer.

BEGIN your output with this exact line (nothing before it):
📐 Note Style: [Name] — [one-sentence reason]

Choose from: Hierarchical Outline / Cornell Method / Thematic Clustering / Data-Centric Analytics / Comparative Framework / Timeline + Analysis

NOTES RULES:
- Use # ## ### #### heading hierarchy
- **Bold** all key terms, names, dates, figures
- > Blockquote for critical facts and definitions
- --- between major sections
- Numbered lists for processes and steps

MERMAID DIAGRAMS:
Include mermaid code blocks where useful.
- ALWAYS put node labels in double quotes: A["label"]
- NEVER use <br/> tags inside labels
- Keep labels under 4 words
- Add %% Title as first line
- Use flowchart TD for processes, graph TD for hierarchies

TABLES:
Use markdown pipe tables for structured data:
| Column A | Column B |
|----------|----------|
| value    | value    |

CHART INSIGHTS:
For every chart or table in source:
### 📊 Chart Insights: [Name]
- **Key values**: ...
- **Trend**: ...
- **Comparisons**: ...
- **Anomalies**: ...
- **Inference**: ...

OUTPUT: Pure Markdown only. Start with 📐 line.`;
}

app.get("*", (_, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => {
  console.log(`\n🚀 NoteForge AI running at http://localhost:${PORT}\n`);
});
