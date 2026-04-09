#!/usr/bin/env node

/**
 * LearnTube AI Readiness MCP Server (Remote SSE)
 *
 * 5 tools that live inside Claude (and any MCP-compatible client):
 *   save     — Save insights to your knowledge graph (variable rewards)
 *   elevate  — Brutally honest AI performance evaluation (chains to sharpen)
 *   prove    — Spot the Flaw challenges with Elo-rated Proof Score
 *   sharpen  — Targeted micro-exercises for specific abilities (60s max)
 *   connect  — Session-start heartbeat + knowledge graph connections
 *
 * Backend: Supabase (Postgres)
 * Framework: Framework A (AI-Augmented Performance, 8 abilities, 7 levels)
 * Pedagogy: Bloom's Mastery, Tiny Habits, Variable Rewards, Spaced Repetition
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
    version: "0.2.0",
  });

  // SAVE — Variable rewards, flash card queuing, domain growth
  server.tool(
    "learntube_save",
    TOOL_DEFINITIONS.find((t) => t.name === "learntube_save").description,
    {
      insight: z
        .string()
        .describe(
          "The specific insight, technique, or mental model to save. Concrete and reusable — not a conversation summary."
        ),
      tags: z
        .array(z.string())
        .describe(
          "2-5 tags: domain tags (marketing, engineering), ability tags (delegation, evaluation), topic tags."
        ),
      domain: z
        .string()
        .describe(
          "Professional domain (marketing, product-management, software-engineering, data-science, operations, general)."
        ),
      context: z
        .string()
        .optional()
        .describe(
          "Brief context: what problem were they solving? Helps connect saves later."
        ),
      confidence: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .describe(
          "User's confidence in this insight. 1=speculative, 5=battle-tested. Infer from tone if not stated."
        ),
    },
    async (args, extra) => handleSave(args, extra)
  );

  // ELEVATE — Formative evaluation, threshold proximity, chains to sharpen
  server.tool(
    "learntube_elevate",
    TOOL_DEFINITIONS.find((t) => t.name === "learntube_elevate").description,
    {
      task_description: z
        .string()
        .describe("What the user was trying to accomplish. Be specific about the goal."),
      interaction_summary: z
        .string()
        .describe(
          "How the interaction unfolded — prompts used, iteration patterns, evaluation behavior. Include specific examples."
        ),
      domain: z
        .string()
        .describe("Professional domain of the task."),
      user_level_estimate: z
        .number()
        .min(0)
        .max(6)
        .describe(
          "Honest level estimate (0-6). 0=Non-User, 1=Experimenter, 2=Functional, 3=Practitioner, 4=Strategic, 5=Architect, 6=Pioneer."
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
        .describe("Scores for abilities actually observed this session. Only include what you saw."),
      what_they_did_well: z
        .string()
        .describe("1-2 specific things done well, with examples from the interaction."),
      what_they_missed: z
        .string()
        .describe(
          "2-3 specific things a Level 4+ user would do differently. Be CONCRETE with examples."
        ),
      level_up_move: z
        .string()
        .describe("The ONE behavior change for biggest impact next session. Actionable tomorrow."),
    },
    async (args, extra) => handleElevate(args, extra)
  );

  // PROVE — Elo-rated Spot the Flaw with calibration tracking
  server.tool(
    "learntube_prove",
    TOOL_DEFINITIONS.find((t) => t.name === "learntube_prove").description,
    {
      challenge_domain: z
        .string()
        .describe("User's professional domain for challenge context."),
      challenge_type: z
        .enum([
          "polish_vs_substance",
          "confident_vs_hedged",
          "complete_vs_right",
          "specific_vs_generic",
          "agreement_trap",
        ])
        .describe("Which Artifact Effect trap to test. Rotate across sessions."),
      user_choice: z.enum(["A", "B"]).describe("Which output the user chose."),
      user_confidence: z
        .number()
        .min(1)
        .max(5)
        .describe("User's confidence in their choice (1-5). Gap between confidence and correctness = calibration."),
      correct: z
        .boolean()
        .describe("Whether the user chose the correct output."),
      reasoning_quality: z
        .enum(["no_reasoning", "surface", "partial", "deep"])
        .optional()
        .describe("Quality of reasoning: no_reasoning=just picked, surface=style, partial=one issue, deep=core trap."),
    },
    async (args, extra) => handleProve(args, extra)
  );

  // SHARPEN — 60-second micro-exercises, chains from elevate/prove
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
          "Exercise type: prompt_rewrite, task_triage, output_evaluation, iteration_challenge, thinking_extension, workflow_design, orchestration_scenario, teaching_exercise."
        ),
      exercise_content: z
        .string()
        .describe("The exercise content — scenario, task, or material. Must be completable in 60 seconds."),
      user_response: z
        .string()
        .optional()
        .describe("User's response to the exercise (for scoring)."),
      score: z
        .number()
        .min(0)
        .max(6)
        .optional()
        .describe("Score for this attempt (0-6, mapped to Framework A levels)."),
      feedback: z
        .string()
        .optional()
        .describe("Specific feedback on their response with concrete examples."),
      domain: z
        .string()
        .optional()
        .describe("Professional domain for contextualization."),
    },
    async (args, extra) => handleSharpen(args, extra)
  );

  // CONNECT — Session-start heartbeat + knowledge graph queries
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
        .describe("Query type. 'streak_status' MUST be called at session start. Others for deeper analysis."),
      context: z
        .string()
        .optional()
        .describe("Current conversation context for finding relevant past saves."),
      user_id: z
        .string()
        .optional()
        .describe("User's LearnTube ID (lowercase first name). Ask the user if unknown."),
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
  res.json({
    status: "ok",
    server: "learntube-ai-readiness",
    version: "0.2.0",
    features: [
      "proof-score-elo",
      "variable-rewards",
      "learning-queue",
      "ability-decay",
      "session-start-bootstrap",
    ],
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LearnTube AI Readiness MCP server v0.2.0 running on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Features: Proof Score, Variable Rewards, Learning Queue, Ability Decay, Session Bootstrap`);
});
