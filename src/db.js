/**
 * Database operations for LearnTube MCP
 * Supabase tables: saves, edges, user_scores, prove_results, sharpen_results
 */

import { supabase } from "./supabase.js";

// ─── SAVES ───────────────────────────────────────────────

export async function createSave({
  userId,
  insight,
  tags,
  domain,
  context,
  confidence,
}) {
  const { data, error } = await supabase
    .from("saves")
    .insert({
      user_id: userId,
      insight,
      tags,
      domain,
      context: context || null,
      confidence_score: confidence || 3,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  // Update save count for streak/tier tracking
  await incrementSaveCount(userId);

  return data;
}

export async function getSaves(userId, { domain, tags, limit = 20 } = {}) {
  let query = supabase
    .from("saves")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (domain) query = query.eq("domain", domain);
  if (tags && tags.length > 0) query = query.overlaps("tags", tags);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getSaveCount(userId) {
  const { count, error } = await supabase
    .from("saves")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count || 0;
}

export async function searchSaves(userId, searchTerms) {
  // Split search into individual words and search for each.
  // V2 will use embeddings for semantic search.
  const words = searchTerms
    .replace(/[%_\\]/g, "\\$&")
    .replace(/[(),."']/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3) // Skip short words
    .slice(0, 5); // Max 5 search terms

  if (words.length === 0) return [];

  // Build OR conditions: each word matched against insight, context, or tags
  const conditions = words
    .map(
      (w) => `insight.ilike.%${w}%,context.ilike.%${w}%,tags.cs.{${w}}`
    )
    .join(",");

  const { data, error } = await supabase
    .from("saves")
    .select("*")
    .eq("user_id", userId)
    .or(conditions)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  return data;
}

// ─── EDGES (Knowledge Graph Connections) ──────────────────

export async function createEdge(fromSaveId, toSaveId, relationshipType) {
  const { data, error } = await supabase
    .from("edges")
    .insert({
      from_save_id: fromSaveId,
      to_save_id: toSaveId,
      relationship_type: relationshipType,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getConnectedSaves(saveId) {
  const { data, error } = await supabase
    .from("edges")
    .select(
      `
      *,
      from_save:saves!edges_from_save_id_fkey(*),
      to_save:saves!edges_to_save_id_fkey(*)
    `
    )
    .or(`from_save_id.eq.${saveId},to_save_id.eq.${saveId}`);

  if (error) throw error;
  return data;
}

// ─── USER SCORES ──────────────────────────────────────────

export async function getUserScore(userId) {
  const { data, error } = await supabase
    .from("user_scores")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return data;
}

export async function upsertUserScore(userId, scoreData) {
  const { data, error } = await supabase
    .from("user_scores")
    .upsert(
      {
        user_id: userId,
        tier: scoreData.tier,
        level: scoreData.level,
        abilities: scoreData.abilities,
        streak_days: scoreData.streakDays || 0,
        last_active: new Date().toISOString(),
        total_saves: scoreData.totalSaves || 0,
        total_elevates: scoreData.totalElevates || 0,
        total_proves: scoreData.totalProves || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function incrementSaveCount(userId) {
  const current = await getUserScore(userId);
  if (current) {
    await supabase
      .from("user_scores")
      .update({
        total_saves: (current.total_saves || 0) + 1,
        last_active: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await upsertUserScore(userId, {
      tier: "Explorer",
      level: 0,
      abilities: {},
      totalSaves: 1,
    });
  }
}

// ─── PROVE RESULTS ────────────────────────────────────────

export async function recordProveResult(userId, result) {
  const { data, error } = await supabase
    .from("prove_results")
    .insert({
      user_id: userId,
      challenge_type: result.challengeType,
      challenge_domain: result.challengeDomain,
      user_choice: result.userChoice,
      correct: result.correct,
      user_confidence: result.userConfidence,
      reasoning_quality: result.reasoningQuality || "no_reasoning",
      calibration_gap: result.correct
        ? 0
        : result.userConfidence - 1, // Higher gap = more overconfident when wrong
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  // Increment total_proves counter on user_scores
  await incrementProveCount(userId);

  return data;
}

async function incrementProveCount(userId) {
  const current = await getUserScore(userId);
  if (current) {
    await supabase
      .from("user_scores")
      .update({
        total_proves: (current.total_proves || 0) + 1,
        last_active: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await upsertUserScore(userId, {
      tier: "Explorer",
      level: 0,
      abilities: {},
      totalProves: 1,
    });
  }
}

export async function getProveHistory(userId, limit = 20) {
  const { data, error } = await supabase
    .from("prove_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ─── ELEVATE RESULTS ──────────────────────────────────────

export async function recordElevateResult(userId, result) {
  const { data, error } = await supabase
    .from("elevate_results")
    .insert({
      user_id: userId,
      task_description: result.taskDescription,
      domain: result.domain,
      level_estimate: result.levelEstimate,
      ability_scores: result.abilityScores,
      what_did_well: result.whatDidWell,
      what_missed: result.whatMissed,
      level_up_move: result.levelUpMove,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  // Update user's running ability scores and level
  await updateAbilityScores(userId, result.abilityScores, result.levelEstimate);

  return data;
}

async function updateAbilityScores(userId, newScores, levelEstimate) {
  const current = await getUserScore(userId);
  if (!current) return;

  const abilities = current.abilities || {};

  // Exponential moving average — recent scores weighted more heavily
  const alpha = 0.3; // How much the new score matters vs. history
  for (const [ability, score] of Object.entries(newScores)) {
    if (score !== null && score !== undefined) {
      const prev = abilities[ability]?.score;
      abilities[ability] = {
        score:
          prev !== undefined ? alpha * score + (1 - alpha) * prev : score,
        lastUpdated: new Date().toISOString(),
        observations: (abilities[ability]?.observations || 0) + 1,
      };
    }
  }

  // Compute running level from EMA ability scores using the framework estimator
  const { estimateLevel } = await import("./framework.js");
  const emaScores = {};
  for (const [key, val] of Object.entries(abilities)) {
    if (val?.score !== undefined) emaScores[key] = Math.round(val.score);
  }
  const computedLevel = Object.keys(emaScores).length > 0
    ? estimateLevel(emaScores)
    : (levelEstimate || 0);

  // Map level to tier
  const TIER_MAP = {
    0: "Explorer", 1: "Explorer",
    2: "Practitioner",
    3: "Operator",
    4: "Strategist",
    5: "Architect",
    6: "Pioneer",
  };

  await supabase
    .from("user_scores")
    .update({
      abilities,
      level: computedLevel,
      tier: TIER_MAP[computedLevel] || "Explorer",
      total_elevates: (current.total_elevates || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

// ─── STREAK TRACKING ──────────────────────────────────────

export async function updateStreak(userId) {
  const current = await getUserScore(userId);
  if (!current) return { streakDays: 1 };

  const lastActive = current.last_active
    ? new Date(current.last_active)
    : null;
  const now = new Date();
  const daysSinceActive = lastActive
    ? Math.floor((now - lastActive) / (1000 * 60 * 60 * 24))
    : 999;

  let newStreak;
  if (daysSinceActive <= 1) {
    newStreak = (current.streak_days || 0) + (daysSinceActive === 1 ? 1 : 0);
  } else {
    newStreak = 1; // Streak broken
  }

  await supabase
    .from("user_scores")
    .update({
      streak_days: newStreak,
      last_active: now.toISOString(),
    })
    .eq("user_id", userId);

  return { streakDays: newStreak, previousStreak: current.streak_days || 0 };
}

// ─── ANALYTICS QUERIES ────────────────────────────────────

export async function getAbilityProgress(userId) {
  const { data, error } = await supabase
    .from("elevate_results")
    .select("ability_scores, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getThemeClusters(userId) {
  const saves = await getSaves(userId, { limit: 100 });

  // Group by tags
  const tagCounts = {};
  const tagSaves = {};
  for (const save of saves) {
    for (const tag of save.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      if (!tagSaves[tag]) tagSaves[tag] = [];
      tagSaves[tag].push(save.id);
    }
  }

  // Return clusters sorted by frequency
  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count, saveIds: tagSaves[tag] }))
    .sort((a, b) => b.count - a.count);
}
