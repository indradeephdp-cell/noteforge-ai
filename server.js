require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const fetch   = require("node-fetch");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "100mb" }));

// ── Serve frontend from ROOT folder (index.html is in root) ──
app.use(express.static(path.join(__dirname)));

// ── Health ──
app.get("/api/health", (_, res) => res.json({ ok: true }));

// ── Gemini proxy ──
app.post("/api/generate", async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY not set on server." });

  const { prompt, pdfBase64, pageFrom, pageTo } = req.body;

  const parts = [];

  if (pdfBase64) {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: pdfBase64
      }
    });
    parts.push({
      text: `Create comprehensive, exam-ready structured notes from this PDF document. Focus on pages ${pageFrom || 1} to ${pageTo || 999}. Follow the instructions below exactly.\n\n${getSystemPrompt()}`
    });
  } else {
    parts.push({
      text: `Create comprehensive, exam-ready structured notes from the following content. Follow the instructions below exactly.\n\n${getSystemPrompt()}\n\n---\nCONTENT:\n${prompt}`
    });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
          topP: 0.95
        }
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ text });

  } catch (e) {
    console.error(e);
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
- (→ see: SectionName) for cross-references between topics
- Numbered lists for processes and steps
- Parallel bullet points for comparisons

MERMAID DIAGRAMS — MANDATORY WHERE USEFUL:
Include mermaid code blocks. STRICT SYNTAX RULES:
- ALWAYS put node labels in double quotes: A["label"]
- NEVER use <br/> or HTML tags inside labels — use a space
- NEVER use parentheses () or curly braces {} in labels
- Keep labels SHORT — maximum 4 words
- Always add %% Title as first line

flowchart TD — for processes and decisions
graph TD     — for hierarchies and classifications
timeline     — for chronological sequences

TABLES:
Use markdown pipe tables for all comparative or structured data:
| Column A | Column B | Column C |
|----------|----------|----------|
| value    | value    | value    |

CHART & TABLE INSIGHTS:
For every chart, table, graph, figure, or dataset in the source:
### 📊 Chart Insights: [Name]
- **Key values**: list the most important numbers or categories
- **Trend**: what direction or pattern is visible
- **Comparisons**: what stands out when comparing data points
- **Anomalies**: anything unusual or unexpected
- **Inference**: what this data means in context

OUTPUT: Pure Markdown only. Start with the 📐 Note Style line. Nothing before it.`;
}

// ── Frontend fallback ──
app.get("*", (_, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => {
  console.log(`\n🚀 NoteForge AI (Gemini Pro) → http://localhost:${PORT}\n`);
});
