/**
 * Full user journey simulation — as if a real person installed the MCP and used it across a session.
 *
 * Scenario: Priya, a product manager at a SaaS startup, installs the MCP and uses Claude
 * to draft a feature spec. We simulate the full loop: save → elevate → prove → sharpen → connect.
 */

import { handleSave, handleElevate, handleProve, handleSharpen, handleConnect } from "./src/handlers.js";

const USER = { userId: "priya-pm-demo" };

function printSection(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}\n`);
}

function printOutput(label, result) {
  if (result.isError) {
    console.log(`❌ ${label}: ${result.content[0].text}`);
    return null;
  }
  const parsed = JSON.parse(result.content[0].text);
  console.log(`${label}:`);
  console.log(JSON.stringify(parsed, null, 2));
  return parsed;
}

async function run() {

  // ═══════════════════════════════════════════════════════════
  // SCENE 1: Priya is drafting a feature spec with Claude.
  // During the conversation, she lands on a useful insight.
  // Claude suggests saving it.
  // ═══════════════════════════════════════════════════════════

  printSection("SCENE 1: First Save — Priya discovers an insight while drafting a spec");

  const save1 = printOutput("Save 1", await handleSave({
    insight: "When writing a feature spec, define non-goals before goals — it forces you to scope tightly and prevents the spec from bloating with nice-to-haves",
    tags: ["product-management", "specs", "scoping", "prioritization"],
    domain: "product-management",
    context: "Discovered while drafting a data export feature spec — started with goals and kept adding scope until Claude pushed back",
    confidence: 4,
  }, USER));

  console.log("\n--- USER SEES ---");
  console.log(`Message: ${save1?.message}`);
  console.log(`Total saves: ${save1?.totalSaves}`);
  console.log(`Graph stage: ${save1?.graphStage}`);

  // Second save from the same session
  const save2 = printOutput("\nSave 2", await handleSave({
    insight: "Success metrics should include a failure metric — what would make us KILL this feature after launch? Forces honest evaluation instead of only measuring upside",
    tags: ["product-management", "metrics", "evaluation", "decision-making"],
    domain: "product-management",
    context: "Claude challenged me on my success metrics being all positive — no kill criteria",
    confidence: 3,
  }, USER));

  console.log("\n--- USER SEES ---");
  console.log(`Message: ${save2?.message}`);
  console.log(`Related insights: ${save2?.relatedInsights || "none yet"}`);

  // ═══════════════════════════════════════════════════════════
  // SCENE 2: Priya finishes the spec. Claude suggests elevate.
  // "Want me to evaluate how we worked together on this?"
  // ═══════════════════════════════════════════════════════════

  printSection("SCENE 2: Elevate — Claude evaluates how Priya used AI for the spec");

  const elevate = printOutput("Elevate", await handleElevate({
    task_description: "Draft a product spec for a user data export feature, including goals, non-goals, user stories, and success metrics",
    interaction_summary: "Priya started with a one-line ask ('write a spec for data export'). After Claude's first draft, she iterated on scope but mostly on formatting — 'make the user stories shorter', 'add a table for the timeline'. She didn't challenge the technical approach or push back on any of Claude's assumptions about the export format. When Claude suggested non-goals, she accepted them without evaluation. She did ask Claude to stress-test the success metrics, which showed thinking-partner use.",
    domain: "product-management",
    user_level_estimate: 2,
    ability_scores: { A1: 3, A2: 1, A3: 2, A4: 1, A5: 3 },
    what_they_did_well: "Good delegation — a feature spec IS a strong AI task. Also used Claude as a thinking partner when asking to stress-test success metrics. That's A5 behavior.",
    what_they_missed: "1) Started with zero context — 'write a spec for data export' gives Claude nothing about your users, constraints, or what 'good' looks like. A Level 4 PM would have said: 'Our enterprise customers need GDPR-compliant data export. We have 2 engineers for 4 weeks. Export must work with our existing S3 pipeline.' 2) Iterated on FORMAT not SUBSTANCE — asking to shorten user stories instead of challenging whether the right stories were included. 3) Accepted Claude's technical approach (CSV export) without asking 'what are the alternatives and tradeoffs?'",
    level_up_move: "Before your next AI session, spend 60 seconds writing down: WHO is this for, WHAT are the constraints, and WHAT DOES GOOD LOOK LIKE. That context changes everything Claude produces.",
  }, USER));

  console.log("\n--- USER SEES ---");
  console.log(`Level: ${elevate?.evaluation?.sessionLevel} (${elevate?.evaluation?.levelName})`);
  console.log(`Tier: ${elevate?.evaluation?.tier} (${elevate?.evaluation?.tierColor})`);
  console.log(`What you did well: ${elevate?.evaluation?.whatYouDidWell}`);
  console.log(`What you missed: ${elevate?.evaluation?.whatYouMissed?.substring(0, 200)}...`);
  console.log(`Level-up move: ${elevate?.evaluation?.levelUpMove}`);
  console.log(`Critical transition: ${elevate?.evaluation?.criticalTransition?.substring(0, 150)}...`);
  console.log(`Credential: ${elevate?.credential?.shareUrl}`);

  // Check ability radar
  console.log("\nAbility Radar:");
  if (elevate?.evaluation?.abilityRadar) {
    for (const [ability, data] of Object.entries(elevate.evaluation.abilityRadar)) {
      console.log(`  ${ability}: ${data.score}/6 (${data.level})`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SCENE 3: Priya is intrigued by her Level 2 score.
  // Claude offers a Spot the Flaw challenge.
  // She picks the polished-but-wrong output (falls for the trap).
  // ═══════════════════════════════════════════════════════════

  printSection("SCENE 3: Prove — Priya takes a Spot the Flaw challenge and falls for the trap");

  const prove1 = printOutput("Prove (wrong + confident)", await handleProve({
    challenge_domain: "product-management",
    challenge_type: "polish_vs_substance",
    user_choice: "A",
    user_confidence: 4,
    correct: false,
    reasoning_quality: "surface",
  }, USER));

  console.log("\n--- USER SEES ---");
  console.log(`Correct: ${prove1?.result?.correct}`);
  console.log(`Confidence gap: ${prove1?.result?.confidenceGap}`);
  console.log(`Calibration: ${prove1?.stats?.calibration}`);
  console.log(`Impact: ${prove1?.abilityImpact?.message}`);
  console.log(`Share prompt: ${prove1?.sharePrompt || "(none — lost this one)"}`);

  // She tries another challenge and gets it right this time
  const prove2 = printOutput("\nProve (right + uncertain)", await handleProve({
    challenge_domain: "product-management",
    challenge_type: "agreement_trap",
    user_choice: "B",
    user_confidence: 2,
    correct: true,
    reasoning_quality: "partial",
  }, USER));

  console.log("\n--- USER SEES ---");
  console.log(`Correct: ${prove2?.result?.correct}`);
  console.log(`Accuracy: ${prove2?.stats?.recentAccuracy}`);
  console.log(`Impact: ${prove2?.abilityImpact?.message}`);
  console.log(`Share prompt: ${prove2?.sharePrompt?.substring(0, 100)}...`);

  // ═══════════════════════════════════════════════════════════
  // SCENE 4: Prove revealed A3 (Evaluation) is her gap.
  // Claude offers a sharpen exercise.
  // ═══════════════════════════════════════════════════════════

  printSection("SCENE 4: Sharpen — Targeted exercise for A3 (Output Evaluation)");

  // Claude generates and loads an exercise
  const exercise = printOutput("Exercise loaded", await handleSharpen({
    target_ability: "A3",
    exercise_type: "output_evaluation",
    exercise_content: "Two AI outputs for the same brief: 'Write release notes for our new data export feature.' Output A is polished with headers and bullet points but claims the feature supports real-time streaming export (it doesn't — it's batch only). Output B is a plain paragraph but accurately describes batch CSV export with a 24-hour processing window. Which would you publish?",
    domain: "product-management",
  }, USER));

  // Priya responds — she catches it this time!
  const exerciseResult = printOutput("\nExercise scored", await handleSharpen({
    target_ability: "A3",
    exercise_type: "output_evaluation",
    exercise_content: "Two AI outputs for release notes...",
    user_response: "Output B. Output A looks professional but the real-time streaming claim is wrong — our feature is batch-only. Publishing that would create support tickets and erode trust. Output B is less polished but accurate.",
    score: 4,
    feedback: "Strong catch. You identified the factual error AND articulated the business impact (support tickets, trust). That's Level 3+ evaluation — checking substance, not just polish. To push to Level 4: also ask 'what else might be wrong that I'm not catching?'",
    domain: "product-management",
  }, USER));

  console.log("\n--- USER SEES ---");
  console.log(`Score: ${exerciseResult?.exercise?.score}/6 (${exerciseResult?.exercise?.levelEquivalent})`);
  console.log(`Feedback: ${exerciseResult?.exercise?.feedback}`);
  console.log(`Progress: ${exerciseResult?.progress?.message}`);
  console.log(`Next step: ${exerciseResult?.nextStep}`);

  // ═══════════════════════════════════════════════════════════
  // SCENE 5: End of session — Priya checks her progress.
  // ═══════════════════════════════════════════════════════════

  printSection("SCENE 5: Connect — Session wrap-up, check progress");

  const streak = printOutput("Streak status", await handleConnect({
    query_type: "streak_status",
  }, USER));

  console.log("\n--- USER SEES ---");
  console.log(`Streak: ${streak?.streak?.message}`);
  console.log(`Tier: ${streak?.tier?.current} (${streak?.tier?.levelName}, ${streak?.tier?.color})`);
  console.log(`Stats: ${streak?.stats?.totalSaves} saves, ${streak?.stats?.totalElevates} elevates, ${streak?.stats?.totalProves} proves`);
  console.log(`Credential: ${streak?.credential?.shareUrl}`);

  const themes = printOutput("\nTheme clusters", await handleConnect({
    query_type: "theme_clusters",
  }, USER));

  console.log("\n--- USER SEES ---");
  console.log(`Themes: ${themes?.message}`);

  const progress = printOutput("\nAbility progress", await handleConnect({
    query_type: "ability_progress",
  }, USER));

  console.log("\n--- USER SEES ---");
  console.log(`Evaluations: ${progress?.totalEvaluations}`);
  console.log(`Message: ${progress?.message}`);

  // Related saves — check if current context finds past saves
  const related = printOutput("\nRelated saves", await handleConnect({
    query_type: "related_saves",
    context: "product spec writing feature prioritization",
  }, USER));

  console.log("\n--- USER SEES ---");
  console.log(`Found: ${related?.relatedSaves?.length} related saves`);
  if (related?.relatedSaves?.length > 0) {
    console.log(`First: "${related.relatedSaves[0].insight.substring(0, 80)}..."`);
  }
  console.log(`Message: ${related?.message}`);

  // ═══════════════════════════════════════════════════════════
  // QC CHECKS
  // ═══════════════════════════════════════════════════════════

  printSection("QC CHECKLIST");

  const checks = [
    ["Save returns saveId", !!save1?.saveId],
    ["Save count increments", save2?.totalSaves === 2],
    ["Graph stage shows correctly", save1?.graphStage?.includes("Stage 1")],
    ["Elevate returns level estimate", elevate?.evaluation?.sessionLevel === 2],
    ["Elevate returns correct tier", elevate?.evaluation?.tier === "Practitioner"],
    ["Elevate ability radar has entries", Object.keys(elevate?.evaluation?.abilityRadar || {}).length > 0],
    ["Elevate shows critical transition message", !!elevate?.evaluation?.criticalTransition],
    ["Elevate credential URL present", !!elevate?.credential?.shareUrl],
    ["Prove tracks correct/incorrect", prove1?.result?.correct === false && prove2?.result?.correct === true],
    ["Prove calibration message works", !!prove1?.stats?.calibration],
    ["Prove accuracy calculates across attempts", prove2?.stats?.recentAccuracy?.includes("50%")],
    ["Prove share prompt only appears on correct answers", !prove1?.sharePrompt && !!prove2?.sharePrompt],
    ["Prove confidence gap calculated", prove1?.result?.confidenceGap === 3],
    ["Sharpen loads exercise correctly", exercise?.exercise?.ability === "AI Output Evaluation"],
    ["Sharpen scores and returns level equivalent", exerciseResult?.exercise?.levelEquivalent === "Strategic Deployer"],
    ["Sharpen next step adapts to score", exerciseResult?.nextStep?.includes("strong")],
    ["Connect streak works", streak?.streak?.days !== undefined],
    ["Connect themes cluster saves", themes?.themes?.length > 0],
    ["Connect ability progress tracks evaluations", progress?.totalEvaluations === 1],
    ["Connect related saves finds by text search", related?.relatedSaves?.length > 0],
  ];

  let passed = 0;
  let failed = 0;
  for (const [name, result] of checks) {
    if (result) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }

  console.log(`\n  RESULT: ${passed}/${passed + failed} checks passed`);
  if (failed > 0) console.log(`  ⚠️  ${failed} checks failed — see above`);

  // Clean up
  printSection("CLEANUP");
  // Leave data for inspection — uncomment below to clean
  console.log("Test data left in place for inspection. User: priya-pm-demo");
}

run().catch(console.error);
