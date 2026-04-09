#!/usr/bin/env node

/**
 * LearnTube AI Readiness MCP Server (Remote SSE)
 *
 * 5 tools that live inside Claude (and any MCP-compatible client):
 *   save     — Save insights to your knowledge graph
 *   elevate  — Get a brutally honest evaluation of your AI interaction
 *   prove    — Spot the Flaw challenges (Artifact Effect Gauntlet)
 *   sharpen  — Targeted micro-exercises for specific abilities
 *   connect  — Surface patterns and connections across your saves
 *
 * Backend: Supabase (Postgres)
 * Framework: Framework A (AI-Augmented Performance, 8 abilities, 7 levels)
 */

import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { TOOL_DEFINITIONS } from "./tools.js";
import {
  handleSave,
  handleElevate,
  handleProve,
  handleSharpen,
  handleConnect,
} from "./handlers.js";

// ─── Tool Registration Factory ──────────────────────────

function createServer() {
  const server = new McpServer({
    name: "learntube-ai-readiness",
    version: "0.1.0",
  });

  // SAVE
  server.tool(
    "learntube_save",
    TOOL_DEFINITIONS.find((t) => t.name === "learntube_save").description,
    {
      insight: z
        .string()
        .describe(
          "The specific insight, technique, or mental model to save. Should be concrete and reusable — not a summary of the conversation, but the distilled takeaway someone would want to recall later."
        ),
      tags: z
        .array(z.string())
        .describe(
          "2-5 tags categorizing this insight. Use domain tags (marketing, engineering, product), ability tags (delegation, evaluation, iteration), and topic tags."
        ),
      domain: z
        .string()
        .describe(
          "The professional domain this insight applies to (e.g., marketing, product-management, software-engineering, data-science, operations, general)."
        ),
      context: z
        .string()
        .optional()
        .describe(
          "Brief context on how this insight emerged — what problem were they solving? This helps connect saves later."
        ),
      confidence: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .describe(
          "How confident is the user in this insight? 1 = speculative/exploring, 5 = battle-tested and validated."
        ),
    },
    async (args, extra) => handleSave(args, extra)
  );

  // ELEVATE
  server.tool(
    "learntube_elevate",
    TOOL_DEFINITIONS.find((t) => t.name === "learntube_elevate").description,
    {
      task_description: z
        .string()
        .describe(
          "What the user was trying to accomplish in this session. Be specific about the goal, not just the topic."
        ),
      interaction_summary: z
        .string()
        .describe(
          "Summary of how the interaction unfolded — what did the user ask for, how did they prompt, did they iterate, did they evaluate output critically? Include specific examples."
        ),
      domain: z
        .string()
        .describe(
          "The professional domain of the task (marketing, engineering, product, etc.)"
        ),
      user_level_estimate: z
        .number()
        .min(0)
        .max(6)
        .describe(
          "Your honest estimate of the user's AI performance level (0-6). 0=Non-User, 1=Experimenter, 2=Functional User, 3=Effective Practitioner, 4=Strategic Deployer, 5=System Architect, 6=Pioneer."
        ),
      ability_scores: z
        .object({
          A1: z.number().min(0).max(6).optional(),
          A2: z.number().min(0).max(6).optional(),
          A3: z.number().min(0).max(6).optional(),
          A4: z.number().min(0).max(6).optional(),
          A5: z.number().min(0).max(6).optional(),
          A6: z.number().min(0).max(6).optional(),
          A7: z.number().min(0).max(6).optional(),
          A8: z.number().min(0).max(6).optional(),
        })
        .optional()
        .describe(
          "Scores for each Framework A ability observed in this interaction. Only include abilities that were actually exercised. Score 0-6."
        ),
      what_they_did_well: z
        .string()
        .describe(
          "1-2 specific things the user did well, with quotes or examples from the interaction."
        ),
      what_they_missed: z
        .string()
        .describe(
          "2-3 specific things a Level 4+ user would have done differently. Be CONCRETE."
        ),
      level_up_move: z
        .string()
        .describe(
          "The ONE single behavior change that would have the biggest impact on their next session."
        ),
    },
    async (args, extra) => handleElevate(args, extra)
  );

  // PROVE
  server.tool(
    "learntube_prove",
    TOOL_DEFINITIONS.find((t) => t.name === "learntube_prove").description,
    {
      challenge_domain: z
        .string()
        .describe(
          "The domain to contextualize the challenge in (user's professional domain)."
        ),
      challenge_type: z
        .enum([
          "polish_vs_substance",
          "confident_vs_hedged",
          "complete_vs_right",
          "specific_vs_generic",
          "agreement_trap",
        ])
        .describe("Which Artifact Effect trap to test. Rotate through them across sessions."),
      user_choice: z.enum(["A", "B"]).describe("Which output the user chose."),
      user_confidence: z
        .number()
        .min(1)
        .max(5)
        .describe(
          "How confident the user is in their choice (1-5). The gap between confidence and correctness IS the calibration score."
        ),
      correct: z
        .boolean()
        .describe("Whether the user chose the right output."),
      reasoning_quality: z
        .enum(["no_reasoning", "surface", "partial", "deep"])
        .optional()
        .describe(
          "Quality of the user's reasoning for their choice."
        ),
    },
    async (args, extra) => handleProve(args, extra)
  );

  // SHARPEN
  server.tool(
    "learntube_sharpen",
    TOOL_DEFINITIONS.find((t) => t.name === "learntube_sharpen").description,
    {
      target_ability: z
        .enum(["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"])
        .describe("The Framework A ability to sharpen."),
      exercise_type: z
        .string()
        .describe(
          "The type of micro-exercise: prompt_rewrite, task_triage, output_evaluation, iteration_challenge, thinking_extension, workflow_design."
        ),
      exercise_content: z
        .string()
        .describe(
          "The actual exercise content — the scenario, the task, or the material the user works with."
        ),
      user_response: z
        .string()
        .optional()
        .describe("The user's response to the exercise."),
      score: z
        .number()
        .min(0)
        .max(6)
        .optional()
        .describe(
          "Score for this exercise attempt (0-6, mapped to Framework A levels)."
        ),
      feedback: z
        .string()
        .optional()
        .describe(
          "Specific feedback on their response — what was good, what to improve."
        ),
      domain: z
        .string()
        .optional()
        .describe("Professional domain for contextualization."),
    },
    async (args, extra) => handleSharpen(args, extra)
  );

  // CONNECT
  server.tool(
    "learntube_connect",
    TOOL_DEFINITIONS.find((t) => t.name === "learntube_connect").description,
    {
      query_type: z
        .enum([
          "related_saves",
          "ability_progress",
          "knowledge_gaps",
          "theme_clusters",
          "streak_status",
        ])
        .describe(
          "What kind of connection to surface."
        ),
      context: z
        .string()
        .optional()
        .describe(
          "Current conversation context — what the user is working on now. Used to find relevant past saves."
        ),
      user_id: z
        .string()
        .optional()
        .describe("The user's LearnTube ID."),
    },
    async (args, extra) => handleConnect(args, extra)
  );

  return server;
}

// ─── HTTP + SSE Server ──────────────────────────────────

const app = express();

// Store active transports keyed by session ID
const transports = {};

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;

  res.on("close", () => {
    delete transports[transport.sessionId];
  });

  const server = createServer();
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) {
    res.status(400).json({ error: "Unknown session" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", server: "learntube-ai-readiness", version: "0.1.0" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LearnTube AI Readiness MCP server running on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});
