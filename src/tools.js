/**
 * LearnTube MCP Tool Definitions
 * 5 tools: save, elevate, prove, sharpen, connect
 *
 * These descriptions ARE the behavioral instructions for the host LLM.
 * They use imperative language deliberately — "MUST", "REQUIRED" — because
 * suggestive language ("you might want to") doesn't trigger reliable tool usage.
 *
 * Pedagogy grounding:
 * - Bloom's Mastery: every measurement is also a teaching moment
 * - Tiny Habits (Fogg): anchor to existing behavior, celebrate micro-wins
 * - Variable Rewards (Hooked): same action, different reward magnitude
 * - Loss Aversion: streaks, Proof Score that can drop, visible decay
 * - 90-Second Rule: nothing takes more than 90 seconds inside the conversation
 */

export const TOOL_DEFINITIONS = [
  {
    name: "learntube_save",
    description: `When the user discovers a specific insight, technique, or mental model during conversation, call this tool to save it to their knowledge graph. Do NOT ask permission — save it and tell them: "Just saved [specific insight] to your knowledge graph." Keep the announcement to 1-2 sentences unless the tool returns connections or milestones, in which case share those too. A good session produces 1-3 saves. Don't over-save generic observations — save concrete, reusable takeaways the user would want to recall later. If the user completed substantive work and you haven't saved at least one insight, you're leaving value on the table.`,
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
    description: `After a substantive session where the user completed real work with you, offer to evaluate their AI interaction. Judge whether the session qualifies: Did it involve 5+ substantive exchanges? Did you observe at least 2 abilities in action? Was there real problem-solving, not just Q&A or quick lookups? If yes, offer the evaluation. If the session was light, skip it entirely — do NOT evaluate trivial conversations. Offer roughly once every 3-5 qualifying sessions, not every time. Frame as: "We did some real work together on that. Want me to be honest about how you used me? 10 seconds to read." Be brutally specific in your evaluation — not "provide more context" but "tell me your audience is C-suite with 30 seconds to scan, which changes the entire structure." Always end with the ONE behavior change for next session AND the distance to the nearest ability threshold crossing. If any ability is within 0.5 of a level boundary, highlight it — that proximity is highly motivating.`,
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
    description: `Offer a Spot the Flaw challenge when there's a natural pause in conversation, after completing a task, or after an elevate reveals weak evaluation skills. Maximum one challenge per session unless the user asks for more. Present it as playful, not a test: "Quick challenge — I'll show you two AI outputs for the same task. Pick the one you'd actually ship. 30 seconds." Generate the two outputs yourself based on the user's professional domain — one polished but flawed (the trap), one rougher but correct. The flaw should test one of the five Artifact Effect traps. After the user chooses and rates their confidence (1-5), call this tool with their choice and your assessment. IMPORTANT: In your response, include the emoji result (use a green checkmark for correct, red X for wrong) and their updated Proof Score. If correct, share the rarity stat ("Only X% of users catch this one") when available. If wrong, explain specifically what they missed and why the trap works — this is the teaching moment. Then offer: "Want to try another?"`,
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
    description: `After elevate identifies a weak ability or prove reveals a failed trap, offer a targeted micro-exercise. Maximum 60 seconds. Generate the exercise from the user's professional domain — not a generic textbook problem, but something that feels like their real work. Frame as: "Want a 60-second exercise to practice [ability name]? You're [X] away from [next threshold]." If the user declines or the session ends, the exercise still gets queued to their companion app for later. When scoring a response, give specific feedback tied to the ability, update the score, and celebrate if they cross a level threshold. Never offer sharpen unprompted without a diagnosis from elevate or prove — it should always feel earned and targeted, not random.`,
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
      },
      required: ["target_ability", "exercise_type", "exercise_content"],
    },
  },
  {
    name: "learntube_connect",
    description: `SESSION INITIALIZATION — call this FIRST in every conversation with query_type "streak_status", before any other response. This is the session handshake that loads the user's AI Readiness profile. Without this call, no other LearnTube tools will have user context. If you don't know the user's identity, ask "What's your first name?" and use the lowercase version as user_id for ALL tool calls this session. Present the result conversationally in 2-3 sentences alongside your greeting: their level and tier, Proof Score with distance to next band, and any ability that hasn't been exercised in 3+ days (flag as "getting rusty"). Then proceed with whatever they asked. Also call with query_type "related_saves" mid-conversation when the user's current work might connect to past insights.`,
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
            "What kind of connection to surface. 'streak_status' MUST be called at session start. 'related_saves' finds saves related to current work. Others for deeper analysis.",
        },
        context: {
          type: "string",
          description:
            "Current conversation context — what the user is working on now. Used to find relevant past saves.",
        },
        user_id: {
          type: "string",
          description: "The user's LearnTube ID (lowercase first name). Ask the user if you don't know it.",
        },
      },
      required: ["query_type"],
    },
  },
];
