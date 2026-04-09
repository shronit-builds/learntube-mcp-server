# LearnTube AI Readiness — Setup Guide

## What This Is

A system that measures and improves your AI skills while you work. It runs inside Claude Desktop (via MCP) and tracks your performance across 8 abilities as you use AI for real tasks.

**Two parts:**
1. **MCP Server** — a remote server that adds 5 tools to Claude Desktop (save, elevate, prove, sharpen, connect)
2. **Companion Dashboard** — a web app to see your profile grow

---

## Step 1: Connect the MCP Server (2 minutes)

### Prerequisites
- [Claude Desktop](https://claude.ai/download) installed

### Configure Claude Desktop

Open Claude Desktop's config file:
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this inside the `"mcpServers"` object:

```json
{
  "mcpServers": {
    "learntube-ai-readiness": {
      "url": "https://coaching-mcp-v2-production-4a72.up.railway.app/sse"
    }
  }
}
```

That's it. No local install needed.

### Restart Claude Desktop

Quit and reopen Claude Desktop. You should see a hammer icon with "5 tools" in the bottom-left of a new conversation.

---

## Step 2: Open the Dashboard

Visit: **[https://shronit-builds.github.io/learntube-dashboard/](https://shronit-builds.github.io/learntube-dashboard/)**

Enter your user ID and hit Load. The dashboard auto-refreshes from the live database.

**Tip:** Bookmark it. After every Claude session, check the dashboard to see your profile update.

---

## Step 3: Start Using It

### During any Claude session

Just use Claude normally for your real work. The tools will appear naturally:

| When this happens... | Claude may suggest... |
|---|---|
| You discover something insightful | **save** — stores the insight in your knowledge graph |
| You finish a task with AI | **elevate** — brutally honest evaluation of how you used AI |
| You want to test your judgment | **prove** — Spot the Flaw challenge (can you catch AI mistakes?) |
| You want targeted practice | **sharpen** — micro-exercise for a specific ability |
| You want to see patterns | **connect** — surfaces connections across your saved insights |

### What you'll see in the dashboard

- **Tier Badge** — Your current AI Readiness level (Explorer → Pioneer)
- **Ability Radar** — 8-axis chart showing your strengths and gaps
- **Spot the Flaw** — Your accuracy at catching AI mistakes, with calibration tracking
- **Elevate History** — Timeline of session evaluations
- **Knowledge Graph** — All your saved insights, tagged and searchable

---

## The 8 Abilities

| Code | Ability | What It Measures |
|---|---|---|
| A1 | Delegation | Knowing WHAT to give AI vs keep |
| A2 | Communication | How well you frame problems for AI |
| A3 | Evaluation | Catching errors and bad reasoning |
| A4 | Iteration | Refining substance, not just format |
| A5 | Thinking | Using AI as a genuine thinking partner |
| A6 | Workflow | Designing AI-integrated processes |
| A7 | Orchestration | Managing multiple AI tools in concert |
| A8 | Multiplication | Making others more productive with AI |

---

## Deployed URLs

| Service | URL |
|---|---|
| MCP Server (SSE) | `https://coaching-mcp-v2-production-4a72.up.railway.app/sse` |
| Health Check | `https://coaching-mcp-v2-production-4a72.up.railway.app/health` |
| Dashboard | `https://shronit-builds.github.io/learntube-dashboard/` |
| MCP GitHub Repo | `https://github.com/shronit-builds/learntube-mcp-server` |
| Dashboard GitHub Repo | `https://github.com/shronit-builds/learntube-dashboard` |

---

## FAQ

**Do I need to install anything locally?**
No. The MCP server runs remotely. Just paste the URL into your Claude Desktop config.

**Do I need to remember to use the tools?**
No. Claude will suggest them naturally during conversation when relevant. You can also ask directly: "Can you elevate this session?" or "Save that insight."

**Does it slow down my workflow?**
The tools take 1-2 seconds each. Save and elevate happen at the END of sessions, not during. They add reflection, not friction.

**What if I'm a beginner?**
That's the point. The system meets you where you are. Level 0-2 is where most people start.
