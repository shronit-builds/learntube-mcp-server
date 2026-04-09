/**
 * LearnTube MCP Tool Definitions
 * 5 tools: save, elevate, prove, sharpen, connect
 *
 * Tool descriptions are carefully crafted so Claude naturally suggests them
 * during conversations. The description IS the prompt to the host LLM.
 */

export const TOOL_DEFINITIONS = [
  {
    name: "learntube_save",
    description: `Save a valuable insight, technique, or mental model from this conversation to your LearnTube knowledge graph. Use this whenever the user discovers something genuinely useful — a new approach, a surprising finding, a reusable technique, or a mental model worth remembering. Don't wait for them to ask; if you notice they've landed on something worth saving, suggest it. The best saves are specific and actionable, not generic summaries.`,
    inputSchema: {
      type: "object",
      properties: {
        insight: {
          type: "string",
          description:
            "The specific insight, technique, or mental model to save. Should be concrete and reusable — not a summary of the conversation, but the distilled takeaway someone would want to recall later.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "2-5 tags categorizing this insight. Use domain tags (marketing, engineering, product), ability tags (delegation, evaluation, iteration), and topic tags.",
        },
        domain: {
          type: "string",
          description:
            "The professional domain this insight applies to (e.g., marketing, product-management, software-engineering, data-science, operations, general).",
        },
        context: {
          type: "string",
          description:
            "Brief context on how this insight emerged — what problem were they solving? This helps connect saves later.",
        },
        confidence: {
          type: "number",
          minimum: 1,
          maximum: 5,
          description:
            "How confident is the user in this insight? 1 = speculative/exploring, 5 = battle-tested and validated. If not explicitly stated, infer from conversation tone.",
        },
      },
      required: ["insight", "tags", "domain"],
    },
  },
  {
    name: "learntube_elevate",
    description: `Analyze the user's AI interaction in this conversation and give them a brutally honest performance evaluation. Use this when a user has just completed a meaningful task with you — they've drafted something, solved a problem, or worked through an analysis. The evaluation shows them exactly what a world-class AI user (Level 4+) would have done differently. This is the core value: specific, actionable feedback they can't get anywhere else. Suggest this naturally at the end of productive sessions: "Want me to evaluate how we worked together on this? I can show you what a power user would have done differently."`,
    inputSchema: {
      type: "object",
      properties: {
        task_description: {
          type: "string",
          description:
            "What the user was trying to accomplish in this session. Be specific about the goal, not just the topic.",
        },
        interaction_summary: {
          type: "string",
          description:
            "Summary of how the interaction unfolded — what did the user ask for, how did they prompt, did they iterate, did they evaluate output critically? Include specific examples of their prompts and reactions.",
        },
        domain: {
          type: "string",
          description:
            "The professional domain of the task (marketing, engineering, product, etc.)",
        },
        user_level_estimate: {
          type: "number",
          minimum: 0,
          maximum: 6,
          description:
            "Your honest estimate of the user's AI performance level (0-6) based on this interaction. 0=Non-User, 1=Experimenter, 2=Functional User, 3=Effective Practitioner, 4=Strategic Deployer, 5=System Architect, 6=Pioneer.",
        },
        ability_scores: {
          type: "object",
          description:
            "Scores for each Framework A ability observed in this interaction. Only include abilities that were actually exercised. Score 0-6.",
          properties: {
            A1: { type: "number", minimum: 0, maximum: 6 },
            A2: { type: "number", minimum: 0, maximum: 6 },
            A3: { type: "number", minimum: 0, maximum: 6 },
            A4: { type: "number", minimum: 0, maximum: 6 },
            A5: { type: "number", minimum: 0, maximum: 6 },
            A6: { type: "number", minimum: 0, maximum: 6 },
            A7: { type: "number", minimum: 0, maximum: 6 },
            A8: { type: "number", minimum: 0, maximum: 6 },
          },
        },
        what_they_did_well: {
          type: "string",
          description:
            "1-2 specific things the user did well, with quotes or examples from the interaction.",
        },
        what_they_missed: {
          type: "string",
          description:
            "2-3 specific things a Level 4+ user would have done differently. Be CONCRETE — not 'provide more context' but 'tell me your audience is C-suite with 30 seconds to scan, which changes the entire structure.'",
        },
        level_up_move: {
          type: "string",
          description:
            "The ONE single behavior change that would have the biggest impact on their next session. So specific they can do it tomorrow.",
        },
      },
      required: [
        "task_description",
        "interaction_summary",
        "domain",
        "user_level_estimate",
        "what_they_did_well",
        "what_they_missed",
        "level_up_move",
      ],
    },
  },
  {
    name: "learntube_prove",
    description: `Run a Spot the Flaw challenge — test the user's ability to evaluate AI output critically. Present two AI outputs for the same task; one looks better but is wrong, the other looks worse but is right. This is the Artifact Effect Gauntlet. Use this when the user seems curious about their AI skills, when there's a natural pause in conversation, or when the user explicitly asks to test themselves. Frame it as: "Want a quick challenge? I'll show you two AI outputs — pick the one you'd actually use. Most people get it wrong."`,
    inputSchema: {
      type: "object",
      properties: {
        challenge_domain: {
          type: "string",
          description:
            "The domain to contextualize the challenge in (user's professional domain). This makes the challenge feel relevant, not abstract.",
        },
        challenge_type: {
          type: "string",
          enum: [
            "polish_vs_substance",
            "confident_vs_hedged",
            "complete_vs_right",
            "specific_vs_generic",
            "agreement_trap",
          ],
          description:
            "Which Artifact Effect trap to test. Rotate through them across sessions.",
        },
        user_choice: {
          type: "string",
          enum: ["A", "B"],
          description: "Which output the user chose.",
        },
        user_confidence: {
          type: "number",
          minimum: 1,
          maximum: 5,
          description:
            "How confident the user is in their choice (1-5). The gap between confidence and correctness IS the calibration score.",
        },
        correct: {
          type: "boolean",
          description: "Whether the user chose the right output.",
        },
        reasoning_quality: {
          type: "string",
          enum: ["no_reasoning", "surface", "partial", "deep"],
          description:
            "Quality of the user's reasoning for their choice. 'no_reasoning' = just picked. 'surface' = mentioned format/style. 'partial' = caught one issue. 'deep' = identified the core trap.",
        },
      },
      required: [
        "challenge_domain",
        "challenge_type",
        "user_choice",
        "user_confidence",
        "correct",
      ],
    },
  },
  {
    name: "learntube_sharpen",
    description: `Help the user level up a specific AI skill through a targeted micro-exercise. This is the training layer — when a user's elevate feedback or prove results reveal a specific weakness, sharpen gives them a 2-minute exercise to work on it. For example: if they're weak on A2 (Communication), give them a prompt-rewriting exercise. If they're weak on A1 (Delegation), give them a task-triage exercise. Use this after elevate or prove reveals a gap, or when the user asks "how do I get better at X?"`,
    inputSchema: {
      type: "object",
      properties: {
        target_ability: {
          type: "string",
          enum: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"],
          description: "The Framework A ability to sharpen.",
        },
        exercise_type: {
          type: "string",
          description:
            "The type of micro-exercise: prompt_rewrite, task_triage, output_evaluation, iteration_challenge, thinking_extension, workflow_design.",
        },
        exercise_content: {
          type: "string",
          description:
            "The actual exercise content — the scenario, the task, or the material the user works with.",
        },
        user_response: {
          type: "string",
          description: "The user's response to the exercise.",
        },
        score: {
          type: "number",
          minimum: 0,
          maximum: 6,
          description:
            "Score for this exercise attempt (0-6, mapped to Framework A levels).",
        },
        feedback: {
          type: "string",
          description:
            "Specific feedback on their response — what was good, what to improve, with concrete examples.",
        },
        domain: {
          type: "string",
          description: "Professional domain for contextualization.",
        },
      },
      required: ["target_ability", "exercise_type", "exercise_content"],
    },
  },
  {
    name: "learntube_connect",
    description: `Find connections between the user's saved insights and surface patterns in their AI usage. This queries their knowledge graph to reveal: themes they keep returning to, abilities that are growing vs. stagnant, and connections between insights they haven't noticed. Use this when the user has 10+ saves, when they're working on something related to a past save, or when they ask "what have I learned?" or "show me my progress." Frame it as: "You've saved 47 insights over the past month. Want to see what patterns are emerging in how you use AI?"`,
    inputSchema: {
      type: "object",
      properties: {
        query_type: {
          type: "string",
          enum: [
            "related_saves",
            "ability_progress",
            "knowledge_gaps",
            "theme_clusters",
            "streak_status",
          ],
          description:
            "What kind of connection to surface. 'related_saves' = finds saves related to current conversation. 'ability_progress' = shows growth trajectory across A1-A8. 'knowledge_gaps' = identifies domains/abilities with few saves. 'theme_clusters' = groups saves by emerging themes. 'streak_status' = current streak and tier progress.",
        },
        context: {
          type: "string",
          description:
            "Current conversation context — what the user is working on now. Used to find relevant past saves.",
        },
        user_id: {
          type: "string",
          description: "The user's LearnTube ID.",
        },
      },
      required: ["query_type"],
    },
  },
];
