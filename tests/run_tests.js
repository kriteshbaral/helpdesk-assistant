/*
 * Tests for the helpdesk assistant. Run with:  node tests/run_tests.js
 * No dependencies. Exits with code 1 if any test fails.
 */
const assert = require("assert");
const KB = require("../js/kb.js");
const EXAMPLES = require("../js/training.js");
const NLP = require("../js/nlp.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok    " + name); }
  catch (e) { failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}

console.log("\nData");
test("224 training examples, 28 per category", () => {
  assert.strictEqual(EXAMPLES.length, 224);
  const counts = {};
  EXAMPLES.forEach((e) => (counts[e.category] = (counts[e.category] || 0) + 1));
  for (const n of Object.values(counts)) assert.strictEqual(n, 28);
});
test("every knowledge-base article has steps and an escalation rule", () => {
  for (const d of KB) assert.ok(d.steps.length >= 3 && d.escalate, d.id);
});
test("knowledge-base IDs are unique", () => {
  assert.strictEqual(new Set(KB.map((d) => d.id)).size, KB.length);
});

console.log("\nSearch (the right article ranks first)");
const index = new NLP.SearchIndex(KB, (d) => `${d.title} ${d.keywords} ${d.keywords} ${d.steps.join(" ")}`);
const SEARCH_CASES = [
  ["I forgot my password", "KB001"],
  ["my account is locked out", "KB002"],
  ["got a new phone and the authenticator codes don't work", "KB003"],
  ["wifi keeps disconnecting", "KB005"],
  ["vpn not connecting from home", "KB006"],
  ["outlook emails stuck in outbox", "KB008"],
  ["teams mic not working in meetings", "KB009"],
  ["onedrive sync paused", "KB010"],
  ["printer is offline", "KB011"],
  ["paper jam in the copier", "KB012"],
  ["laptop won't charge", "KB014"],
  ["second monitor no signal on the dock", "KB015"],
  ["excel crashes when I open it", "KB017"],
  ["clicked a dodgy link in an email", "KB018"],
  ["left my laptop on the train, it's lost", "KB019"],
  ["new starter joining next week", "KB020"],
];
for (const [q, id] of SEARCH_CASES) {
  test(`"${q}" -> ${id}`, () => {
    const top = index.search(q, 1)[0];
    assert.ok(top, "no result");
    assert.strictEqual(top.doc.id, id, `got ${top.doc.id} (${top.doc.title})`);
  });
}

console.log("\nPriority (ITIL impact x urgency)");
const PRIORITY_CASES = [
  ["The whole office has no internet and we can't work", "P1 - Critical"],
  ["Server is down for everyone at Katherine", "P1 - Critical"],
  ["Our team's shared drive keeps failing", "P3 - Medium"],
  ["My laptop won't turn on and I have a deadline", "P3 - Medium"],
  ["Could I get a second monitor for my desk", "P4 - Low"],
];
for (const [text, expected] of PRIORITY_CASES) {
  test(`"${text}" -> ${expected}`, () => assert.strictEqual(NLP.assessPriority(text, "Hardware").priority, expected));
}
test("security incidents are never below P3, and urgent ones are P2", () => {
  assert.strictEqual(NLP.assessPriority("I clicked a link and entered my password", "Security").priority, "P2 - High");
  assert.strictEqual(NLP.assessPriority("spam email in my inbox", "Security").priority, "P3 - Medium");
});

console.log("\nClassifier");
const model = NLP.trainModel(EXAMPLES, KB);
test("safety net flags security words the model misses", () => {
  const r = NLP.classify(model, "suspicious login alert from microsoft");
  assert.strictEqual(r.category, "Security");
});
test("confidence is a probability between 0 and 1", () => {
  const r = model.predict("printer offline");
  assert.ok(r.confidence > 0 && r.confidence <= 1);
  const total = r.ranked.reduce((s, x) => s + x.probability, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

const withNet = NLP.evaluate(EXAMPLES, KB, 4, { safetyNet: true });
const modelOnly = NLP.evaluate(EXAMPLES, KB, 4, { safetyNet: false });
test(`cross-validated accuracy stays at or above 75% (model ${(modelOnly.accuracy * 100).toFixed(1)}%, with safety net ${(withNet.accuracy * 100).toFixed(1)}%)`, () => {
  assert.ok(modelOnly.accuracy >= 0.75);
  assert.ok(withNet.accuracy >= modelOnly.accuracy);
});

console.log("\nPer-category results (4-fold cross-validation, with safety net)");
for (const r of withNet.rows) {
  console.log(`  ${r.category.padEnd(20)} precision ${(r.precision * 100).toFixed(0).padStart(3)}%   recall ${(r.recall * 100).toFixed(0).padStart(3)}%`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
