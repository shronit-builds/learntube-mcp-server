/**
 * Framework A: AI-Augmented Performance
 * Core scoring logic and ability definitions
 */

export const ABILITIES = {
  A1: {
    id: "A1",
    name: "AI Problem Delegation",
    shortName: "Delegation",
    description:
      "Knowing WHAT to give to AI, what to keep, and what to collaborate on",
    signals: {
      low: [
        "delegates_everything",
        "delegates_nothing",
        "wrong_task_type",
        "no_decomposition",
      ],
      mid: [
        "some_delegation_sense",
        "knows_basic_boundaries",
        "inconsistent_judgment",
      ],
      high: [
        "precise_delegation",
        "knows_frontier",
        "adjusts_for_model",
        "decomposes_well",
      ],
    },
  },
  A2: {
    id: "A2",
    name: "AI Communication",
    shortName: "Communication",
    description:
      "Framing problems, providing context, setting constraints for AI",
    signals: {
      low: ["vague_prompts", "no_context", "no_constraints", "one_line_asks"],
      mid: [
        "decent_context",
        "some_constraints",
        "format_specified",
        "role_given",
      ],
      high: [
        "rich_context",
        "success_criteria_set",
        "examples_given",
        "model_specific_adaptation",
      ],
    },
  },
  A3: {
    id: "A3",
    name: "AI Output Evaluation",
    shortName: "Evaluation",
    description:
      "Assessing quality of AI output — catching errors, hallucinations, plausible-but-wrong reasoning",
    signals: {
      low: [
        "accepts_first_output",
        "no_pushback",
        "format_over_substance",
        "misses_errors",
      ],
      mid: [
        "some_evaluation",
        "catches_obvious_errors",
        "questions_sometimes",
      ],
      high: [
        "systematic_evaluation",
        "catches_subtle_errors",
        "evaluates_reasoning",
        "resists_artifact_effect",
      ],
    },
  },
  A4: {
    id: "A4",
    name: "AI-Assisted Iteration",
    shortName: "Iteration",
    description:
      "Refining through multi-turn interaction — iterating on substance, not just format",
    signals: {
      low: [
        "no_iteration",
        "only_format_changes",
        "gives_up_after_one",
        "restarts_instead_of_refining",
      ],
      mid: [
        "some_substance_iteration",
        "asks_for_alternatives",
        "builds_on_output",
      ],
      high: [
        "deep_substance_iteration",
        "challenges_logic",
        "explores_alternatives",
        "knows_when_to_restart",
      ],
    },
  },
  A5: {
    id: "A5",
    name: "AI-Augmented Thinking",
    shortName: "Thinking",
    description:
      "Using AI as a genuine thinking partner — extending cognitive capacity",
    signals: {
      low: ["task_executor_only", "no_brainstorming", "no_stress_testing"],
      mid: [
        "some_brainstorming",
        "asks_what_am_i_missing",
        "occasional_thinking_partner",
      ],
      high: [
        "genuine_cognitive_partner",
        "scenario_analysis",
        "perspective_generation",
        "strategic_pause_habit",
      ],
    },
  },
  A6: {
    id: "A6",
    name: "AI Workflow Design",
    shortName: "Workflow",
    description:
      "Designing workflows and processes that incorporate AI at the right points",
    signals: {
      low: ["ad_hoc_usage", "no_templates", "no_process_thinking"],
      mid: [
        "some_templates",
        "repeatable_workflows",
        "knows_tool_strengths",
      ],
      high: [
        "systematic_workflows",
        "feedback_loops",
        "multi_tool_orchestration",
        "continuous_improvement",
      ],
    },
  },
  A7: {
    id: "A7",
    name: "AI System Orchestration",
    shortName: "Orchestration",
    description:
      "Managing multiple AI tools, agents, and models in concert",
    signals: {
      low: ["single_tool", "no_agent_thinking"],
      mid: ["multi_tool", "some_agent_use", "basic_pipelines"],
      high: [
        "parallel_agents",
        "agent_handoffs",
        "self_improving_systems",
        "ai_verifies_ai",
      ],
    },
  },
  A8: {
    id: "A8",
    name: "AI Multiplication",
    shortName: "Multiplication",
    description:
      "Making other people more productive with AI — teaching, coaching, creating systems",
    signals: {
      low: ["solo_user", "no_sharing"],
      mid: ["shares_prompts", "informal_teaching", "some_documentation"],
      high: [
        "systematic_training",
        "org_practices",
        "scales_ai_adoption",
        "coaches_others",
      ],
    },
  },
};

export const LEVELS = {
  0: {
    level: 0,
    name: "Non-User",
    tier: "Explorer",
    color: "gray",
    description: "Does not use AI in their work",
  },
  1: {
    level: 1,
    name: "Experimenter",
    tier: "Explorer",
    color: "gray",
    description: "Occasional AI use, takes output at face value",
  },
  2: {
    level: 2,
    name: "Functional User",
    tier: "Practitioner",
    color: "green",
    description:
      "Regular user, real but inconsistent gains, limited evaluation",
  },
  3: {
    level: 3,
    name: "Effective Practitioner",
    tier: "Operator",
    color: "blue",
    description:
      "Good frontier discipline, evaluates critically, genuine thinking partner",
  },
  4: {
    level: 4,
    name: "Strategic Deployer",
    tier: "Strategist",
    color: "purple",
    description:
      "Designs workflows, multiplies team performance, strategic AI deployment",
  },
  5: {
    level: 5,
    name: "System Architect",
    tier: "Architect",
    color: "orange",
    description:
      "Orchestrates multi-agent systems, builds self-improving workflows",
  },
  6: {
    level: 6,
    name: "Pioneer",
    tier: "Pioneer",
    color: "red",
    description:
      "Pushes the frontier, creates new paradigms for human-AI collaboration",
  },
};

/**
 * Compute a rough level estimate from ability signals observed in a save/elevate interaction.
 * This is a lightweight heuristic — the full IRT + Kalman engine runs server-side.
 *
 * @param {Object} abilityScores - { A1: 0-6, A2: 0-6, ... }
 * @returns {number} Estimated level 0-6
 */
export function estimateLevel(abilityScores) {
  const scores = Object.values(abilityScores).filter(
    (s) => s !== null && s !== undefined
  );
  if (scores.length === 0) return 0;

  // Weighted average — A1, A3, A5 are the most discriminating abilities
  const weights = { A1: 1.5, A2: 1.0, A3: 1.5, A4: 1.0, A5: 1.3, A6: 1.0, A7: 0.8, A8: 0.8 };
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [ability, score] of Object.entries(abilityScores)) {
    if (score !== null && score !== undefined) {
      const w = weights[ability] || 1.0;
      weightedSum += score * w;
      totalWeight += w;
    }
  }

  const avg = weightedSum / totalWeight;

  // Floor constraint: you can't be Level 3+ without A3 ≥ 3 (evaluation is the gate)
  if (abilityScores.A3 !== undefined && abilityScores.A3 < 3 && avg >= 3) {
    return 2;
  }

  return Math.round(avg);
}

/**
 * Map a tool interaction to the abilities it exercises.
 */
export const TOOL_ABILITY_MAP = {
  save: ["A2", "A5"], // What they save reveals communication quality and thinking depth
  elevate: ["A1", "A3", "A4", "A5"], // Evaluation of their own AI interaction
  prove: ["A3", "A1"], // Artifact Effect Gauntlet — output evaluation + frontier discipline
  sharpen: ["A2", "A4"], // Communication improvement through iteration
  connect: ["A5", "A6", "A8"], // Thinking across saves, workflow patterns, sharing
};
