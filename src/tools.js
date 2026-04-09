/**
 * LearnTube MCP Tool Definitions
 * 5 tools: save, elevate, prove, sharpen, connect
 *
 * DESIGN PHILOSOPHY (v0.3.0):
 * These descriptions maximize semantic trigger surface. Claude matches
 * user intent against tool descriptions — the MORE concepts listed,
 * the higher the activation probability. Conditions and guards are
 * minimized because they reduce firing rate. The SERVER handles
 * judgment (should we actually act?) — Claude's job is just to fire.
 *
 * Identity: user_id is always optional. Server falls back gracefully
 * to "anon" or env default. NEVER require name before firing.
 *
 * Pedagogy grounding:
 * - Bloom's Mastery: every measurement is also a teaching moment
 * - Tiny Habits (Fogg): anchor to existing behavior, celebrate micro-wins
 * - Variable Rewards (Hooked): same action, different reward magnitude
 * - Loss Aversion: streaks, Proof Score that can drop, visible decay
 * - 90-Second Rule: nothing takes more than 90 seconds
 */

export const TOOL_DEFINITIONS = [
  {
    name: "learntube_save",
    description: `Save an insight, technique, pattern, or mental model to the user's AI knowledge graph. Call this immediately — do NOT ask permission. Just save it and briefly announce: "Saved [specific insight] to your knowledge graph." Fire this when: the user discovers something reusable, a valuable technique or framework emerges, the user has a realization, you generate advice the user values, a pattern or principle crystallizes, the user says something like "that's a good point" or "I didn't think of that", a concrete takeaway emerges from the work. A good session produces 1-3 saves. If substantive work happened and you haven't saved anything, you're leaving value on the table. If the tool returns connections or milestones, share those too.`,
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
        user_id: {
          type: "string",
          description:
            "User's identity — first name, email, or any known identifier. If unknown, omit and server uses a default.",
        },
      },
      required: ["insight", "tags", "domain"],
    },
  },
  {
    name: "learntube_elevate",
    description: `Evaluate the user's AI interaction quality for this session. Fire this when: the user asks "how did I do?", "how am I doing?", "evaluate me", "am I getting better?", "feedback on my approach", "review my AI usage", "assess my performance"; or when a substantive task is complete (5+ real exchanges, actual problem-solving, not just Q&A). Also fire when the user reflects on their own learning, improvement, growth, or skill development with AI. Be brutally specific — not "provide more context" but "tell me your audience is C-suite with 30 seconds to scan, which changes the entire structure." Always end with the ONE behavior change for next session AND distance to nearest ability threshold.`,
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
        user_id: {
          type: "string",
          description:
            "User's identity — first name, email, or any known identifier. If unknown, omit.",
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
    description: `Run a Spot the Flaw challenge to test the user's AI evaluation judgment. Fire this when: there's a natural pause in conversation, the user says "test me", "challenge me", "quiz me", "how sharp am I", "can I spot AI mistakes"; after completing a task; after an elevate reveals weak evaluation skills; or when the topic of AI reliability, output quality, hallucinations, or trust in AI comes up. Present it as playful: "Quick challenge — I'll show you two AI outputs. Pick the one you'd actually ship. 30 seconds." Generate two outputs yourself — one polished but flawed (the trap), one rougher but correct. After the user chooses, call this tool. Include the emoji result and updated Proof Score. Maximum one per session unless the user asks for more.`,
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
        user_id: {
          type: "string",
          description:
            "User's identity — first name, email, or any known identifier. If unknown, omit.",
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
    description: `Run a targeted 60-second micro-exercise for a specific AI ability. Fire this when: an elevate identified a weak ability, a prove revealed a failed trap, the user says "practice", "exercise", "drill", "train", "work on my skills", "help me improve at [X]", "I want to get better at [X]"; or when the user expresses frustration with a specific AI interaction pattern ("I keep making this mistake", "I always fall for this"). Generate the exercise from the user's professional domain. Give specific feedback tied to the ability and celebrate threshold crossings.`,
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
            "The type of micro-exercise: prompt_rewrite, task_triage, output_evaluation, iteration_challenge, thinking_extension, workflow_design, orchestration_scenario, teaching_exercise.",
        },
        exercise_content: {
          type: "string",
          description:
            "The actual exercise content — the scenario, the task, or the material the user works with. Must be completable in 60 seconds.",
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
        user_id: {
          type: "string",
          description:
            "User's identity — first name, email, or any known identifier. If unknown, omit.",
        },
      },
      required: ["target_ability", "exercise_type", "exercise_content"],
    },
  },
  {
    name: "learntube_connect",
    description: `Load the user's AI Readiness profile and surface connections. SESSION START: Call this with query_type "streak_status" at the beginning of every conversation — this is the session handshake. Without it, other tools lack user context. For user_id, use whatever you know — their name, email, any identifier from conversation context. If truly unknown, omit it entirely (server handles anonymous users). NEVER interrupt the conversation to ask for identity. ALSO fire this when: the user asks "how am I doing?", "what's my level?", "my progress", "my score", "where do I stand?", "how have I grown?"; words like "learn", "improve", "grow", "develop", "skill", "ability", "level up", "get better" appear in a self-reflective context; the user's current work connects to past insights (use query_type "related_saves" with context); the user asks about strengths, weaknesses, gaps, or growth areas.`,
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
            "What kind of connection to surface. 'streak_status' at session start. 'related_saves' finds past insights related to current work. 'ability_progress' for skill trends. 'knowledge_gaps' for underexplored domains.",
        },
        context: {
          type: "string",
          description:
            "Current conversation context — what the user is working on now. Used to find relevant past saves.",
        },
        user_id: {
          type: "string",
          description:
            "User's identity — first name, email, or any known identifier. If unknown, omit entirely. Server handles anonymous users gracefully.",
        },
      },
      required: ["query_type"],
    },
  },
];
