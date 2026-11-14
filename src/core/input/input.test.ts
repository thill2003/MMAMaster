import { describe, expect, it } from "vitest";

import { type ActionSet, directionModifier, InputInterpreter, StrikeBuffer } from "./input";

const run = (interp: InputInterpreter, frames: ActionSet[]) => frames.map((f) => interp.step(f));

describe("InputInterpreter", () => {
  it("resolves a short press as a tap on release", () => {
    const interp = new InputInterpreter();
    const out = run(interp, [{ PUNCH: true }, { PUNCH: true }, {}]);
    expect(out[0].strikes).toEqual([]);
    expect(out[2].strikes).toEqual([{ limb: "punch", press: "tap", moveX: 0 }]);
  });

  it("resolves a long press as a hold at the threshold, and never also as a tap", () => {
    const interp = new InputInterpreter({ holdTicks: 5, doubleTapTicks: 14, bufferTicks: 6 });
    const frames: ActionSet[] = Array.from({ length: 8 }, () => ({ KICK: true }));
    frames.push({});
    const out = run(interp, frames);
    const all = out.flatMap((f) => f.strikes);
    expect(all).toEqual([{ limb: "kick", press: "hold", moveX: 0 }]);
    expect(out[5].strikes.length).toBe(1);
  });

  it("captures the held direction with the strike", () => {
    const interp = new InputInterpreter();
    const out = run(interp, [{ KICK: true, MOVE_RIGHT: true }, { MOVE_RIGHT: true }]);
    expect(out[1].strikes[0].moveX).toBe(1);
  });

  it("detects a double-tap dash and ignores slow taps", () => {
    const interp = new InputInterpreter();
    const quick = run(interp, [{ MOVE_RIGHT: true }, {}, { MOVE_RIGHT: true }]);
    expect(quick[2].dash).toBe(1);

    interp.reset();
    const slow: ActionSet[] = [{ MOVE_LEFT: true }, ...Array.from({ length: 20 }, () => ({})), { MOVE_LEFT: true }];
    expect(run(interp, slow).some((f) => f.dash !== 0)).toBe(false);
  });

  it("flags guard only on the tick it goes down", () => {
    const interp = new InputInterpreter();
    const out = run(interp, [{ GUARD: true }, { GUARD: true }, {}]);
    expect(out.map((f) => f.guardPressed)).toEqual([true, false, false]);
    expect(out.map((f) => f.guardHeld)).toEqual([true, true, false]);
  });

  it("opposite directions cancel", () => {
    const interp = new InputInterpreter();
    expect(interp.step({ MOVE_LEFT: true, MOVE_RIGHT: true }).moveX).toBe(0);
  });

  it("counts fresh presses for mashing and ignores the reserved buttons", () => {
    const interp = new InputInterpreter();
    const f = interp.step({ PUNCH: true, KNEE: true, SPECIAL_1: true });
    expect(f.mash).toBe(2);
    expect(f.strikes).toEqual([]);
  });
});

describe("StrikeBuffer", () => {
  it("keeps a strike for the buffer window and then drops it", () => {
    const buf = new StrikeBuffer(6);
    buf.push({ limb: "punch", press: "tap", moveX: 0 }, 10);
    expect(buf.peek(16)?.limb).toBe("punch");
    expect(buf.peek(17)).toBeNull();
  });
});

describe("directionModifier", () => {
  it("is relative to facing, and dash wins", () => {
    expect(directionModifier(1, 1, false)).toBe("forward");
    expect(directionModifier(-1, 1, false)).toBe("back");
    expect(directionModifier(0, -1, false)).toBe("neutral");
    expect(directionModifier(-1, 1, true)).toBe("dash");
  });
});
