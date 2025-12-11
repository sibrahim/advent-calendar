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
let videoOverlayWrapper = null;
let doorConfig = null;
let doorAccessConfig = {
  allDoors: false,
  testDay: null,
};

// Snow + animals
let snowLayers = [];
let tAnim = 0;
let canvasEl = null;
let canvasScale = 1;
const ENABLE_MICRO_ANIM = false;

function preload() {
  const cacheBust = Date.now();

  // Load door config up front so we can auto-load any toy images it references.
  doorConfig = loadJSON("assets/advent_doors.json?v=" + cacheBust);

  bg = loadImage("assets/advent-image.png?v=" + cacheBust);

  // Auto-load all non-video payloads referenced by the config.
  const imagePayloads = collectImagePayloads(doorConfig);
  imagePayloads.forEach((payload) => {
    const assetPath = resolveToyImagePath(payload);
    if (assetPath) {
      toys[payload] = loadImage(assetPath);
    }
  });

  // Door sound
  doorSound = new Audio("assets/open.mp3?v=" + cacheBust);
  lockedSound = new Audio("assets/locked.mp3?v=" + cacheBust);
}

function setup() {
  let c = createCanvas(bg.width, bg.height);
  canvasEl = c;
  c.parent("canvas-container");
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  resizeToViewport();

  // Use config from preload; if it failed for any reason, fall back to a fetch.
  if (doorConfig) {
    ensureToysLoadedFromConfig(doorConfig);
    hydrateDoorsFromConfig(doorConfig);
  } else {
    loadJSON("assets/advent_doors.json?v=" + Date.now(), (data) => {
      doorConfig = data;
      ensureToysLoadedFromConfig(data);
      hydrateDoorsFromConfig(data);
    });
  }

  initSnow();
}

function draw() {
  if (!bg) return;

  // Draw scaled background first
  clear();
  image(bg, 0, 0, width, height);

  tAnim += 0.02;

  // Overlays
  drawSnow();
  if (ENABLE_MICRO_ANIM) {
    drawAnimals();
  }

  // Doors (drawn last, on top)
  for (let d of doors) {
    d.update();
    d.draw();
  }
}

function windowResized() {
  resizeToViewport();
}

function resizeToViewport() {
  if (!bg) return;
  const scale = Math.min(windowWidth / bg.width, windowHeight / bg.height);
  canvasScale = scale;
  const newW = Math.max(1, Math.round(bg.width * scale));
  const newH = Math.max(1, Math.round(bg.height * scale));
  resizeCanvas(newW, newH);
  if (canvasEl && canvasEl.elt) {
    canvasEl.elt.style.setProperty("width", `${newW}px`, "important");
    canvasEl.elt.style.setProperty("height", `${newH}px`);
  }
  rebuildSnowLayers();
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
  teardownVideoOverlay();

  const container = document.getElementById("canvas-container");
  videoOverlayWrapper = document.createElement("div");
  videoOverlayWrapper.className = "video-overlay-wrapper";

  const closeBtn = document.createElement("button");
  closeBtn.className = "video-close-btn";
  closeBtn.setAttribute("aria-label", "Close video");
  closeBtn.textContent = "×";

  const loading = document.createElement("div");
  loading.className = "video-loading";
  loading.textContent = "Loading…";

  videoElement = document.createElement("video");
  videoElement.src = src;
  videoElement.autoplay = true;
  videoElement.muted = true; // allow autoplay on most browsers
  videoElement.controls = true;
  videoElement.playsInline = true;
  videoElement.className = "video-overlay";
  videoElement.style.width = "auto";
  videoElement.style.height = "auto";
  videoElement.style.maxWidth = "95vw";
  videoElement.style.maxHeight = "95vh";
  videoElement.style.objectFit = "contain";
  videoElement.style.opacity = "0";

  let cleaned = false;
  const cleanUp = () => {
    if (cleaned) return;
    cleaned = true;
    teardownVideoOverlay();
    if (doorInstance && typeof doorInstance.handleVideoFinished === "function") {
      doorInstance.handleVideoFinished();
    }
  };

  closeBtn.onclick = cleanUp;

  videoElement.onended = cleanUp;
  videoElement.onerror = () => {
    loading.textContent = "Unable to load video.";
  };

  const revealVideo = () => {
    loading.remove();
    videoElement.style.opacity = "1";
  };

  videoElement.addEventListener("loadeddata", revealVideo, { once: true });
  videoElement.addEventListener("canplay", revealVideo, { once: true });

  videoOverlayWrapper.appendChild(closeBtn);
  videoOverlayWrapper.appendChild(videoElement);
  videoOverlayWrapper.appendChild(loading);
  container.appendChild(videoOverlayWrapper);

  const playPromise = videoElement.play();
  if (playPromise && typeof playPromise.then === "function") {
    playPromise
      .then(() => {
        // Unmute after autoplay begins.
        videoElement.muted = false;
        videoElement.volume = 1;
        if (videoElement.paused) {
          videoElement.play().catch(() => {
            videoElement.controls = true;
          });
        }
      })
      .catch(() => {
        // Autoplay blocked; unmute and rely on user interaction
        videoElement.muted = false;
        videoElement.controls = true;
      });
  }
}

