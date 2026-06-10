// Unified input: keyboard + Gamepad API.
// Every frame, poll() merges both sources into one state object.

const DEADZONE = 0.18;

const keys = new Set();

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

let padIndex = null;

window.addEventListener("gamepadconnected", (e) => {
  padIndex = e.gamepad.index;
});
window.addEventListener("gamepaddisconnected", (e) => {
  if (padIndex === e.gamepad.index) padIndex = null;
});

function axis(v) {
  return Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}

function getPad() {
  // Some browsers never fire gamepadconnected until a button press; scan as fallback.
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  if (padIndex !== null && pads[padIndex]) return pads[padIndex];
  for (const p of pads) {
    if (p && p.connected) {
      padIndex = p.index;
      return p;
    }
  }
  return null;
}

// edge-detection state for "pressed this frame"
let prevStart = false;
let prevRollL = false;
let prevRollR = false;

export const input = {
  x: 0,            // -1 .. 1  (left/right)
  y: 0,            // -1 .. 1  (up/down)
  fire: false,
  boost: false,
  start: false,        // pressed this frame (edge)
  rollLeft: false,     // edge
  rollRight: false,    // edge
  padConnected: false,
  padName: "",
};

export function poll() {
  let x = 0, y = 0;
  let fire = false, boost = false;
  let startHeld = false, rollLHeld = false, rollRHeld = false;

  // --- keyboard ---
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) y += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) y -= 1;
  if (keys.has("Space")) fire = true;
  if (keys.has("ShiftLeft") || keys.has("ShiftRight")) boost = true;
  if (keys.has("Enter")) startHeld = true;
  if (keys.has("KeyQ")) rollLHeld = true;
  if (keys.has("KeyE")) rollRHeld = true;

  // --- gamepad ---
  const pad = getPad();
  input.padConnected = !!pad;
  input.padName = pad ? pad.id : "";

  if (pad) {
    const ax = axis(pad.axes[0] ?? 0);
    const ay = axis(pad.axes[1] ?? 0);
    if (Math.abs(ax) > Math.abs(x)) x = ax;
    // stick up (negative) = climb
    if (Math.abs(ay) > Math.abs(y)) y = -ay;

    const btn = (i) => !!pad.buttons[i]?.pressed;
    const trig = (i) => (pad.buttons[i]?.value ?? 0) > 0.3;

    if (btn(0) || trig(7)) fire = true;            // A / RT
    if (btn(2) || trig(6)) boost = true;           // X / LT
    if (btn(9)) startHeld = true;                  // Start
    if (btn(4)) rollLHeld = true;                  // LB
    if (btn(5)) rollRHeld = true;                  // RB
  }

  input.x = Math.max(-1, Math.min(1, x));
  input.y = Math.max(-1, Math.min(1, y));
  input.fire = fire;
  input.boost = boost;

  input.start = startHeld && !prevStart;
  input.rollLeft = rollLHeld && !prevRollL;
  input.rollRight = rollRHeld && !prevRollR;

  prevStart = startHeld;
  prevRollL = rollLHeld;
  prevRollR = rollRHeld;

  return input;
}
