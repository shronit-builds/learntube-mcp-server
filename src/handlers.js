/**
 * Tool handlers — the actual logic for each MCP tool
 */

import {
  createSave,
  getSaves,
  getSaveCount,
  searchSaves,
  createEdge,
  getUserScore,
  upsertUserScore,
  recordProveResult,
  getProveHistory,
  recordElevateResult,
  updateStreak,
  getAbilityProgress,
  getThemeClusters,
} from "./db.js";
import { ABILITIES, LEVELS, estimateLevel, TOOL_ABILITY_MAP } from "./framework.js";

// For now, derive userId from a header or env. In production, this comes from auth.
function getUserId(extra) {
  // MCP doesn't have auth built in — for Phase 0, use a static user or
  // derive from the client's metadata. Production will use Supabase auth.
  return extra?.userId || process.env.DEFAULT_USER_ID || "demo-user";
}

// ─── SAVE ────────────────────────────────────────────────

export async function handleSave(args, extra) {
  const userId = getUserId(extra);

  try {
    const save = await createSave({
      userId,
      insight: args.insight,
      tags: args.tags,
      domain: args.domain,
      context: args.context,
      confidence: args.confidence,
    });

    const saveCount = await getSaveCount(userId);
    const streak = await updateStreak(userId);

    // Auto-connect: find related saves by overlapping tags
    let connections = [];
    if (saveCount > 5) {
      const related = await getSaves(userId, {
        tags: args.tags,
        limit: 3,
      });
      connections = related
        .filter((s) => s.id !== save.id)
        .map((s) => ({
          id: s.id,
          insight: s.insight.substring(0, 80),
          sharedTags: s.tags.filter((t) => args.tags.includes(t)),
        }));

      // Create edges for strong connections (2+ shared tags)
      for (const conn of connections) {
        if (conn.sharedTags.length >= 2) {
          await createEdge(save.id, conn.id, "tag_overlap").catch(() => {});
        }
      }
    }

    // Build knowledge graph stage message
    let graphStage;
    if (saveCount <= 50) {
      graphStage = `Stage 1: Building your foundation (${saveCount}/50 saves). Each save is tagged and searchable.`;
    } else if (saveCount <= 200) {
      graphStage = `Stage 2: Connections emerging (${saveCount} saves). Your insights are starting to link — ${connections.length} related saves found.`;
    } else {
      graphStage = `Stage 3: Knowledge graph active (${saveCount} saves). AI-inferred connections revealing patterns you haven't noticed.`;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              saved: true,
              saveId: save.id,
              totalSaves: saveCount,
              streak: streak.streakDays,
              graphStage,
              relatedInsights:
                connections.length > 0
                  ? connections.map((c) => c.insight)
                  : null,
              message: `Saved to your knowledge graph. ${graphStage}${
                streak.streakDays > 1
                  ? ` 🔥 ${streak.streakDays}-day streak.`
                  : ""
              }`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error saving insight: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

// ─── ELEVATE ─────────────────────────────────────────────

export async function handleElevate(args, extra) {
  const userId = getUserId(extra);

  try {
    // Record the evaluation
    const result = await recordElevateResult(userId, {
      taskDescription: args.task_description,
      domain: args.domain,
      levelEstimate: args.user_level_estimate,
      abilityScores: args.ability_scores || {},
      whatDidWell: args.what_they_did_well,
      whatMissed: args.what_they_missed,
      levelUpMove: args.level_up_move,
    });

    const userScore = await getUserScore(userId);
    const level = args.user_level_estimate;
    const levelInfo = LEVELS[level] || LEVELS[0];

    // Build the ability radar
    const abilityRadar = {};
    if (args.ability_scores) {
      for (const [key, score] of Object.entries(args.ability_scores)) {
        if (score !== null && score !== undefined && ABILITIES[key]) {
          abilityRadar[ABILITIES[key].shortName] = {
            score,
            level: LEVELS[Math.min(score, 6)]?.name || "Unknown",
          };
        }
      }
    }

    // Determine if they crossed the critical Level 2→3 threshold
    const criticalTransition =
      level === 2
        ? "You're at the most important transition point. The gap between Level 2 and Level 3 is where most people plateau — and where the biggest gains live. The key: stop accepting AI output that 'looks good' and start evaluating whether the reasoning is sound."
        : level === 3
        ? "You've crossed the hardest threshold — you evaluate AI critically, not just cosmetically. The next frontier: designing workflows, not just using tools."
        : null;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              evaluation: {
                sessionLevel: level,
                tier: levelInfo.tier,
                tierColor: levelInfo.color,
                levelName: levelInfo.name,
                abilityRadar,
                whatYouDidWell: args.what_they_did_well,
                whatYouMissed: args.what_they_missed,
                levelUpMove: args.level_up_move,
                criticalTransition,
              },
              progress: {
                totalElevates: userScore?.total_elevates || 1,
                runningAbilities: userScore?.abilities || {},
              },
              credential: {
                currentTier: levelInfo.tier,
                tierColor: levelInfo.color,
                shareUrl: `https://learntube.ai/credential/${userId}`,
                message: `Your AI Readiness credential is live. Share it to show where you stand.`,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error running elevate: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

// ─── PROVE ───────────────────────────────────────────────

export async function handleProve(args, extra) {
  const userId = getUserId(extra);

  try {
    const result = await recordProveResult(userId, {
      challengeType: args.challenge_type,
      challengeDomain: args.challenge_domain,
      userChoice: args.user_choice,
      correct: args.correct,
      userConfidence: args.user_confidence,
      reasoningQuality: args.reasoning_quality,
    });

    const history = await getProveHistory(userId, 10);
    const recentCorrect = history.filter((h) => h.correct).length;
    const recentTotal = history.length;
    const accuracy = recentTotal > 0 ? (recentCorrect / recentTotal) * 100 : 0;

    // Calculate calibration score
    const avgConfidenceWhenWrong = history
      .filter((h) => !h.correct)
      .reduce((sum, h) => sum + h.user_confidence, 0) /
      (history.filter((h) => !h.correct).length || 1);

    const calibrationScore =
      avgConfidenceWhenWrong > 3
        ? "Overconfident when wrong — this is the classic Level 2 pattern"
        : avgConfidenceWhenWrong > 2
        ? "Moderately calibrated — you sometimes know what you don't know"
        : "Well calibrated — you know when you're uncertain";

    // Which traps they fall for most
    const trapPerformance = {};
    for (const h of history) {
      if (!trapPerformance[h.challenge_type]) {
        trapPerformance[h.challenge_type] = { correct: 0, total: 0 };
      }
      trapPerformance[h.challenge_type].total++;
      if (h.correct) trapPerformance[h.challenge_type].correct++;
    }

    const streak = await updateStreak(userId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              result: {
                correct: args.correct,
                challengeType: args.challenge_type,
                confidenceGap: args.correct
                  ? 0
                  : args.user_confidence - 1,
              },
              stats: {
                recentAccuracy: `${Math.round(accuracy)}% (${recentCorrect}/${recentTotal})`,
                calibration: calibrationScore,
                trapPerformance,
                streak: streak.streakDays,
              },
              abilityImpact: {
                primary: "A3 (Output Evaluation)",
                secondary: "A1 (Problem Delegation)",
                message: (() => {
                  // Format trap name: "polish_vs_substance" → "polish vs substance"
                  // "agreement_trap" → "agreement" (strip trailing _trap to avoid "agreement trap trap")
                  const trapName = args.challenge_type
                    .replace(/_trap$/, "")
                    .replace(/_/g, " ");
                  if (args.correct) {
                    return "You resisted the trap. This is Level 3+ evaluation skill.";
                  }
                  const confidenceMsg = args.user_confidence >= 4
                    ? "And you were confident about it — that's the dangerous pattern."
                    : "But you weren't sure — that uncertainty is actually a good sign.";
                  return `You fell for the ${trapName} trap. ${confidenceMsg}`;
                })(),
              },
              sharePrompt: (() => {
                if (!args.correct) return null;
                const trapName = args.challenge_type
                  .replace(/_trap$/, "")
                  .replace(/_/g, " ");
                return `I caught the ${trapName} trap in LearnTube's Spot the Flaw challenge. ${Math.round(accuracy)}% accuracy across ${recentTotal} challenges. Think you can beat that?`;
              })(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error recording prove result: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

// ─── SHARPEN ─────────────────────────────────────────────

export async function handleSharpen(args, extra) {
  const userId = getUserId(extra);

  try {
    const ability = ABILITIES[args.target_ability];
    if (!ability) {
      return {
        content: [
          { type: "text", text: `Unknown ability: ${args.target_ability}` },
        ],
        isError: true,
      };
    }

    // If this is a submission (has user_response + score), record it
    if (args.user_response && args.score !== undefined) {
      // Store in a general activity log
      const streak = await updateStreak(userId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                exercise: {
                  ability: ability.name,
                  type: args.exercise_type,
                  score: args.score,
                  levelEquivalent: LEVELS[Math.min(args.score, 6)]?.name,
                  feedback: args.feedback,
                },
                progress: {
                  streak: streak.streakDays,
                  message:
                    args.score >= 3
                      ? `Solid ${ability.shortName} performance. You're operating at Effective Practitioner level on this exercise.`
                      : `Room to grow on ${ability.shortName}. The key gap: ${ability.signals.high[0]?.replace(/_/g, " ")}. Try again with that focus.`,
                },
                nextStep:
                  args.score < 3
                    ? `Want to try another ${ability.shortName} exercise? Repetition at the edge of your ability is where growth happens.`
                    : `Your ${ability.shortName} is strong. Want to test a different ability, or run an elevate on your next real task?`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // If this is just the exercise content (no response yet), acknowledge
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              exercise: {
                ability: ability.name,
                abilityId: args.target_ability,
                type: args.exercise_type,
                content: args.exercise_content,
                domain: args.domain,
              },
              instructions:
                "Exercise loaded. The user should work through this, then call sharpen again with their response for scoring.",
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error in sharpen: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

// ─── CONNECT ─────────────────────────────────────────────

export async function handleConnect(args, extra) {
  const userId = getUserId(extra);

  try {
    switch (args.query_type) {
      case "related_saves": {
        if (!args.context) {
          return {
            content: [
              {
                type: "text",
                text: "Need conversation context to find related saves. What are you currently working on?",
              },
            ],
          };
        }
        const related = await searchSaves(userId, args.context);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  relatedSaves: related.map((s) => ({
                    insight: s.insight,
                    domain: s.domain,
                    tags: s.tags,
                    savedAt: s.created_at,
                    confidence: s.confidence_score,
                  })),
                  message:
                    related.length > 0
                      ? `Found ${related.length} related insights from your knowledge graph. Your past work connects to what you're doing now.`
                      : "No closely related saves yet. This might be a new domain for you — save insights from this session to start building the thread.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "ability_progress": {
        const progress = await getAbilityProgress(userId);
        const userScore = await getUserScore(userId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  abilities: userScore?.abilities || {},
                  evaluationHistory: progress.map((p) => ({
                    scores: p.ability_scores,
                    date: p.created_at,
                  })),
                  totalEvaluations: progress.length,
                  message:
                    progress.length > 0
                      ? `${progress.length} evaluations tracked. Your ability profile is sharpening with each session.`
                      : "No evaluations yet. Run 'elevate' after your next real task to start tracking progress.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "knowledge_gaps": {
        const saves = await getSaves(userId, { limit: 100 });
        const domains = {};
        const abilities = {};

        for (const save of saves) {
          domains[save.domain] = (domains[save.domain] || 0) + 1;
          for (const tag of save.tags || []) {
            abilities[tag] = (abilities[tag] || 0) + 1;
          }
        }

        // Find underrepresented areas
        const allDomains = [
          "marketing",
          "product-management",
          "software-engineering",
          "data-science",
          "operations",
          "strategy",
        ];
        const gaps = allDomains.filter((d) => !domains[d] || domains[d] < 3);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  domainCoverage: domains,
                  gaps,
                  totalSaves: saves.length,
                  message:
                    gaps.length > 0
                      ? `Gaps detected in: ${gaps.join(", ")}. These are domains where you have few or no saved insights.`
                      : "Broad coverage across domains. Your knowledge graph is diversifying.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "theme_clusters": {
        const clusters = await getThemeClusters(userId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  themes: clusters.slice(0, 10),
                  message:
                    clusters.length > 0
                      ? `Your top themes: ${clusters
                          .slice(0, 5)
                          .map((c) => `${c.tag} (${c.count} saves)`)
                          .join(", ")}`
                      : "Not enough saves yet to identify themes. Keep saving — patterns emerge after ~20 saves.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "streak_status": {
        const userScore = await getUserScore(userId);
        const saveCount = await getSaveCount(userId);

        const levelInfo = LEVELS[userScore?.level || 0];
        const streak = userScore?.streak_days || 0;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  streak: {
                    days: streak,
                    message:
                      streak >= 7
                        ? `🔥 ${streak}-day streak. You're building a real habit.`
                        : streak >= 3
                        ? `${streak}-day streak. Consistency is where the compound gains come from.`
                        : streak === 0
                        ? "No active streak. Start one today — even a single save counts."
                        : `${streak}-day streak. Keep going.`,
                  },
                  tier: {
                    current: levelInfo?.tier || "Explorer",
                    color: levelInfo?.color || "gray",
                    level: userScore?.level || 0,
                    levelName: levelInfo?.name || "Non-User",
                  },
                  stats: {
                    totalSaves: saveCount,
                    totalElevates: userScore?.total_elevates || 0,
                    totalProves: userScore?.total_proves || 0,
                  },
                  credential: {
                    shareUrl: `https://learntube.ai/credential/${userId}`,
                    message: "Your living credential updates with every interaction.",
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown query type: ${args.query_type}. Use: related_saves, ability_progress, knowledge_gaps, theme_clusters, or streak_status.`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error in connect: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}
