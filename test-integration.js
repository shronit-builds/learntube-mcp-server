/**
 * Integration test v0.5.0 — exercises all 7 handlers against live Supabase.
 * Tests: save (enhanced), recall (NEW), checkpoint, elevate (enhanced),
 *        prove, sharpen (enhanced with topic learning), connect
 *
 * Run: node test-integration.js
 * (Reads .env for Supabase credentials)
 */

import "dotenv/config";
import {
  handleSave,
  handleRecall,
  handleCheckpoint,
  handleElevate,
  handleProve,
  handleSharpen,
  handleConnect,
} from "./src/handlers.js";

const TEST_USER = { sessionId: "test-session-v050" };
const TS = Date.now(); // unique suffix to avoid collisions

let passed = 0;
let failed = 0;

async function test(name, fn, validate) {
  try {
    const result = await fn();
    if (result.isError) {
      console.error(`  ❌ ${name}: ${result.content[0].text}`);
      failed++;
      return null;
    }
    const parsed = JSON.parse(result.content[0].text);
    if (validate) {
      const issues = validate(parsed);
      if (issues.length > 0) {
        console.error(`  ❌ ${name}: validation failed`);
        issues.forEach((i) => console.error(`     → ${i}`));
        failed++;
        return parsed;
      }
    }
    console.log(`  ✅ ${name}`);
    passed++;
    return parsed;
  } catch (e) {
    console.error(`  ❌ ${name}: ${e.message}`);
    failed++;
    return null;
  }
}

