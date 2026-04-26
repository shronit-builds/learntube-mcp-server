#!/usr/bin/env node

/**
 * LearnTube AI Readiness MCP Server (Remote SSE)
 *
 * 7 tools with explicit trigger phrases:
 *   connect    — Load user profile (session start)
 *   save       — "save this" → personal knowledge library
 *   recall     — "what do I know about X?" → knowledge synthesis
 *   checkpoint — After tasks / session end (auto)
 *   elevate    — "how did I do?" → AI skill reflection
 *   prove      — "test me" / "quiz me" → spot-the-flaw challenges
 *   sharpen    — "help me improve" / "help me learn X" → exercises
 *
 * Backend: Supabase (Postgres)
 * Framework: Framework A (AI-Augmented Performance, 8 abilities, 7 levels)
 */

import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import {
  handleSave,
  handleRecall,
  handleCheckpoint,
  handleElevate,
  handleProve,
  handleSharpen,
  handleConnect,
  cleanupSession,
} from "./handlers.js";

// ─── Server Instructions ──────────────────────────────────
// Transparent intent-routing for LearnTube tools. These are injected
// into Claude's system prompt at session start so Claude knows WHEN
// to route user intents to LearnTube tools and HOW to announce it
// transparently to the user.
//
// Design principles:
// - User always knows when LearnTube is active (one-line announcements)
// - Intent routing table tells Claude which phrase → which tool
// - Under 2KB (Claude Code truncation limit)
// - Imperative language, critical rules first
const SERVER_INSTRUCTIONS = `LearnTube gives this user a personal knowledge library and AI skill profile. It is a TRANSPARENT learning system — announce briefly in ONE LINE whenever you use it so the user knows it is active.

FIRST RESPONSE: Call learntube_connect(query_type: "streak_status") to load the user's profile. Then tell the user once: "Connected to your LearnTube profile — I'll help save insights, quiz you, and track your learning as we work." (If new user, welcome them briefly instead.)

INTENT ROUTING — user phrase → LearnTube tool:
• "save this" / "remember this" / "bookmark" / "note this"      → learntube_save
• "what do I know about X" / "my notes on X" / "recall X"       → learntube_recall
• "how did I do" / "evaluate me" / "feedback on my approach"    → learntube_elevate
• "test me" / "quiz me" / "challenge me"                        → learntube_prove
• "help me learn X" / "help me improve at X" / "practice"       → learntube_sharpen
• After a substantive task is completed                         → learntube_checkpoint
• User signals done ("thanks", "bye", "that's all")             → learntube_checkpoint(session_phase:"end")

Also call learntube_save proactively when you share a reusable tip, framework, or technique the user values — announce it: "Saving that framework to your LearnTube library."

ROUTING CLARITY:
• "save this" defaults to learntube_save (the user's personal library). Only save to a file if the user explicitly says "save to a file."
• "what do I know about X" asks about THEIR saves — always use learntube_recall, not your general knowledge.

ANNOUNCEMENTS (ONE LINE EACH):
• On save:       "Saving that to your LearnTube library."
• On recall:     "Checking your LearnTube notes on that…"
• On checkpoint: "Logging this session to your LearnTube profile."
• On quiz:       "Running a LearnTube Spot-the-Flaw challenge."
• On sharpen:    "Starting a LearnTube practice exercise."

Keep announcements short. No lengthy explanations. IDENTITY: Use first name if known. Never ask.`;

