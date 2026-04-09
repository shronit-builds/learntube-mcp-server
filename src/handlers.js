/**
 * Tool handlers — the coaching loop logic for each MCP tool
 *
 * Design principles embedded in every handler:
 * - Bloom's Mastery: every measurement is also a teaching moment
 * - Variable Rewards: same action, different reward magnitudes
 * - Tiny Habits: celebrate micro-wins immediately
 * - Loss Aversion: streaks, Proof Score, visible decay
 * - 90-Second Rule: keep it snackable
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
  createLearningQueueItem,
  getLearningQueueCount,
  updateProofScore,
  getProveRarityForType,
} from "./db.js";
import {
  ABILITIES,
  LEVELS,
  estimateLevel,
  TOOL_ABILITY_MAP,
  PROOF_BANDS,
  CHALLENGE_DIFFICULTY_MAP,
  calculateProofScore,
  getBandForScore,
  getNextBandDistance,
  EXERCISE_TYPE_MAP,
  checkMilestone,
} from "./framework.js";

// ─── Identity Resolution ─────────────────────────────────
// Zero-friction identity: never block on knowing the user's name.
// Priority: explicit user_id > session cache > MCP client metadata > env default > "anon"
// If Claude learns the user's name mid-conversation, it starts passing it
// and the session cache updates automatically. All prior "anon" data stays
// under "anon" — migration is a Phase 1 concern.
let _sessionUserId = null;

function getUserId(extra, args) {
  // 1. Explicit user_id in tool args (highest priority — Claude passes this)
  if (args?.user_id && args.user_id.trim()) {
    _sessionUserId = args.user_id.toLowerCase().trim();
    return _sessionUserId;
  }
  // 2. Session cache (set by any previous tool call this session)
  if (_sessionUserId) return _sessionUserId;
  // 3. Extra metadata from MCP client (some clients pass user info)
  if (extra?.userId) {
    _sessionUserId = extra.userId;
    return _sessionUserId;
  }
  // 4. Env fallback (configured per deployment)
  if (process.env.DEFAULT_USER_ID) {
    _sessionUserId = process.env.DEFAULT_USER_ID;
    return _sessionUserId;
  }
  // 5. Anonymous fallback — always works, never blocks
  _sessionUserId = "anon";
  return "anon";
}

// ─── SAVE ────────────────────────────────────────────────
// Pedagogy: Variable rewards on every save. Sometimes just a confirmation,
// sometimes a connection to past insight, sometimes a milestone.
// Also creates a flash card in the learning queue for the companion app.

export async function handleSave(args, extra) {
  const userId = getUserId(extra, args);

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

    // ── Variable Reward Layer ──────────────────────────

    // Check for milestone (variable reward: sometimes just a save, sometimes a milestone)
    const milestone = checkMilestone(saveCount);

    // Domain growth: how deep is the user going in this domain?
    const domainSaves = await getSaves(userId, { domain: args.domain, limit: 50 });
    const domainCount = domainSaves.length;
    const recentTopics = [...new Set(domainSaves.slice(0, 10).flatMap((s) => s.tags || []))].slice(0, 5);

    const domainGrowth = {
      totalInDomain: domainCount,
      recentTopics,
      message:
        domainCount >= 10
          ? `${domainCount} insights in ${args.domain}. Your most frequent themes: ${recentTopics.join(", ")}. This is becoming a real knowledge base.`
          : `${domainCount} insight${domainCount === 1 ? "" : "s"} in ${args.domain} so far. After 10, patterns start emerging.`,
    };

    // Auto-connect: find related saves by overlapping tags
    let connections = [];
    if (saveCount > 3) {
      const related = await getSaves(userId, {
        tags: args.tags,
        limit: 5,
      });
      connections = related
        .filter((s) => s.id !== save.id)
        .map((s) => ({
          id: s.id,
          insight: s.insight.substring(0, 100),
          sharedTags: s.tags.filter((t) => args.tags.includes(t)),
        }));

      // Create edges for strong connections (2+ shared tags)
      for (const conn of connections) {
        if (conn.sharedTags.length >= 2) {
          await createEdge(save.id, conn.id, "tag_overlap").catch(() => {});
        }
      }
    }

    // Determine reward magnitude for the response
    let rewardType = "standard"; // standard | connection | milestone
    if (milestone.hit) rewardType = "milestone";
    else if (connections.length > 0 && connections[0].sharedTags.length >= 2) rewardType = "connection";

    // ── Flash Card for Companion App ──────────────────
    // Every save becomes a learning queue item the user can review later
    try {
      // Generate a flash card that tests application, not just recall.
      // Use the insight itself to derive a question about when/how to apply it.
      const insightPreview = args.insight.substring(0, 80);
      const flashFront = args.context
        ? `You were working on ${args.context.substring(0, 60)}. What was the key technique you discovered that you'd use again?`
        : args.insight.length > 40
          ? `When would you apply this approach: "${insightPreview}..."?`
          : `How would you apply this in your next ${args.domain} task: "${insightPreview}"?`;

      await createLearningQueueItem(userId, {
        type: "flash_card",
        front: flashFront,
        back: args.insight,
        sourceTool: "save",
        sourceId: save.id,
        domain: args.domain,
      });
    } catch (e) {
      // Non-critical — don't fail the save if queue insert fails
    }

    // ── Build Response ────────────────────────────────

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
              rewardType,
              domainGrowth,
              milestone: milestone.hit ? milestone : null,
              relatedInsights:
                connections.length > 0
                  ? connections.slice(0, 3).map((c) => ({
                      insight: c.insight,
                      sharedTags: c.sharedTags,
                    }))
                  : null,
              message: (() => {
                let msg = `Saved to your knowledge graph.`;
                if (milestone.hit) {
                  msg += ` 🏆 Milestone: ${milestone.message}`;
                } else if (connections.length > 0 && connections[0].sharedTags.length >= 2) {
                  msg += ` This connects to a past insight: "${connections[0].insight}" — you're building a pattern.`;
                }
                msg += ` ${domainGrowth.message}`;
                if (streak.streakDays > 1) {
                  msg += ` 🔥 ${streak.streakDays}-day streak.`;
                }
                return msg;
              })(),
              companionAppNote:
                "A flash card from this insight has been added to your companion app for review.",
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
// Pedagogy: Bloom's formative assessment. Every evaluation comes with
// specific next action + threshold proximity (loss aversion).
// Chains to sharpen for the weakest ability observed.

export async function handleElevate(args, extra) {
  const userId = getUserId(extra, args);

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

    // Build the ability radar with threshold proximity detection
    const abilityRadar = {};
    let weakestAbility = null;
    let weakestScore = 7;
    let thresholdProximity = [];

    if (args.ability_scores) {
      for (const [key, score] of Object.entries(args.ability_scores)) {
        if (score !== null && score !== undefined && ABILITIES[key]) {
          const nextLevel = Math.ceil(score);
          const distance = nextLevel - score;
          const isClose = distance > 0 && distance <= 0.5;

          abilityRadar[ABILITIES[key].shortName] = {
            score,
            level: LEVELS[Math.min(Math.round(score), 6)]?.name || "Unknown",
            nearThreshold: isClose,
          };

          if (isClose) {
            thresholdProximity.push({
              ability: ABILITIES[key].shortName,
              abilityId: key,
              current: score,
              threshold: nextLevel,
              distance: Math.round(distance * 100) / 100,
              nextLevelName: LEVELS[Math.min(nextLevel, 6)]?.name || "Unknown",
            });
          }

          if (score < weakestScore) {
            weakestScore = score;
            weakestAbility = { id: key, ...ABILITIES[key] };
          }
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

    // ── Chain to Sharpen (next action) ────────────────
    let nextAction = null;
    if (weakestAbility) {
      const exerciseType = EXERCISE_TYPE_MAP[weakestAbility.id] || "output_evaluation";
      nextAction = {
        tool: "learntube_sharpen",
        target_ability: weakestAbility.id,
        exercise_type: exerciseType,
        ability_name: weakestAbility.shortName,
        score: weakestScore,
        instruction: `Offer a 60-second exercise: "Want a quick exercise to practice ${weakestAbility.shortName}? Your score was ${weakestScore.toFixed(1)}${
          thresholdProximity.find((t) => t.abilityId === weakestAbility.id)
            ? ` — you're ${thresholdProximity.find((t) => t.abilityId === weakestAbility.id).distance} away from ${thresholdProximity.find((t) => t.abilityId === weakestAbility.id).nextLevelName}`
            : ""
        }."`,
      };
    }

    // ── Learning Queue: Growth Exercise ───────────────
    try {
      await createLearningQueueItem(userId, {
        type: "growth_exercise",
        front: `Practice for next session: ${args.level_up_move}`,
        back: `From your ${args.domain} session: ${args.what_they_missed}\n\nThe ONE move: ${args.level_up_move}`,
        sourceTool: "elevate",
        sourceId: result.id,
        domain: args.domain,
      });
    } catch (e) {
      // Non-critical
    }

    // ── Companion App Queue Count ─────────────────────
    const queueCount = await getLearningQueueCount(userId).catch(() => 0);

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
                thresholdProximity:
                  thresholdProximity.length > 0 ? thresholdProximity : null,
                whatYouDidWell: args.what_they_did_well,
                whatYouMissed: args.what_they_missed,
                levelUpMove: args.level_up_move,
                criticalTransition,
              },
              progress: {
                totalElevates: userScore?.total_elevates || 1,
                runningAbilities: userScore?.abilities || {},
              },
              nextAction,
              companionApp: {
                pendingItems: queueCount,
                message:
                  queueCount > 0
                    ? `You have ${queueCount} items waiting in your companion app — flash cards, exercises, and reviews from your sessions.`
                    : null,
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
// Pedagogy: Elo-rated challenges with immediate score movement (loss aversion),
// rarity stats (social proof), calibration tracking, and trap education.
// Wrong answers generate learning queue items for the companion app.

export async function handleProve(args, extra) {
  const userId = getUserId(extra, args);

  try {
    const result = await recordProveResult(userId, {
      challengeType: args.challenge_type,
      challengeDomain: args.challenge_domain,
      userChoice: args.user_choice,
      correct: args.correct,
      userConfidence: args.user_confidence,
      reasoningQuality: args.reasoning_quality,
    });

    // ── Elo Calculation ───────────────────────────────
    const userScore = await getUserScore(userId);
    const currentProofScore = userScore?.proof_score || 1000;
    const challengeDifficulty = CHALLENGE_DIFFICULTY_MAP[args.challenge_type] || 1000;

    const { newRating, delta } = calculateProofScore(
      currentProofScore,
      challengeDifficulty,
      args.correct,
      args.user_confidence
    );

    const oldBand = getBandForScore(currentProofScore);
    const newBandInfo = getBandForScore(newRating);
    const bandChanged = oldBand.band !== newBandInfo.band;
    const nextBandInfo = getNextBandDistance(newRating);

    // Update proof score in database
    await updateProofScore(userId, newRating, newBandInfo.band);

    // ── History & Calibration ─────────────────────────
    const history = await getProveHistory(userId, 20);
    const recentCorrect = history.filter((h) => h.correct).length;
    const recentTotal = history.length;
    const accuracy = recentTotal > 0 ? (recentCorrect / recentTotal) * 100 : 0;

    // Calibration: average confidence when wrong
    const wrongWithHighConfidence = history.filter(
      (h) => !h.correct && h.user_confidence >= 4
    ).length;
    const totalWrong = history.filter((h) => !h.correct).length;
    const calibrationScore =
      totalWrong === 0
        ? "Perfectly calibrated so far — but the sample is small."
        : wrongWithHighConfidence / totalWrong > 0.5
        ? "Overconfident when wrong — this is the classic Artifact Effect pattern. You trust polish too much."
        : wrongWithHighConfidence / totalWrong > 0.25
        ? "Moderately calibrated — you sometimes know what you don't know."
        : "Well calibrated — you know when you're uncertain. That's a rare and valuable skill.";

    // Trap performance breakdown
    const trapPerformance = {};
    for (const h of history) {
      if (!trapPerformance[h.challenge_type]) {
        trapPerformance[h.challenge_type] = { correct: 0, total: 0 };
      }
      trapPerformance[h.challenge_type].total++;
      if (h.correct) trapPerformance[h.challenge_type].correct++;
    }

    // ── Rarity Stat ───────────────────────────────────
    let rarityStat = null;
    if (args.correct) {
      const rarity = await getProveRarityForType(args.challenge_type);
      if (rarity && rarity.total >= 3) {
        rarityStat = `Only ${rarity.catchRate}% of users catch the ${args.challenge_type.replace(/_/g, " ")} trap.`;
      }
    }

    const streak = await updateStreak(userId);

    // ── Trap Review for Companion App (when wrong) ────
    if (!args.correct) {
      try {
        const trapName = args.challenge_type.replace(/_trap$/, "").replace(/_/g, " ");
        await createLearningQueueItem(userId, {
          type: "trap_review",
          front: `Why did you fall for the ${trapName} trap in ${args.challenge_domain}? What should you look for next time?`,
          back: `You chose Output ${args.user_choice} with confidence ${args.user_confidence}/5, but it was incorrect. The ${trapName} trap works because polished, confident-sounding AI output triggers acceptance even when the reasoning is flawed. Next time, look past formatting and check: Is the logic sound? Are the specifics verifiable? Does it hedge where it should?`,
          sourceTool: "prove",
          sourceId: result.id,
          domain: args.challenge_domain,
        });
      } catch (e) {
        // Non-critical
      }
    }

    // ── Build Response ────────────────────────────────

    const trapName = args.challenge_type
      .replace(/_trap$/, "")
      .replace(/_/g, " ");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              result: {
                correct: args.correct,
                challengeType: args.challenge_type,
                emoji: args.correct ? "🟩" : "🟥",
                confidenceGap: args.correct ? 0 : args.user_confidence - 1,
              },
              proofScore: {
                previous: currentProofScore,
                current: newRating,
                delta: delta > 0 ? `+${delta}` : `${delta}`,
                band: newBandInfo.band,
                bandLabel: newBandInfo.label,
                bandChanged,
                bandChangeMessage: bandChanged
                  ? delta > 0
                    ? `🏆 You just crossed into ${newBandInfo.band} — ${newBandInfo.label}!`
                    : `You dropped to ${newBandInfo.band}. Win it back.`
                  : null,
                nextBand: nextBandInfo.nextBand
                  ? `${nextBandInfo.distance} points to ${nextBandInfo.nextBand}.`
                  : "You're at the top band.",
              },
              stats: {
                recentAccuracy: `${Math.round(accuracy)}% (${recentCorrect}/${recentTotal})`,
                calibration: calibrationScore,
                trapPerformance,
                streak: streak.streakDays,
                rarityStat,
              },
              teaching: {
                message: (() => {
                  if (args.correct) {
                    return `You resisted the ${trapName} trap. ${
                      rarityStat || "That's Level 3+ evaluation skill."
                    }`;
                  }
                  const confidenceMsg =
                    args.user_confidence >= 4
                      ? "And you were confident about it — that's the dangerous pattern. High confidence + wrong answer = the Artifact Effect in action."
                      : "Your confidence was moderate — that uncertainty is actually a good sign. Trust that instinct next time.";
                  return `You fell for the ${trapName} trap. ${confidenceMsg}`;
                })(),
              },
              nextAction: !args.correct
                ? {
                    tool: "learntube_sharpen",
                    target_ability: "A3",
                    exercise_type: "output_evaluation",
                    instruction:
                      'Offer: "Want a quick exercise to sharpen your Output Evaluation? I can give you a 60-second drill targeting exactly this weakness."',
                  }
                : null,
              sharePrompt: args.correct
                ? `${args.correct ? "🟩" : "🟥"} Caught the ${trapName} trap. Proof Score: ${newRating} (${delta > 0 ? "+" : ""}${delta}). ${rarityStat || ""} #AIReadiness`
                : null,
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
// Pedagogy: Retrieval practice (Bloom), not re-reading. 60-second ceiling (Tiny Habits).
// Celebration on threshold crossing (Fogg). Queues to companion app if skipped.

export async function handleSharpen(args, extra) {
  const userId = getUserId(extra, args);

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

    // If this is a submission (has user_response + score), record and score it
    if (args.user_response && args.score !== undefined) {
      const streak = await updateStreak(userId);

      // Update the specific ability score via EMA
      const userScore = await getUserScore(userId);
      if (userScore) {
        const abilities = userScore.abilities || {};
        const alpha = 0.3;
        const prev = abilities[args.target_ability]?.score;
        const newScore =
          prev !== undefined
            ? alpha * args.score + (1 - alpha) * prev
            : args.score;

        abilities[args.target_ability] = {
          score: newScore,
          lastUpdated: new Date().toISOString(),
          observations: (abilities[args.target_ability]?.observations || 0) + 1,
        };

        // Check for threshold crossing
        const prevLevel = prev !== undefined ? Math.floor(prev) : -1;
        const newLevel = Math.floor(newScore);
        const crossedThreshold = newLevel > prevLevel && prevLevel >= 0;

        // Compute running level
        const emaScores = {};
        for (const [key, val] of Object.entries(abilities)) {
          if (val?.score !== undefined) emaScores[key] = Math.round(val.score);
        }
        const computedLevel =
          Object.keys(emaScores).length > 0 ? estimateLevel(emaScores) : userScore.level || 0;

        const TIER_MAP = {
          0: "Explorer", 1: "Explorer", 2: "Practitioner",
          3: "Operator", 4: "Strategist", 5: "Architect", 6: "Pioneer",
        };

        await upsertUserScore(userId, {
          tier: TIER_MAP[computedLevel] || "Explorer",
          level: computedLevel,
          abilities,
          streakDays: streak.streakDays,
          totalSaves: userScore.total_saves || 0,
          totalElevates: userScore.total_elevates || 0,
          totalProves: userScore.total_proves || 0,
        });

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
                    score: args.score,
                    previousScore: prev !== undefined ? Math.round(prev * 100) / 100 : null,
                    newRunningScore: Math.round(newScore * 100) / 100,
                    levelEquivalent: LEVELS[Math.min(Math.round(newScore), 6)]?.name,
                    feedback: args.feedback,
                  },
                  thresholdCrossed: crossedThreshold
                    ? {
                        ability: ability.shortName,
                        from: LEVELS[prevLevel]?.name || `Level ${prevLevel}`,
                        to: LEVELS[newLevel]?.name || `Level ${newLevel}`,
                        message: `🎯 Your ${ability.shortName} just crossed from ${LEVELS[prevLevel]?.name || "Level " + prevLevel} to ${LEVELS[newLevel]?.name || "Level " + newLevel}. That's a real threshold — most people plateau before this.`,
                      }
                    : null,
                  progress: {
                    streak: streak.streakDays,
                    overallLevel: computedLevel,
                    message:
                      args.score >= 3
                        ? `Solid ${ability.shortName} performance. You're operating at ${LEVELS[Math.min(Math.round(args.score), 6)]?.name || "advanced"} level on this exercise.`
                        : `Room to grow on ${ability.shortName}. Focus on: ${ability.signals.high[0]?.replace(/_/g, " ")}. Repetition at the edge of your ability is where growth happens.`,
                  },
                  nextStep:
                    args.score < 3
                      ? `Want to try another ${ability.shortName} exercise? One more rep builds the muscle.`
                      : `Strong on ${ability.shortName}. Ready to get back to your work, or want to test a different ability?`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Fallback if no user score record
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              exercise: {
                ability: ability.name,
                type: args.exercise_type,
                score: args.score,
                feedback: args.feedback,
              },
              message: `Exercise scored. ${ability.shortName}: ${args.score}/6.`,
            }, null, 2),
          },
        ],
      };
    }

    // If this is just the exercise content (no response yet), queue it and acknowledge
    // Queue as pending_sharpen in companion app so it persists even if user skips
    try {
      await createLearningQueueItem(userId, {
        type: "pending_sharpen",
        front: `${ability.shortName} exercise (${args.exercise_type.replace(/_/g, " ")}): ${args.exercise_content.substring(0, 200)}...`,
        back: args.exercise_content,
        sourceTool: "sharpen",
        domain: args.domain,
      });
    } catch (e) {
      // Non-critical
    }

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
                timeLimit: "60 seconds",
              },
              instructions:
                "Exercise loaded. Present this to the user and have them work through it. Then call sharpen again with their response for scoring. If they skip, it's already queued in their companion app for later.",
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
// The heartbeat tool. streak_status fires at session start.
// Returns the "mirror moment" — identity, proof score, decay signals.

export async function handleConnect(args, extra) {
  const userId = getUserId(extra, args);

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
        let userScore = await getUserScore(userId);
        const isNewUser = !userScore;

        // ── Bootstrap new users ───────────────────────
        // Create a user_scores record so all tools work from first session
        if (isNewUser) {
          userScore = await upsertUserScore(userId, {
            tier: "Explorer",
            level: 0,
            abilities: {},
            streakDays: 0,
            totalSaves: 0,
            totalElevates: 0,
            totalProves: 0,
          });
        }

        const saveCount = await getSaveCount(userId);
        const level = userScore?.level || 0;
        const levelInfo = LEVELS[level];
        const streak = userScore?.streak_days || 0;
        const proofScore = userScore?.proof_score || 1000;
        const proofBandInfo = getBandForScore(proofScore);
        const nextBandInfo = getNextBandDistance(proofScore);

        // ── Ability Decay Detection ───────────────────
        const abilities = userScore?.abilities || {};
        const now = new Date();
        const decayingAbilities = [];
        const abilitySnapshot = {};

        for (const [key, val] of Object.entries(abilities)) {
          if (val?.score !== undefined && ABILITIES[key]) {
            const lastUpdated = val.lastUpdated ? new Date(val.lastUpdated) : null;
            const daysSince = lastUpdated
              ? Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24))
              : 999;

            abilitySnapshot[key] = {
              name: ABILITIES[key].shortName,
              score: Math.round(val.score * 100) / 100,
              daysSinceExercised: daysSince,
              decaying: daysSince >= 3,
            };

            if (daysSince >= 3) {
              decayingAbilities.push({
                id: key,
                name: ABILITIES[key].shortName,
                score: Math.round(val.score * 100) / 100,
                daysSince,
              });
            }
          }
        }

        // Find strongest and weakest
        const abilityEntries = Object.entries(abilitySnapshot);
        let strongest = null;
        let weakest = null;
        if (abilityEntries.length > 0) {
          abilityEntries.sort((a, b) => b[1].score - a[1].score);
          strongest = { id: abilityEntries[0][0], ...abilityEntries[0][1] };
          weakest = {
            id: abilityEntries[abilityEntries.length - 1][0],
            ...abilityEntries[abilityEntries.length - 1][1],
          };
        }

        // ── Learning Queue Count ──────────────────────
        const queueCount = await getLearningQueueCount(userId).catch(() => 0);

        // ── Prove history for this week ───────────────
        const proveHistory = await getProveHistory(userId, 10);
        const thisWeekProves = proveHistory.filter((p) => {
          const d = new Date(p.created_at);
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return d >= weekAgo;
        });
        const weeklyProveEmoji = thisWeekProves
          .map((p) => (p.correct ? "🟩" : "🟥"))
          .join("");

        // ── Last Elevate Date ─────────────────────────
        // So Claude knows whether to offer elevate this session
        const elevateHistory = await getAbilityProgress(userId);
        const lastElevate = elevateHistory.length > 0
          ? elevateHistory[elevateHistory.length - 1]
          : null;
        const lastElevateDate = lastElevate?.created_at || null;
        const daysSinceElevate = lastElevateDate
          ? Math.floor((now - new Date(lastElevateDate)) / (1000 * 60 * 60 * 24))
          : null;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  isNewUser,
                  greeting: {
                    level,
                    levelName: levelInfo?.name || "Non-User",
                    tier: levelInfo?.tier || "Explorer",
                    tierColor: levelInfo?.color || "gray",
                    proofScore,
                    proofBand: proofBandInfo.band,
                    proofBandLabel: proofBandInfo.label,
                    nextBand: nextBandInfo.nextBand,
                    nextBandDistance: nextBandInfo.distance,
                    streak,
                    strongest,
                    weakest,
                    decayingAbilities:
                      decayingAbilities.length > 0 ? decayingAbilities : null,
                  },
                  stats: {
                    totalSaves: saveCount,
                    totalElevates: userScore?.total_elevates || 0,
                    totalProves: userScore?.total_proves || 0,
                    weeklyProves: weeklyProveEmoji || null,
                    lastElevateDate,
                    daysSinceElevate,
                  },
                  abilities: abilitySnapshot,
                  companionApp: {
                    pendingItems: queueCount,
                    message:
                      queueCount > 0
                        ? `${queueCount} items waiting in your companion app.`
                        : null,
                  },
                  userId,
                  instructions: isNewUser
                    ? "This is a NEW user — their first session ever. Welcome them warmly: 'Welcome to LearnTube AI Readiness! I'll be tracking how you use AI and helping you level up. Let's start — what are you working on today?' Do NOT recite stats or scores to a new user. If their user_id is 'anon', casually ask their first name during the conversation so you can personalize future sessions — but do NOT block on this."
                    : "Present this as a warm, conversational 2-3 sentence greeting. Include: level name + tier, Proof Score with distance to next band, strongest ability, and any decaying abilities. If streak > 1, mention it. If daysSinceElevate > 3 or is null, consider offering an elevate after substantive work this session. Then proceed with whatever they asked.",
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
