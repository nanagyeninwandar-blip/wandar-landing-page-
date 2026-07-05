/* Layer 3 proof — runs completely offline (no API key, no network).
 *
 *   node --test tools/lead-insight-tests/
 *
 * Part 1: the 10 acceptance tests from the brief, exact score + tier.
 * Part 2: exhaustive sweep of all 4^5 = 1024 possible classifications,
 *         asserting the invariants of the band model.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  score,
  STATES,
  TRIP_SIGNALS,
  ALL_SIGNALS,
  TIERS,
} from "../../resources/free-tool/lead-insight/scoring.js";
import { ACCEPTANCE } from "./fixtures.mjs";

const tierRank = (tier) => TIERS.indexOf(tier);
const isCounting = (s) => s === "specific" || s === "very_specific";

function makeSignals(states) {
  const signals = {};
  ALL_SIGNALS.forEach((key, i) => {
    signals[key] = { state: states[i] };
  });
  return signals;
}

function* allCombinations() {
  for (const a of STATES)
    for (const b of STATES)
      for (const c of STATES)
        for (const d of STATES)
          for (const e of STATES) yield [a, b, c, d, e];
}

// ---------------------------------------------------------------- Part 1

test("acceptance: all 10 brief fixtures reproduce exactly", () => {
  for (const fx of ACCEPTANCE) {
    const result = score(fx.signals);
    assert.equal(result.score, fx.score, `${fx.name}: score`);
    assert.equal(result.tier, fx.tier, `${fx.name}: tier`);
  }
});

// ---------------------------------------------------------------- Part 2

test("sweep: total, deterministic, valid shape for all 1024 inputs", () => {
  let count = 0;
  for (const states of allCombinations()) {
    const signals = makeSignals(states);
    const r1 = score(signals);
    const r2 = score(signals);
    assert.deepEqual(r1, r2, `determinism at ${states}`);
    assert.ok(TIERS.includes(r1.tier), `valid tier at ${states}`);
    assert.equal(typeof r1.score, "number", `numeric score at ${states}`);
    count++;
  }
  assert.equal(count, 1024);
});

test("sweep: 0.5 increments; exact floor+bonus-capped formula; Very Low iff S == 0", () => {
  for (const states of allCombinations()) {
    const r = score(makeSignals(states));
    assert.equal((r.score * 2) % 1, 0, `0.5 increment at ${states}`);

    const T = states.slice(0, 4).filter(isCounting).length;
    const S = T + (isCounting(states[4]) ? 1 : 0);

    if (S === 0) {
      assert.equal(r.tier, "very_low", `S==0 → very_low at ${states}`);
      assert.equal(r.score, 3.0, `very_low fixed 3.0 at ${states}`);
      assert.ok(r.score < 4.0, `below 4.0 at ${states}`);
    } else {
      assert.notEqual(r.tier, "very_low", `S>0 never very_low at ${states}`);
      assert.equal(
        r.score,
        Math.min(r.floor + 0.5 * S, r.ceiling),
        `score == min(floor + 0.5*S, ceiling) at ${states}`
      );
      assert.ok(r.score >= r.floor && r.score <= r.ceiling, `band containment at ${states}`);
    }
  }
});

test("sweep: tier ranges and realized-value pins", () => {
  for (const states of allCombinations()) {
    const r = score(makeSignals(states));
    const T = states.slice(0, 4).filter(isCounting).length;
    const u = states[4];

    switch (r.tier) {
      case "low":
        assert.ok(r.score >= 4.0 && r.score <= 5.5);
        assert.equal(r.score, 4.5, `low is always 4.5 at ${states}`);
        break;
      case "mid":
        assert.ok(r.score >= 6.0 && r.score <= 7.5);
        assert.ok([7.0, 7.5].includes(r.score), `mid ∈ {7.0, 7.5} at ${states}`);
        break;
      case "high":
        assert.ok(r.score >= 8.0 && r.score <= 10.0);
        assert.ok([8.5, 9.0, 10.0].includes(r.score), `high ∈ {8.5, 9.0, 10.0} at ${states}`);
        // exact condition → exact score
        if (T === 4 && isCounting(u)) assert.equal(r.score, 10.0, `T4+uS → 10.0 at ${states}`);
        else if ((T === 4 && u === "vague") || (T === 3 && u !== "absent"))
          assert.equal(r.score, 9.0, `hot row → 9.0 at ${states}`);
        else assert.equal(r.score, 8.5, `warm row → 8.5 at ${states}`);
        break;
    }

    // high ⇔ T >= 3
    assert.equal(r.tier === "high", T >= 3, `high ⇔ T>=3 at ${states}`);
  }
});

test("sweep: per-signal monotonicity — upgrading a signal never lowers score or tier", () => {
  for (const states of allCombinations()) {
    const base = score(makeSignals(states));
    for (let i = 0; i < 5; i++) {
      const level = STATES.indexOf(states[i]);
      if (level === STATES.length - 1) continue;
      const upgraded = [...states];
      upgraded[i] = STATES[level + 1];
      const up = score(makeSignals(upgraded));
      assert.ok(
        up.score >= base.score,
        `score monotone: ${states} → upgrade ${ALL_SIGNALS[i]} (${base.score} → ${up.score})`
      );
      assert.ok(
        tierRank(up.tier) >= tierRank(base.tier),
        `tier monotone: ${states} → upgrade ${ALL_SIGNALS[i]} (${base.tier} → ${up.tier})`
      );
    }
  }
});

test("sweep: urgency dial — with all four trip signals specific, absent/vague/specific → 8.5/9.0/10.0", () => {
  const trip = ["specific", "specific", "specific", "specific"];
  assert.equal(score(makeSignals([...trip, "absent"])).score, 8.5);
  assert.equal(score(makeSignals([...trip, "vague"])).score, 9.0);
  assert.equal(score(makeSignals([...trip, "specific"])).score, 10.0);
  assert.equal(score(makeSignals([...trip, "very_specific"])).score, 10.0);
  for (const u of STATES) {
    assert.equal(score(makeSignals([...trip, u])).tier, "high");
  }
});

test("sweep: specific ≡ very_specific — swapping never changes the output", () => {
  for (const states of allCombinations()) {
    const base = score(makeSignals(states));
    for (let i = 0; i < 5; i++) {
      if (!isCounting(states[i])) continue;
      const swapped = [...states];
      swapped[i] = states[i] === "specific" ? "very_specific" : "specific";
      assert.deepEqual(
        score(makeSignals(swapped)),
        base,
        `specific/very_specific swap changed output at ${states}, signal ${ALL_SIGNALS[i]}`
      );
    }
  }
});

test("sweep: vague inertness — toggling any trip signal vague ↔ absent never changes score or tier", () => {
  for (const states of allCombinations()) {
    const base = score(makeSignals(states));
    for (let i = 0; i < 4; i++) {
      if (isCounting(states[i])) continue;
      const toggled = [...states];
      toggled[i] = states[i] === "vague" ? "absent" : "vague";
      const t = score(makeSignals(toggled));
      assert.equal(t.score, base.score, `vague/absent toggle changed score at ${states}, ${TRIP_SIGNALS[i]}`);
      assert.equal(t.tier, base.tier, `vague/absent toggle changed tier at ${states}, ${TRIP_SIGNALS[i]}`);
    }
  }
});

test("sweep: trip-signal symmetry — output depends only on (T, urgency), not which trip signals", () => {
  const byKey = new Map();
  for (const states of allCombinations()) {
    const T = states.slice(0, 4).filter(isCounting).length;
    const key = `${T}|${isCounting(states[4]) ? "specific" : states[4]}`;
    const r = score(makeSignals(states));
    const packed = `${r.score}|${r.tier}`;
    if (byKey.has(key)) {
      assert.equal(byKey.get(key), packed, `asymmetric output for cell ${key} at ${states}`);
    } else {
      byKey.set(key, packed);
    }
  }
  // 5 T-values × 3 collapsed urgency levels = 15 cells
  assert.equal(byKey.size, 15);
});

test("invalid input throws rather than mis-scoring", () => {
  assert.throws(() => score({}));
  assert.throws(() =>
    score(makeSignals(["specific", "specific", "specific", "specific", "later"]))
  );
});
