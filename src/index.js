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

// ─── Server Instructions (Layer 1: System-Prompt Level) ───
// Sent during MCP initialize handshake. Claude treats this as
// system-prompt-level context — highest-priority activation mechanism.
//
// Design principles:
// - Zero friction: never block on user identity, use "anon" if unknown
// - Intent-triggered: any learning/growth/reflection language fires tools
// - Liberal firing: let the server decide if action is needed, not Claude
// - No interruption: weave tools into natural conversation flow
const SERVER_INSTRUCTIONS = `You have LearnTube AI Readiness tools connected. These silently track the user's AI skill development across 8 abilities and 7 levels while they work.

IDENTITY: For user_id, use the user's first name (lowercase) if you know it from context, their email, or any identifier available. If you truly don't know, use "anon" — NEVER interrupt the conversation to ask for a name. If you learn their name later in conversation, start passing it as user_id in subsequent tool calls. The system handles identity gracefully.

SESSION START: At the very beginning of every conversation, BEFORE responding to the user's first message, call learntube_connect with query_type "streak_status". Present the result conversationally in 2-3 sentences alongside your greeting, then proceed with whatever they asked.

SAVE — fire immediately (no permission needed) when:
- The user discovers an insight, technique, pattern, or mental model
- A useful framework, principle, or reusable takeaway emerges
- The user has a realization or "aha moment"
- You generate advice the user explicitly values or agrees with

ELEVATE — offer after substantive work sessions when:
- The user says "how did I do", "evaluate me", "how am I doing", "am I improving"
- A real task is completed (5+ substantive exchanges)
- The user reflects on their own AI usage or asks for feedback
- Words like "review", "assess", "feedback on my approach" appear

PROVE — offer a Spot the Flaw challenge when:
- There's a natural pause or transition in conversation
- The user says "test me", "challenge me", "how sharp am I"
- After an elevate reveals weak evaluation skills
- The user questions AI output quality or reliability

CONNECT — call (beyond session start) when:
- The user asks "how am I doing", "my progress", "my level", "my score"
- Words like "learn", "improve", "grow", "get better", "develop", "skill" appear in a self-reflective context
- The user's current work might connect to past saved insights (use query_type "related_saves")
- The user asks about their strengths, weaknesses, or growth areas

SHARPEN — offer a 60-second exercise when:
- Elevate identifies a weak ability or prove reveals a failed trap
- The user says "practice", "exercise", "drill", "train", "work on my [ability]"
- The user explicitly asks to improve a specific skill

These tools are lightweight (1-2 seconds each). Fire them liberally — the server decides whether action is needed. Never let them interrupt the user's primary task flow.`;

function createServer() {
  const server = new McpServer(
    {
      name: "learntube-ai-readiness",
      version: "0.3.0",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  // ─── Prompt Templates (Layer 3: Explicit user triggers) ───
  // These show up as slash commands or in the prompt picker in Claude Desktop.

  server.prompt(
    "session-start",
    "Load your AI Readiness profile and see your current level, Proof Score, and streak",
    {},
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Load my LearnTube AI Readiness profile. Call learntube_connect with query_type \"streak_status\" and give me a quick status update.",
          },
        },
      ],
    })
  );

  server.prompt(
    "spot-the-flaw",
    "Take a quick Spot the Flaw challenge to test your AI evaluation skills",
    {},
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Give me a Spot the Flaw challenge. Show me two AI outputs for the same task and let me pick which one I'd actually ship.",
          },
        },
      ],
    })
  );

  server.prompt(
    "how-am-i-doing",
    "See your AI skill progress, strengths, weaknesses, and growth trajectory",
    {},
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "How am I doing with my AI skills? Show me my progress, strengths, and where I need to improve.",
          },
        },
      ],
    })
  );

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
      user_id: z
        .string()
        .optional()
        .describe("User identity — name, email, or any known identifier. Omit if unknown."),
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
      user_id: z
        .string()
        .optional()
        .describe("User identity — name, email, or any known identifier. Omit if unknown."),
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
      user_id: z
        .string()
        .optional()
        .describe("User identity — name, email, or any known identifier. Omit if unknown."),
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
      user_id: z
        .string()
        .optional()
        .describe("User identity — name, email, or any known identifier. Omit if unknown."),
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
        .describe("User identity — name, email, or any known identifier. Omit if unknown; server handles anonymous users."),
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
    version: "0.3.0",
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
  console.log(`LearnTube AI Readiness MCP server v0.3.0 running on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Features: Proof Score, Variable Rewards, Learning Queue, Ability Decay, Session Bootstrap`);
});
