# LearnTube AI Readiness — Setup Guide

## What This Is

A system that measures and improves your AI skills while you work. It runs inside Claude Desktop (via MCP) and tracks your performance across 8 abilities as you use AI for real tasks.

**Two parts:**
1. **MCP Server** — runs inside Claude Desktop, adds 5 tools (save, elevate, prove, sharpen, connect)
2. **Companion Dashboard** — open `dashboard.html` in your browser to see your profile grow

---

## Step 1: Install the MCP Server (5 minutes)

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ installed
- [Claude Desktop](https://claude.ai/download) installed

### Install

```bash
# 1. Navigate to where you downloaded this folder
cd learntube-mcp-server

# 2. Install dependencies
npm install
```

### Configure Claude Desktop

Open Claude Desktop's config file:
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this inside the `"mcpServers"` object (create it if it doesn't exist):

```json
{
  "mcpServers": {
    "learntube-ai-readiness": {
      "command": "node",
      "args": ["/FULL/PATH/TO/learntube-mcp-server/src/index.js"],
      "env": {
        "SUPABASE_URL": "https://ctindecnqexjzwteigff.supabase.co",
        "SUPABASE_SERVICE_KEY": "YOUR_KEY_HERE",
        "DEFAULT_USER_ID": "your-name"
      }
    }
  }
}
```

**Important:** Replace `/FULL/PATH/TO/` with the actual absolute path to the folder on your machine. Replace `your-name` with a short, unique user ID (e.g., `shronit`, `priya`, `alex`).

### Restart Claude Desktop

Quit and reopen Claude Desktop. You should see a hammer icon with "5 tools" in the bottom-left of a new conversation.

---

## Step 2: Open the Dashboard

Open `learntube-companion/dashboard.html` in your browser. That's it — no server needed.

Enter your user ID (the same one from `DEFAULT_USER_ID`) and hit Load. The dashboard auto-refreshes from the live database.

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

## FAQ

**Do I need to remember to use the tools?**
No. Claude will suggest them naturally during conversation when relevant. You can also ask directly: "Can you elevate this session?" or "Save that insight."

**Does it slow down my workflow?**
The tools take 1-2 seconds each. Save and elevate happen at the END of sessions, not during. They add reflection, not friction.

**What if I'm a beginner?**
That's the point. The system meets you where you are. Level 0-2 is where most people start.