function teardownVideoOverlay() {
  if (videoOverlayWrapper) {
    videoOverlayWrapper.remove();
    videoOverlayWrapper = null;
  }
  if (videoElement) {
    videoElement.pause();
    videoElement = null;
  }
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

function hydrateDoorsFromConfig(data) {
  if (!data || !Array.isArray(data.doors)) {
    console.error("Door config missing or malformed.");
    return;
  }

  doorAccessConfig.allDoors = Boolean(data.ALL_DOORS);
  doorAccessConfig.testDay = Number.isInteger(data.testDay)
    ? clampDay(data.testDay)
    : null;

  doors = data.doors.map((cfg) => new Door(cfg, toys, doorSound, lockedSound));
}

function collectImagePayloads(config) {
  if (!config || !Array.isArray(config.doors)) return [];
  const unique = new Set();
  for (const door of config.doors) {
    const payload = door?.payload;
    if (typeof payload !== "string") continue;
    if (isVideoPayloadString(payload)) continue;
    unique.add(payload);
  }
  return Array.from(unique);
}

function ensureToysLoadedFromConfig(config) {
  const payloads = collectImagePayloads(config);
  payloads.forEach((payload) => {
    if (toys[payload]) return;
    const assetPath = resolveToyImagePath(payload);
    if (assetPath) {
      toys[payload] = loadImage(assetPath);
    }
  });
}

function resolveToyImagePath(payload) {
  if (!payload || isVideoPayloadString(payload)) return null;
  if (payload.startsWith("assets/") || payload.startsWith("./assets/")) {
    return payload;
  }
  // Default convention keeps existing short names working (e.g. "star" -> assets/toy_star.png).
  return `assets/toy_${payload}.png`;
}

function isVideoPayloadString(payload) {
  return typeof payload === "string" && payload.startsWith("mp4:");
}

/* -----------------------------------------------------------
   SNOW EFFECT
----------------------------------------------------------- */

function initSnow() {
  rebuildSnowLayers();
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

function rebuildSnowLayers() {
  snowLayers = [];
  const baseCount = 200;
  const scale = canvasScale || 1;
  const count = Math.max(50, Math.round(baseCount * 4 * scale * scale));
  const speedScale = 0.5 * scale; // slower by 50% and scaled with canvas
  const sizeScale = Math.max(0.6, scale); // avoid vanishing on small canvases

  for (let layer = 0; layer < 3; layer++) {
    let particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: random(width),
        y: random(height),
        speed: random(0.4, 1.2) * (layer + 1) * speedScale,
        size: random(2, 6 + layer) * sizeScale,
      });
    }
    snowLayers.push(particles);
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