async function run() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  LearnTube v0.5.0 Integration Test Suite     ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ────────────────────────────────────────────────
  console.log("─── 1. CONNECT (streak_status) ───");
  const connect = await test(
    "Load user profile",
    () => handleConnect({ query_type: "streak_status", user_id: "test-eval" }, TEST_USER),
    (r) => {
      const issues = [];
      if (!r.userContext) issues.push("Missing userContext");
      if (r.userContext && typeof r.userContext.isNewUser !== "boolean") issues.push("isNewUser not boolean");
      if (!r.instructions) issues.push("Missing instructions");
      return issues;
    }
  );
  if (connect) {
    console.log(`     userId: ${connect.userContext?.userId}, level: ${connect.userContext?.level}`);
  }

  // ────────────────────────────────────────────────
  console.log("\n─── 2. SAVE (enhanced with derivative processing) ───");
  const save1 = await test(
    "Save insight #1 — technique",
    () =>
      handleSave(
        {
          insight: `When writing cold emails, use the AIDA framework: Attention, Interest, Desire, Action. Each section should be max 2 sentences. Test ${TS}`,
          tags: ["marketing", "email", "copywriting"],
          domain: "marketing",
          context: "Drafting outreach emails for a SaaS product launch",
          confidence: 4,
          user_id: "test-eval",
        },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (!r.saved) issues.push("saved !== true");
      if (!r.principle) issues.push("Missing principle extraction");
      if (!r.principle?.type) issues.push("Missing principle.type");
      if (!r.principle?.distilled) issues.push("Missing principle.distilled");
      if (typeof r.flashCardsGenerated !== "number") issues.push("Missing flashCardsGenerated count");
      if (!r.domainDepth) issues.push("Missing domainDepth");
      if (!r.message) issues.push("Missing response message");
      return issues;
    }
  );
  if (save1) {
    console.log(`     Principle: ${save1.principle?.type} — "${save1.principle?.distilled?.substring(0, 60)}..."`);
    console.log(`     Flash cards: ${save1.flashCardsGenerated}, Connections: ${save1.connections?.length || 0}`);
    console.log(`     Domain: ${save1.domainDepth?.domain} (${save1.domainDepth?.totalInDomain} saves)`);
  }

  const save2 = await test(
    "Save insight #2 — pattern (tests connections)",
    () =>
      handleSave(
        {
          insight: `Subject lines with numbers outperform generic ones by 2x. Use specific data points to grab attention in email marketing. Test ${TS}`,
          tags: ["marketing", "email", "copywriting", "data"],
          domain: "marketing",
          context: "Analyzing email open rates",
          confidence: 5,
          user_id: "test-eval",
        },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (!r.saved) issues.push("saved !== true");
      // Should find connection to save1 (shared email/marketing tags)
      if (r.totalSaves < 2) issues.push("Total saves should be >= 2");
      return issues;
    }
  );
  if (save2) {
    console.log(`     Connections found: ${save2.connections?.length || 0}`);
    if (save2.connections?.[0]) {
      console.log(`     Top connection: "${save2.connections[0].insight?.substring(0, 50)}..."`);
    }
    console.log(`     Gaps: ${save2.knowledgeGaps?.map((g) => g.topic).join(", ") || "none"}`);
  }

  const save3 = await test(
    "Save insight #3 — anti-pattern",
    () =>
      handleSave(
        {
          insight: `Avoid using AI-generated content without editing — readers can spot generic phrasing and it damages trust. Always add your own voice and specific examples. Test ${TS}`,
          tags: ["ai", "writing", "content"],
          domain: "marketing",
          context: "Reviewing AI-drafted blog posts",
          confidence: 5,
          user_id: "test-eval",
        },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (r.principle?.type !== "anti_pattern") issues.push(`Expected anti_pattern, got ${r.principle?.type}`);
      return issues;
    }
  );
  if (save3) {
    console.log(`     Principle type: ${save3.principle?.type} ✓`);
  }

  // ────────────────────────────────────────────────
  console.log("\n─── 3. RECALL (knowledge synthesis) ───");
  const recall = await test(
    "Recall 'email marketing'",
    () =>
      handleRecall(
        { topic: "email marketing", user_id: "test-eval" },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (!r.found) issues.push("No saves found — expected matches");
      if (!r.synthesis) issues.push("Missing synthesis");
      if (r.synthesis && !r.synthesis.insights) issues.push("Missing synthesis.insights");
      if (r.synthesis && r.synthesis.totalSaves < 1) issues.push("Expected at least 1 save");
      if (!r.instructions) issues.push("Missing instructions for Claude");
      return issues;
    }
  );
  if (recall) {
    console.log(`     Found: ${recall.synthesis?.totalSaves} saves`);
    console.log(`     Themes: ${recall.synthesis?.themes?.map((t) => t.tag).join(", ")}`);
    console.log(`     Growth trajectory: ${recall.growthTrajectory ? "yes" : "no"}`);
    console.log(`     Contradictions: ${recall.contradictions?.length || 0}`);
    console.log(`     Study guide items: ${recall.studyGuide?.length || 0}`);
  }

  const recallEmpty = await test(
    "Recall non-existent topic (graceful empty)",
    () =>
      handleRecall(
        { topic: "quantum computing topology", user_id: "test-eval" },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (r.found !== false) issues.push("Expected found=false for non-existent topic");
      if (!r.message) issues.push("Missing helpful message for empty results");
      return issues;
    }
  );
  if (recallEmpty) {
    console.log(`     Empty result handled: "${recallEmpty.message?.substring(0, 60)}..."`);
  }

  // ────────────────────────────────────────────────
  console.log("\n─── 4. CHECKPOINT ───");
  const checkpoint = await test(
    "Mid-session checkpoint with insights + signals",
    () =>
      handleCheckpoint(
        {
          insights: [
            {
              insight: `Email A/B testing should run for at least 1000 opens before declaring a winner. Test ${TS}`,
              tags: ["marketing", "testing"],
              domain: "marketing",
              context: "Discussing email optimization",
            },
          ],
          behavioral_signals: {
            task_type: "content_creation",
            signals: { A1: 3, A2: 4, A3: 2 },
          },
          session_phase: "mid",
          user_id: "test-eval",
        },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (!r.checkpoint) issues.push("checkpoint !== true");
      if (r.insightsSaved < 1) issues.push("Expected at least 1 insight saved");
      if (!r.observationRecorded) issues.push("Behavioral signals not recorded");
      return issues;
    }
  );
  if (checkpoint) {
    console.log(`     Insights saved: ${checkpoint.insightsSaved}, Observation: ${checkpoint.observationRecorded}`);
  }

  // ────────────────────────────────────────────────
  console.log("\n─── 5. ELEVATE (with cross-session patterns) ───");
  const elevate = await test(
    "Evaluate session performance",
    () =>
      handleElevate(
        {
          task_description: "Drafted email campaign copy using AI",
          interaction_summary: "User provided good context about audience and goals. Iterated once on tone. Accepted final output after reviewing key claims.",
          domain: "marketing",
          user_level_estimate: 3,
          ability_scores: { A1: 3, A2: 4, A3: 3, A4: 2, A5: 2 },
          what_they_did_well: "Strong context-setting: specified audience, goal, and tone constraints upfront.",
          what_they_missed: "Didn't verify the statistics AI cited in the email body. Could have asked for source verification.",
          level_up_move: "After any AI output with numbers or claims, ask: 'What are your sources for these stats?'",
          user_id: "test-eval",
        },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (!r.evaluation) issues.push("Missing evaluation");
      if (typeof r.evaluation?.sessionLevel !== "number") issues.push("Missing sessionLevel");
      if (!r.evaluation?.levelUpMove) issues.push("Missing levelUpMove");
      // Cross-session patterns should exist if we have 2+ evaluations
      // (may be null on first eval — that's OK)
      return issues;
    }
  );
  if (elevate) {
    console.log(`     Level: ${elevate.evaluation.sessionLevel}, Tier: ${elevate.evaluation.tier}`);
    console.log(`     Cross-session patterns: ${elevate.crossSessionPatterns ? "yes" : "not enough data yet"}`);
    if (elevate.nextAction) {
      console.log(`     Next action: sharpen ${elevate.nextAction.ability_name}`);
    }
  }

  // ────────────────────────────────────────────────
  console.log("\n─── 6. PROVE (quiz/test) ───");
  const prove = await test(
    "Record prove challenge result",
    () =>
      handleProve(
        {
          challenge_domain: "marketing",
          challenge_type: "polish_vs_substance",
          user_choice: "B",
          user_confidence: 3,
          correct: true,
          reasoning_quality: "partial",
          user_id: "test-eval",
        },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (!r.result) issues.push("Missing result");
      if (r.result?.correct !== true) issues.push("Expected correct=true");
      if (!r.proofScore) issues.push("Missing proofScore");
      if (!r.teaching) issues.push("Missing teaching message");
      return issues;
    }
  );
  if (prove) {
    console.log(`     Correct: ${prove.result.correct}, Score: ${prove.proofScore.current} (${prove.proofScore.delta})`);
    console.log(`     Calibration: "${prove.stats.calibration?.substring(0, 50)}..."`);
  }

  // ────────────────────────────────────────────────
  console.log("\n─── 7. SHARPEN (with topic-based learning) ───");
  const sharpen = await test(
    "Load exercise for ability A3",
    () =>
      handleSharpen(
        {
          target_ability: "A3",
          exercise_type: "output_evaluation",
          exercise_content: "Compare these two AI-generated email subject lines and explain which is better for a B2B SaaS audience.",
          domain: "marketing",
          user_id: "test-eval",
        },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (!r.exercise) issues.push("Missing exercise");
      if (r.exercise?.abilityId !== "A3") issues.push("Wrong ability");
      return issues;
    }
  );
  if (sharpen) {
    console.log(`     Exercise loaded: ${sharpen.exercise.ability} (${sharpen.exercise.type})`);
  }

  const sharpenTopic = await test(
    "Load topic-based exercise ('help me learn copywriting')",
    () =>
      handleSharpen(
        {
          target_ability: "A2",
          exercise_type: "topic_exploration",
          exercise_content: "Write a cold email opening that would make a VP of Engineering stop scrolling.",
          learning_topic: "copywriting",
          domain: "marketing",
          user_id: "test-eval",
        },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (!r.exercise) issues.push("Missing exercise");
      if (!r.exercise?.learningTopic) issues.push("Missing learningTopic in response");
      // topicContext should be populated since we have copywriting-related saves
      return issues;
    }
  );
  if (sharpenTopic) {
    console.log(`     Topic context loaded: ${sharpenTopic.topicContext ? "yes" : "no"}`);
    if (sharpenTopic.topicContext) {
      console.log(`     Existing saves on topic: ${sharpenTopic.topicContext.existingSaves}`);
      console.log(`     Known insights: ${sharpenTopic.topicContext.knownInsights?.length || 0}`);
    }
  }

  const sharpenScore = await test(
    "Score exercise submission",
    () =>
      handleSharpen(
        {
          target_ability: "A3",
          exercise_type: "output_evaluation",
          exercise_content: "Compare two email subject lines.",
          user_response: "Subject B is better — it's specific about the ROI claim. Subject A uses vague superlatives.",
          score: 4,
          feedback: "Strong identification of specificity as a quality signal. Good catch on the vague language.",
          domain: "marketing",
          user_id: "test-eval",
        },
        TEST_USER
      ),
    (r) => {
      const issues = [];
      if (!r.exercise) issues.push("Missing exercise");
      if (r.exercise?.score !== 4) issues.push(`Expected score=4, got ${r.exercise?.score}`);
      if (!r.exercise?.newRunningScore) issues.push("Missing newRunningScore");
      return issues;
    }
  );
  if (sharpenScore) {
    console.log(`     Score: ${sharpenScore.exercise.score}, Running: ${sharpenScore.exercise.newRunningScore}`);
    console.log(`     Threshold crossed: ${sharpenScore.thresholdCrossed ? "YES" : "no"}`);
  }

  // ────────────────────────────────────────────────
  console.log("\n─── 8. CONNECT (other query types) ───");
  await test(
    "Related saves for 'email'",
    () => handleConnect({ query_type: "related_saves", context: "email marketing campaign", user_id: "test-eval" }, TEST_USER),
    (r) => (r.relatedSaves ? [] : ["Missing relatedSaves"])
  );

  await test(
    "Theme clusters",
    () => handleConnect({ query_type: "theme_clusters", user_id: "test-eval" }, TEST_USER),
    (r) => (r.themes !== undefined ? [] : ["Missing themes"])
  );

  await test(
    "Knowledge gaps",
    () => handleConnect({ query_type: "knowledge_gaps", user_id: "test-eval" }, TEST_USER),
    (r) => (r.domainCoverage !== undefined ? [] : ["Missing domainCoverage"])
  );

  // ────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(`║  Results: ${passed} passed, ${failed} failed${" ".repeat(Math.max(0, 24 - String(passed).length - String(failed).length))}║`);
  console.log("╚══════════════════════════════════════════════╝\n");

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