function createServer() {
  const server = new McpServer(
    {
      name: "learntube-ai-readiness",
      version: "0.6.0",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  // ─── Prompt Templates ──────────────────────────────────

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

  server.prompt(
    "save-this",
    "Save the current insight or idea to your LearnTube knowledge library",
    {},
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Save this to my LearnTube library — capture the key insight from what we just discussed using learntube_save.",
          },
        },
      ],
    })
  );

  server.prompt(
    "what-do-i-know",
    "Search your LearnTube library for what you've learned on a topic",
    {},
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "What do I know about [topic]? Use learntube_recall to search my LearnTube library and synthesize what I've captured.",
          },
        },
      ],
    })
  );

  server.prompt(
    "practice",
    "Start a 60-second LearnTube practice exercise on a topic or AI skill",
    {},
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Start a LearnTube practice session — use learntube_sharpen to give me a 60-second exercise on an area I should work on.",
          },
        },
      ],
    })
  );

  // ─── CONNECT — Personalization Context Loader ──────────
  // Registered first because it fires at session start.
  // Description uses high-frequency task keywords so Claude
  // matches it when users request writing, coding, analysis, etc.
  server.tool(
    "learntube_connect",
    "Loads this user's LearnTube profile — their domain expertise, recent work topics, skill level, streak, and recent saves — so your response can be personalized to them. Call once at the start of every conversation (query_type: 'streak_status'). When you call this, briefly tell the user in one line that you're connected to their LearnTube profile. Transparent operation: user should know LearnTube is active.",
    {
      query_type: z
        .enum([
          "related_saves",
          "ability_progress",
          "knowledge_gaps",
          "theme_clusters",
          "streak_status",
          "session_check",
        ])
        .describe(
          "'streak_status' at conversation start. 'related_saves' to find past work relevant to current task. 'ability_progress' for expertise trends. 'knowledge_gaps' for underexplored areas. 'theme_clusters' for work patterns."
        ),
      context: z
        .string()
        .optional()
        .describe(
          "What the user is working on now — helps find relevant past work and tailor recommendations."
        ),
      user_id: z
        .string()
        .optional()
        .describe("User identity if known. Omit if unknown."),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (args, extra) => handleConnect(args, extra)
  );

  // ─── SAVE — Personal Knowledge Library ─────────────────
  // Fires whenever Claude gives reusable advice, tips, techniques.
  // Description emphasizes bookmarking useful content across all
  // professional domains.
  server.tool(
    "learntube_save",
    "Saves an insight, tip, framework, or technique to the user's personal LearnTube knowledge library. TRIGGERS: 'save this', 'remember this', 'bookmark this', 'note this', 'keep this', 'stash that', 'save that insight'. Also call proactively when you share a reusable tip, pattern, or framework the user values. Covers all domains — writing, marketing, coding, product, data, operations, strategy, design, communication. Routing: for 'save this', the user's LearnTube library is the default save target (not a file) — only save to a file if the user explicitly says 'save to a file'. Announce in one line: 'Saving that to your LearnTube library.'",
    {
      insight: z
        .string()
        .describe(
          "The specific tip, technique, or recommendation to bookmark. Concrete and reusable — something worth revisiting later."
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          "2-5 tags for categorization. Optional — auto-inferred from content."
        ),
      domain: z
        .string()
        .optional()
        .describe(
          "Professional domain (marketing, product-management, software-engineering, data-science, operations, general). Optional — auto-inferred."
        ),
      context: z
        .string()
        .optional()
        .describe("What the user was working on when this insight emerged."),
      confidence: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .describe("Confidence level. 1=speculative, 5=well-established."),
      user_id: z
        .string()
        .optional()
        .describe("User identity if known. Omit if unknown."),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (args, extra) => handleSave(args, extra)
  );

  // ─── RECALL — Personal Knowledge Search & Synthesis ────
  // Fires when user asks "what do I know about X?"
  // Claude CANNOT answer this from its own knowledge — it needs
  // the user's personal saves. This makes the tool call mandatory.
  server.tool(
    "learntube_recall",
    "Searches and synthesizes the user's personal LearnTube saves on a topic. TRIGGERS: 'what do I know about X', 'recall X', 'my notes on X', 'what have I learned about X', 'search my saves', 'find my notes'. This queries THEIR personal saved insights — the user is asking about their own library, so answer from this tool, not from your general knowledge. Returns saves synthesized into themes, growth trajectory, connections, gaps, and study suggestions. Announce in one line: 'Checking your LearnTube notes on that…'",
    {
      topic: z
        .string()
        .describe(
          "The topic to search for in the user's personal knowledge library."
        ),
      domain: z
        .string()
        .optional()
        .describe(
          "Filter by professional domain if the user specifies one."
        ),
      user_id: z
        .string()
        .optional()
        .describe("User identity if known. Omit if unknown."),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (args, extra) => handleRecall(args, extra)
  );

  // ─── CHECKPOINT — Cross-Session Continuity ─────────────
  // The primary data capture tool. Fires after every substantial
  // task completion. Description emphasizes saving work for user
  // continuity, while quality metrics silently feed the scoring engine.
  server.tool(
    "learntube_checkpoint",
    "Logs completed work + quality signals to the user's LearnTube profile so they have continuity across sessions and their AI skill profile stays current. Call after any substantive task is completed. Also call with session_phase:'end' when the user signals done ('thanks', 'bye', 'that's all'). Include insights (key takeaways the user may want later) and behavioral_signals (A1-A8 scores on task quality). Announce in one line: 'Logging this session to your LearnTube profile.'",
    {
      insights: z
        .array(
          z.object({
            insight: z
              .string()
              .describe(
                "A key takeaway, technique, or recommendation from the completed work."
              ),
            tags: z
              .array(z.string())
              .optional()
              .describe("Tags for categorization (optional, auto-inferred)."),
            domain: z
              .string()
              .optional()
              .describe("Professional domain (optional, auto-inferred)."),
            context: z
              .string()
              .optional()
              .describe("What the user was working on."),
          })
        )
        .optional()
        .describe(
          "Key takeaways, techniques, or recommendations from the completed work. Include anything the user might want to reference in future sessions."
        ),
      behavioral_signals: z
        .object({
          task_type: z
            .string()
            .optional()
            .describe(
              "Type of work completed: content_creation, coding, analysis, research, learning, planning, brainstorming, writing, problem_solving, other."
            ),
          signals: z
            .object({
              A1: z
                .number()
                .min(0)
                .max(6)
                .nullable()
                .optional()
                .describe(
                  "Task scoping (0-6): How well-defined and appropriate was the task?"
                ),
              A2: z
                .number()
                .min(0)
                .max(6)
                .nullable()
                .optional()
                .describe(
                  "Context quality (0-6): How rich was the prompt — context, constraints, examples?"
                ),
              A3: z
                .number()
                .min(0)
                .max(6)
                .nullable()
                .optional()
                .describe(
                  "Output assessment (0-6): How critically was the result reviewed?"
                ),
              A4: z
                .number()
                .min(0)
                .max(6)
                .nullable()
                .optional()
                .describe(
                  "Refinement depth (0-6): How substantively was the work iterated?"
                ),
              A5: z
                .number()
                .min(0)
                .max(6)
                .nullable()
                .optional()
                .describe(
                  "Analytical depth (0-6): Was AI used for deeper thinking, not just execution?"
                ),
              A6: z
                .number()
                .min(0)
                .max(6)
                .nullable()
                .optional()
                .describe(
                  "Process structure (0-6): Was a repeatable approach applied?"
                ),
              A7: z
                .number()
                .min(0)
                .max(6)
                .nullable()
                .optional()
                .describe(
                  "Tool integration (0-6): Were multiple tools or approaches combined?"
                ),
              A8: z
                .number()
                .min(0)
                .max(6)
                .nullable()
                .optional()
                .describe(
                  "Knowledge scaling (0-6): Was the work designed to help or teach others?"
                ),
            })
            .optional()
            .describe(
              "Quality dimensions of the completed work. Score 0-6 where relevant, null where not applicable."
            ),
        })
        .optional()
        .describe(
          "Quality assessment of the interaction to calibrate future personalization. Include task_type and score relevant dimensions."
        ),
      session_phase: z
        .enum(["mid", "end"])
        .optional()
        .describe(
          "'mid' = after completing a task, 'end' = user wrapping up the session."
        ),
      user_id: z
        .string()
        .optional()
        .describe("User identity if known. Omit if unknown."),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (args, extra) => handleCheckpoint(args, extra)
  );

  // ─── ELEVATE — Performance Feedback (On-Demand) ────────
  // Only fires when user explicitly asks for evaluation.
  server.tool(
    "learntube_elevate",
    "Generates detailed LearnTube feedback on the user's AI interaction quality — what went well, what could improve, and the single most impactful behavior change for next time. TRIGGERS: 'how did I do', 'evaluate me', 'feedback on my approach', 'am I getting better', 'review my AI usage', 'assess my performance'. Be brutally specific — not 'provide more context' but 'tell me your audience is C-suite with 30 seconds to scan'. End with the ONE behavior change for next session. Announce in one line: 'Running a LearnTube reflection on how that session went.'",
    {
      task_description: z
        .string()
        .describe(
          "What the user was trying to accomplish. Be specific about the goal."
        ),
      interaction_summary: z
        .string()
        .describe(
          "How the interaction unfolded — prompts used, iteration patterns, evaluation behavior. Include specific examples."
        ),
      domain: z.string().describe("Professional domain of the task."),
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
        .describe(
          "Scores for abilities actually exercised this session (0-6). Only include what was observed."
        ),
      what_they_did_well: z
        .string()
        .describe(
          "1-2 specific things done well, with examples from the interaction."
        ),
      what_they_missed: z
        .string()
        .describe(
          "2-3 specific things a Level 4+ user would do differently. Be CONCRETE with examples."
        ),
      level_up_move: z
        .string()
        .describe(
          "The ONE behavior change for biggest impact next session. Actionable tomorrow."
        ),
      user_id: z
        .string()
        .optional()
        .describe("User identity if known. Omit if unknown."),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (args, extra) => handleElevate(args, extra)
  );

  // ─── PROVE — Spot the Flaw Challenges (On-Demand) ──────
  // Only fires when user explicitly asks for a challenge/test.
  server.tool(
    "learntube_prove",
    "Runs a LearnTube Spot-the-Flaw challenge — shows two AI outputs and tests whether the user can identify which is better. TRIGGERS: 'quiz me', 'test me', 'challenge me', 'how sharp am I', 'can I spot AI mistakes'. Present playfully: '30 seconds — pick the one you'd actually ship.' Announce in one line: 'Running a LearnTube Spot-the-Flaw challenge.'",
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
        .describe("Which trap to test. Rotate across sessions."),
      user_choice: z.enum(["A", "B"]).describe("Which output the user chose."),
      user_confidence: z
        .number()
        .min(1)
        .max(5)
        .describe("User's confidence in their choice (1-5)."),
      correct: z
        .boolean()
        .describe("Whether the user chose the correct output."),
      reasoning_quality: z
        .enum(["no_reasoning", "surface", "partial", "deep"])
        .optional()
        .describe(
          "Quality of reasoning: no_reasoning=just picked, surface=style, partial=one issue, deep=core trap."
        ),
      user_id: z
        .string()
        .optional()
        .describe("User identity if known. Omit if unknown."),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (args, extra) => handleProve(args, extra)
  );

  // ─── SHARPEN — Practice Exercises (On-Demand) ──────────
  // Only fires when user explicitly asks for practice/improvement.
  server.tool(
    "learntube_sharpen",
    "Runs a targeted 60-second LearnTube practice exercise or learning session. TRIGGERS: 'practice', 'exercise', 'drill', 'train me', 'help me improve at X', 'help me learn X', 'I want to get better at X', 'teach me about X'. Supports both AI skill practice (A1-A8 abilities) and topic-based learning — exercises are personalized to the user's existing LearnTube saves on the topic, making practice contextually relevant to what they've already captured. Announce in one line: 'Starting a LearnTube practice session on X.'",
    {
      target_ability: z
        .enum(["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"])
        .describe("The ability to practice."),
      exercise_type: z
        .string()
        .describe(
          "Exercise type: prompt_rewrite, task_triage, output_evaluation, iteration_challenge, thinking_extension, workflow_design, orchestration_scenario, teaching_exercise, topic_exploration."
        ),
      exercise_content: z
        .string()
        .describe(
          "The exercise — scenario, task, or material. Must be completable in 60 seconds."
        ),
      learning_topic: z
        .string()
        .optional()
        .describe(
          "When the user says 'help me learn X', pass X here. The server loads their existing knowledge on this topic to make the exercise contextually relevant."
        ),
      user_response: z
        .string()
        .optional()
        .describe("User's response to the exercise (for scoring)."),
      score: z
        .number()
        .min(0)
        .max(6)
        .optional()
        .describe("Score for this attempt (0-6)."),
      feedback: z
        .string()
        .optional()
        .describe(
          "Specific feedback on their response with concrete examples."
        ),
      domain: z
        .string()
        .optional()
        .describe("Professional domain for contextualization."),
      user_id: z
        .string()
        .optional()
        .describe("User identity if known. Omit if unknown."),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (args, extra) => handleSharpen(args, extra)
  );

  // ─── Semantic Aliases ──────────────────────────────────
  // Additional tool names that match natural-language user phrases
  // differently from canonical names. Same underlying handlers.
  // These maximize ToolSearch BM25 matching surface for common
  // phrasings that look nothing like the canonical tool name.

  server.tool(
    "learntube_what_do_i_know",
    "Alias for learntube_recall. Searches and synthesizes the user's personal LearnTube saves on a topic. Use when the user phrases it naturally: 'what do I know about X', 'what have I learned about X', 'show me what I know on X'. Same behavior and announcement as learntube_recall: 'Checking your LearnTube notes on that…'",
    {
      topic: z
        .string()
        .describe("The topic to search for in the user's personal LearnTube library."),
      domain: z.string().optional().describe("Optional domain filter."),
      user_id: z.string().optional().describe("User identity if known."),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (args, extra) => handleRecall(args, extra)
  );

  server.tool(
    "learntube_quiz_me",
    "Alias for learntube_prove. Runs a LearnTube Spot-the-Flaw challenge — shows two AI outputs, tests whether the user can pick the better one. Use when the user says 'quiz me', 'test me', 'challenge me'. Same behavior and announcement as learntube_prove: 'Running a LearnTube Spot-the-Flaw challenge.'",
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
        .describe("Which trap to test."),
      user_choice: z.enum(["A", "B"]).describe("Which output the user chose."),
      user_confidence: z
        .number()
        .min(1)
        .max(5)
        .describe("User's confidence in their choice (1-5)."),
      correct: z
        .boolean()
        .describe("Whether the user chose the correct output."),
      reasoning_quality: z
        .enum(["no_reasoning", "surface", "partial", "deep"])
        .optional()
        .describe("Quality of reasoning."),
      user_id: z.string().optional().describe("User identity if known."),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (args, extra) => handleProve(args, extra)
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
    cleanupSession(transport.sessionId);
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
    version: "0.6.0",
    tools: [
      "connect",
      "save",
      "recall",
      "checkpoint",
      "elevate",
      "prove",
      "sharpen",
      "what_do_i_know (alias)",
      "quiz_me (alias)",
    ],
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `LearnTube AI Readiness MCP server v0.6.0 running on http://localhost:${PORT}`
  );
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(
    `Tools: connect, save, recall, checkpoint, elevate, prove, sharpen (+ aliases: what_do_i_know, quiz_me)`
  );
});
