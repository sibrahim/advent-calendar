/* -----------------------------------------------------------
   Advent Calendar V7 — Main Engine (Clean Version)
   - Loads background, toys, doors
   - Uses Door class for animation + bounce/fade/auto-close
   - Enforces calendar-gated unlocking (with ALL_DOORS/testDay overrides)
   - Handles clicks, snow, animals, video popup
----------------------------------------------------------- */

let bg;
let doors = [];
let toys = {};
let doorSound;
let lockedSound;
let videoElement = null;
let doorAccessConfig = {
  allDoors: false,
  testDay: null,
};

// Snow + animals
let snowLayers = [];
let tAnim = 0;

function preload() {
  bg = loadImage("assets/advent-image.png?v=" + Date.now());

  // Toys
  toys["star"] = loadImage("assets/toy_star.png");
  toys["bear"] = loadImage("assets/toy_bear.png");
  toys["reindeer"] = loadImage("assets/toy_reindeer.png");

  // Door sound
  doorSound = new Audio("assets/open.mp3?v=" + Date.now());
  lockedSound = new Audio("assets/locked.mp3?v=" + Date.now());
}

function setup() {
  let c = createCanvas(bg.width, bg.height);
  c.parent("canvas-container");

  // Load door metadata (positions, payloads, animations)
  loadJSON("assets/advent_doors.json?v=" + Date.now(), (data) => {
    doorAccessConfig.allDoors = Boolean(data.ALL_DOORS);
    doorAccessConfig.testDay = Number.isInteger(data.testDay)
      ? clampDay(data.testDay)
      : null;

    doors = data.doors.map((cfg) => new Door(cfg, toys, doorSound, lockedSound));
  });

  initSnow();
}

function draw() {
  if (!bg) return;

  // Draw background first
  background(bg);

  tAnim += 0.02;

  // Overlays
  drawSnow();
  drawAnimals();

  // Doors (drawn last, on top)
  for (let d of doors) {
    d.update();
    d.draw();
  }
}

/* -----------------------------------------------------------
   Mouse Interaction
----------------------------------------------------------- */

function mousePressed() {
  const currentDay = resolveCurrentDay();
  for (let d of doors) {
    if (d.state === "closed" && d.isHit(mouseX, mouseY)) {
      if (!d.canOpen(currentDay)) {
        d.triggerLocked();
        break;
      }

      const videoSrc = d.open();
      if (videoSrc) playVideo(videoSrc, d);
      break; // one door at a time
    }
  }
}

/* -----------------------------------------------------------
   MP4 VIDEO POPUP
----------------------------------------------------------- */

function playVideo(src, doorInstance) {
  if (videoElement) {
    videoElement.remove();
    videoElement = null;
  }

  const container = document.getElementById("canvas-container");
  videoElement = document.createElement("video");
  videoElement.src = src;
  videoElement.autoplay = true;
  videoElement.controls = true;
  videoElement.className = "video-overlay";
  container.appendChild(videoElement);

  videoElement.onended = () => {
    if (videoElement) {
      videoElement.remove();
      videoElement = null;
    }
    if (doorInstance && typeof doorInstance.handleVideoFinished === "function") {
      doorInstance.handleVideoFinished();
    }
  };
}

function resolveCurrentDay() {
  if (doorAccessConfig.allDoors) return 31;
  if (Number.isInteger(doorAccessConfig.testDay)) {
    return clampDay(doorAccessConfig.testDay);
  }
  return new Date().getDate();
}

function clampDay(day) {
  return Math.max(1, Math.min(day, 31));
}

/* -----------------------------------------------------------
   SNOW EFFECT
----------------------------------------------------------- */

function initSnow() {
  for (let layer = 0; layer < 3; layer++) {
    let particles = [];
    for (let i = 0; i < 200; i++) {
      particles.push({
        x: random(width),
        y: random(height),
        speed: random(0.4, 1.2) * (layer + 1),
        size: random(2, 6 + layer),
      });
    }
    snowLayers.push(particles);
  }
}

function drawSnow() {
  noStroke();
  for (let layer of snowLayers) {
    for (let s of layer) {
      fill(255, 255, 255, 180);
      ellipse(s.x, s.y, s.size);
      s.y += s.speed;
      if (s.y > height) {
        s.y = 0;
        s.x = random(width);
      }
    }
  }
}

/* -----------------------------------------------------------
   ANIMAL MICRO-ANIMATIONS (simple visible markers)
   These are purely for showing motion; you can tune/remove.
----------------------------------------------------------- */

function drawAnimals() {
  noStroke();

  // Penguin bob (small glowing dot where penguin is)
  push();
  let py = height * 0.32 + Math.sin(tAnim) * 4;
  fill(255, 255, 255, 160);
  ellipse(width * 0.18, py, 18, 18);
  pop();

  // Bunny blink (short line blink)
  push();
  const blink = Math.abs(Math.sin(tAnim * 3)) < 0.12;
  if (blink) {
    stroke(0);
    strokeWeight(2);
    line(width * 0.5 - 10, height * 0.55, width * 0.5 + 10, height * 
0.55);
  }
  pop();

  // Fox tail swish (little orange rectangle swaying)
  push();
  translate(width * 0.75, height * 0.45);
  rotate(Math.sin(tAnim * 2) * 0.25);
  fill(255, 140, 0, 160);
  rect(-4, -20, 8, 40, 4);
  pop();

  // Hedgehog wiggle (small brown blob)
  push();
  let hy = height * 0.8 + Math.sin(tAnim * 2.5) * 3;
  fill(139, 69, 19, 170);
  ellipse(width * 0.82, hy, 22, 16);
  pop();
}

