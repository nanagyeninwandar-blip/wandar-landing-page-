/* Wandar Layer 3 - deterministic scorer. Reproduces all 10 docx worked examples.
   sig = {d,t,b,g,u} each one of a(bsent) | v(ague) | s(pecific) | x(very specific) */
export function scoreSig(sig) {
  const arr = [sig.d, sig.t, sig.b, sig.g, sig.u];
  const S = arr.filter(x => x === "s" || x === "x").length;
  const P = arr.filter(x => x !== "a").length;
  const uSpec = sig.u === "s" || sig.u === "x";
  const uPres = sig.u !== "a";
  const nonUrgSpec = [sig.d, sig.t, sig.b, sig.g].filter(x => x === "s" || x === "x").length;
  let floor, ceil;
  if (S === 0) return { score: 0, tier: "Eliminated" };
  if (uSpec && nonUrgSpec >= 4) { floor = 9.0; ceil = 10.0; }
  else if (uSpec && nonUrgSpec >= 3) { floor = 8.5; ceil = 9.0; }
  else if (uPres && nonUrgSpec >= 3) { floor = 8.5; ceil = 9.0; }
  else if (!uPres && nonUrgSpec >= 3) { floor = 8.0; ceil = 8.5; }
  else if (S >= 3) { floor = 8.0; ceil = 8.5; }
  else if (P >= 2 && S >= 1) { floor = 6.0; ceil = 7.5; }
  else { floor = 4.0; ceil = 5.5; }
  const sc = Math.min(floor + 0.5 * S, ceil);
  const tier = sc >= 8.0 ? "High Intent" : (sc >= 6.0 ? "Mid Intent" : "Low Intent");
  return { score: sc, tier };
}

/* --- self-test: the docx's 10 worked examples + 5 edge cases, verbatim --- */
if (process.argv[1] && process.argv[1].endsWith("score.mjs")) {
  const cases = [
    // 10 real-world posts scored end to end (docx §6)
    ["Planning a safari in Tanzania.",                          { d:"s",t:"a",b:"a",g:"a",u:"a" }, 4.5],
    ["Safari July 2027, destination undecided.",                { d:"a",t:"s",b:"a",g:"a",u:"a" }, 4.5],
    ["East Africa, Kenya or Tanzania. Traveling July 2027.",     { d:"s",t:"s",b:"a",g:"a",u:"a" }, 7.0],
    ["Luxury Botswana Sept 2026, two of us, ~$14,000.",          { d:"s",t:"s",b:"s",g:"s",u:"a" }, 8.5],
    ["Family safari somewhere in Africa next year, decent budget.",{ d:"v",t:"v",b:"v",g:"v",u:"a" }, 0 ],
    ["Solo gorilla Uganda Jun 2026, $6k, book in two weeks.",     { d:"s",t:"s",b:"s",g:"s",u:"x" }, 10.0],
    ["Tanzania Jul 2027, $15k, family of four. Which operators?", { d:"s",t:"s",b:"s",g:"s",u:"s" }, 10.0],
    ["Honeymoon Botswana/Zimbabwe, ~$16,000.",                    { d:"s",t:"a",b:"s",g:"s",u:"a" }, 8.5],
    ["Kenya/Tanzania Jul 2027, just me, $8k. Ready to book.",      { d:"s",t:"s",b:"s",g:"s",u:"s" }, 10.0],
    ["N. Tanzania circuit Jul 2027, family of 4, $20k, confirming this week.", { d:"x",t:"s",b:"x",g:"x",u:"x" }, 10.0],
    // 5 edge cases scored end to end (docx §6)
    ["Tanzania Jul 2027, $15k, family of 4. Wife needs convincing.", { d:"s",t:"s",b:"s",g:"s",u:"v" }, 9.0],
    ["Botswana Sep 2026, couple, $14k. Waiting for bonus to clear.", { d:"s",t:"s",b:"s",g:"s",u:"s" }, 10.0],
    ["Tanzania Jul 2027, family of 4, $20k. Operator unresponsive.", { d:"s",t:"s",b:"s",g:"s",u:"x" }, 10.0],
    ["Travel agent handling Tanzania Jul 2027, $15k, family of 4.",  { d:"s",t:"s",b:"s",g:"s",u:"s" }, 10.0],
    ["Booked Botswana Oct 2026, couple, $18k. Want a 2nd quote.",    { d:"s",t:"s",b:"s",g:"s",u:"x" }, 10.0],
  ];
  let ok = 0;
  for (const [label, sig, exp] of cases) {
    const r = scoreSig(sig);
    const pass = r.score === exp;
    if (pass) ok++;
    console.log(pass ? "ok  " : "FAIL", String(r.score).padEnd(4), r.tier.padEnd(11),
                pass ? "" : `(expected ${exp}) `, label.slice(0, 52));
  }
  console.log(`\n${ok}/${cases.length} passed`);
}
