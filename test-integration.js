/**
 * Integration test — exercises each handler against the live Supabase database.
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node test-integration.js
 */

import { handleSave, handleElevate, handleProve, handleSharpen, handleConnect } from "./src/handlers.js";

const TEST_USER = { userId: "integration-test-user" };

async function test(name, fn) {
  try {
    const result = await fn();
    const parsed = JSON.parse(result.content[0].text);
    console.log(`✅ ${name}`);
    return parsed;
  } catch (e) {
    console.error(`❌ ${name}:`, e.message);
    return null;
  }
}

async function run() {
  console.log("--- LearnTube MCP Integration Test ---\n");

  // 1. SAVE
  const save = await test("SAVE — create insight", () =>
    handleSave(
      {
        insight: "Integration test: When evaluating AI output, check reasoning before formatting",
        tags: ["evaluation", "test", "a3"],
        domain: "ai-readiness",
        context: "Integration test run",
        confidence: 4,
      },
      TEST_USER
    )
  );
  if (save) console.log(`   Save ID: ${save.saveId}, Total: ${save.totalSaves}\n`);

  // 2. ELEVATE
  const elevate = await test("ELEVATE — record evaluation", () =>
    handleElevate(
      {
        task_description: "Drafted a positioning statement using AI",
        interaction_summary: "User provided minimal context, accepted first output without evaluation",
        domain: "marketing",
        user_level_estimate: 2,
        ability_scores: { A1: 2, A2: 1, A3: 2, A4: 1, A5: 1 },
        what_they_did_well: "Identified a clear task to delegate to AI",
        what_they_missed: "No audience context provided. Accepted polished output without checking claims.",
        level_up_move: "Before accepting any AI output, ask: is the reasoning sound, or just the formatting?",
      },
      TEST_USER
    )
  );
  if (elevate) console.log(`   Level: ${elevate.evaluation.sessionLevel}, Tier: ${elevate.evaluation.tier}\n`);

  // 3. PROVE
  const prove = await test("PROVE — record challenge result", () =>
    handleProve(
      {
        challenge_domain: "marketing",
        challenge_type: "polish_vs_substance",
        user_choice: "A",
        user_confidence: 4,
        correct: false,
        reasoning_quality: "surface",
      },
      TEST_USER
    )
  );
  if (prove) console.log(`   Correct: ${prove.result.correct}, Calibration: "${prove.stats.calibration}"\n`);

  // 4. SHARPEN — load exercise
  const sharpen = await test("SHARPEN — load exercise", () =>
    handleSharpen(
      {
        target_ability: "A3",
        exercise_type: "output_evaluation",
        exercise_content: "Compare these two AI-generated summaries and explain which is better and why.",
        domain: "general",
      },
      TEST_USER
    )
  );
  if (sharpen) console.log(`   Ability: ${sharpen.exercise.ability}\n`);

  // 5. SHARPEN — submit response
  const sharpenResult = await test("SHARPEN — score response", () =>
    handleSharpen(
      {
        target_ability: "A3",
        exercise_type: "output_evaluation",
        exercise_content: "Compare these two AI-generated summaries.",
        user_response: "Output B is better because it includes caveats and acknowledges uncertainty.",
        score: 3,
        feedback: "Good identification of hedging as a quality signal. Could go deeper on reasoning quality.",
        domain: "general",
      },
      TEST_USER
    )
  );
  if (sharpenResult) console.log(`   Score: ${sharpenResult.exercise.score}, Level: ${sharpenResult.exercise.levelEquivalent}\n`);

  // 6. CONNECT — streak status
  const connect = await test("CONNECT — streak status", () =>
    handleConnect({ query_type: "streak_status" }, TEST_USER)
  );
  if (connect) console.log(`   Streak: ${connect.streak.days}, Tier: ${connect.tier.current}\n`);

  // 7. CONNECT — theme clusters
  const themes = await test("CONNECT — theme clusters", () =>
    handleConnect({ query_type: "theme_clusters" }, TEST_USER)
  );

  // 8. CONNECT — ability progress
  const progress = await test("CONNECT — ability progress", () =>
    handleConnect({ query_type: "ability_progress" }, TEST_USER)
  );
  if (progress) console.log(`   Evaluations tracked: ${progress.totalEvaluations}\n`);

  console.log("\n--- All tests complete ---");
}

run().catch(console.error);
