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

// ---------------------------------------------------------------- touch

export const isTouchDevice =
  (typeof window !== "undefined" && "ontouchstart" in window) ||
  (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);

const touch = {
  x: 0, y: 0,
  fire: false, boost: false,
  tapRoll: false, tapTransform: false,
};

export function initTouch() {
  const zone = document.getElementById("stick-zone");
  const base = document.getElementById("stick-base");
  const nub = document.getElementById("stick-nub");
  if (!zone) return;

  const STICK_RADIUS = 56; // px of travel for full deflection
  let stickId = null;
  let originX = 0, originY = 0;

  const setStick = (clientX, clientY) => {
    let dx = clientX - originX;
    let dy = clientY - originY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    touch.x = dx / STICK_RADIUS;
    touch.y = -dy / STICK_RADIUS; // screen-down = dive
    nub.style.transform = `translate(${originX + dx}px, ${originY + dy}px)`;
  };

  zone.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (stickId !== null) return;
    const t = e.changedTouches[0];
    stickId = t.identifier;
    originX = t.clientX;
    originY = t.clientY;
    base.classList.remove("hidden");
    nub.classList.remove("hidden");
    base.style.transform = `translate(${originX}px, ${originY}px)`;
    setStick(t.clientX, t.clientY);
  }, { passive: false });

  zone.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) setStick(t.clientX, t.clientY);
    }
  }, { passive: false });

  const endStick = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickId = null;
        touch.x = 0;
        touch.y = 0;
        base.classList.add("hidden");
        nub.classList.add("hidden");
      }
    }
  };
  zone.addEventListener("touchend", endStick);
  zone.addEventListener("touchcancel", endStick);

  // hold buttons (fire/boost) + tap buttons (roll/gerwalk)
  const hold = (id, prop) => {
    const el = document.getElementById(id);
    el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      touch[prop] = true;
      el.classList.add("pressed");
    }, { passive: false });
    for (const ev of ["touchend", "touchcancel"]) {
      el.addEventListener(ev, () => {
        touch[prop] = false;
        el.classList.remove("pressed");
      });
    }
  };
  const tapBtn = (id, prop) => {
    const el = document.getElementById(id);
    el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      touch[prop] = true;
      el.classList.add("pressed");
    }, { passive: false });
    for (const ev of ["touchend", "touchcancel"]) {
      el.addEventListener(ev, () => el.classList.remove("pressed"));
    }
  };
  hold("tb-fire", "fire");
  hold("tb-boost", "boost");
  tapBtn("tb-roll", "tapRoll");
  tapBtn("tb-gw", "tapTransform");
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
let prevFire = false;
let prevLeft = false;
let prevRight = false;
let prevTransform = false;

export const input = {
  x: 0,            // -1 .. 1  (left/right)
  y: 0,            // -1 .. 1  (up/down)
  fire: false,
  boost: false,
  start: false,        // pressed this frame (edge)
  firePressed: false,  // edge — for menu confirm
  menuLeft: false,     // edge — for menu navigation
  menuRight: false,    // edge
  rollLeft: false,     // edge
  rollRight: false,    // edge
  transform: false,    // edge — gerwalk toggle
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
  let transformHeld = keys.has("KeyF");

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
    if (btn(3)) transformHeld = true;              // Y
  }

  // --- touch ---
  if (Math.abs(touch.x) > Math.abs(x)) x = touch.x;
  if (Math.abs(touch.y) > Math.abs(y)) y = touch.y;
  if (touch.fire) fire = true;
  if (touch.boost) boost = true;

  input.x = Math.max(-1, Math.min(1, x));
  input.y = Math.max(-1, Math.min(1, y));
  input.fire = fire;
  input.boost = boost;

  input.start = startHeld && !prevStart;
  input.firePressed = fire && !prevFire;
  input.rollLeft = rollLHeld && !prevRollL;
  input.rollRight = (rollRHeld && !prevRollR) || touch.tapRoll;
  input.transform = (transformHeld && !prevTransform) || touch.tapTransform;
  touch.tapRoll = false;
  touch.tapTransform = false;

  // menu navigation edges from the analog/keyboard x axis (incl. dpad)
  const pad2 = getPad();
  let mx = input.x;
  if (pad2) {
    if (pad2.buttons[14]?.pressed) mx = -1; // dpad left
    if (pad2.buttons[15]?.pressed) mx = 1;  // dpad right
  }
  const leftHeld = mx < -0.5;
  const rightHeld = mx > 0.5;
  input.menuLeft = leftHeld && !prevLeft;
  input.menuRight = rightHeld && !prevRight;

  prevStart = startHeld;
  prevFire = fire;
  prevRollL = rollLHeld;
  prevRollR = rollRHeld;
  prevTransform = transformHeld;
  prevLeft = leftHeld;
  prevRight = rightHeld;

  return input;
}
