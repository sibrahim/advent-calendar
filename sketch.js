/* -----------------------------------------------------------
   Advent Calendar V7 Interactive Engine
   Features:
   - JSON-driven doors
   - Door animations: slide, hinge, fold, fall
   - Toy bounce-in reveal
   - MP4 popup video support
   - Door-opening sound
   - Snow overlay with parallax
   - Background animal micro-movement
   ----------------------------------------------------------- */

let bg;
let doors = [];
let toys = {};
let doorSound;

// Snow
let snowLayers = [];

// Animals micro-animation placeholders
let tAnim = 0;

// Video overlay
let videoElement = null;

function preload() {
  bg = loadImage("assets/advent-image.png?v=" + Date.now());

  // Load toys
  toys["star"] = loadImage("assets/toy_star.png");
  toys["bear"] = loadImage("assets/toy_bear.png");
  toys["reindeer"] = loadImage("assets/toy_reindeer.png");

  // Door-opening sound
  doorSound = new Audio("assets/open.mp3?v=" + Date.now());
}

function setup() {
  let c = createCanvas(bg.width, bg.height);
  c.parent("canvas-container");

  // Load door metadata
  loadJSON("assets/advent_doors.json?v=" + Date.now(), (data) => {
    doors = data.doors;
    for (let d of doors) {
      d.state = "closed";
      d.animFrame = 0;
      d.toyFrame = 0;
    }
  });

  initSnow();
}

function draw() {
  background(bg);

  tAnim += 0.02;

  drawSnow();
  drawAnimals();
  drawDoors();
}

/* -----------------------------------------------------------
   DOOR DRAW + ANIMATION
----------------------------------------------------------- */

function drawDoors() {
  for (let d of doors) {
    let x = d.x * width;
    let y = d.y * height;
    let w = d.w * width;
    let h = d.h * height;

    // Closed (draw placeholder frame)
    if (d.state === "closed") {
      noFill();
      stroke(180, 0, 0);
      strokeWeight(2);
      rect(x, y, w, h);
    }

    // Animating open
    else if (d.state === "animating") {
      playDoorAnimation(d, x, y, w, h);
      d.animFrame++;

      if (d.animFrame > 30) {
        d.state = "opened";
        if (!d.payload.startsWith("mp4")) {
          d.toyFrame = 0;
        }
        else {
          playVideo(d.payload.split(":")[1]);
        }
      }
    }

    // Display Toy Bounce
    else if (d.state === "opened" && !d.payload.startsWith("mp4")) {
      drawToyBounce(d, x, y, w, h);
    }
  }
}

/* -----------------------------------------------------------
   CLICK INTERACTIONS
----------------------------------------------------------- */

function mousePressed() {
  for (let d of doors) {
    let x = d.x * width;
    let y = d.y * height;
    let w = d.w * width;
    let h = d.h * height;

    if (
      mouseX >= x &&
      mouseX <= x + w &&
      mouseY >= y &&
      mouseY <= y + h &&
      d.state === "closed"
    ) {
      openDoor(d);
      break;
    }
  }
}

function openDoor(d) {
  doorSound.currentTime = 0;
  doorSound.play();

  d.state = "animating";
  d.animFrame = 0;
}

/* -----------------------------------------------------------
   DOOR OPENING ANIMATIONS
----------------------------------------------------------- */

function playDoorAnimation(d, x, y, w, h) {
  let t = d.animFrame / 30;

  fill(255, 240, 200, 200);
  noStroke();

  switch (d.animation) {
    case "slide":
      drawSlideDoor(t, x, y, w, h);
      break;

    case "hinge":
      drawHingeDoor(t, x, y, w, h);
      break;

    case "fold":
      drawFoldDoor(t, x, y, w, h);
      break;

    case "fall":
      drawFallDoor(t, x, y, w, h);
      break;
  }
}

function drawSlideDoor(t, x, y, w, h) {
  push();
  translate(x + w * t, y);
  rect(0, 0, w, h);
  pop();
}

function drawHingeDoor(t, x, y, w, h) {
  push();
  translate(x, y);
  translate(0, 0);
  rotate(-HALF_PI * t);
  rect(0, 0, w, h);
  pop();
}

function drawFoldDoor(t, x, y, w, h) {
  push();
  translate(x, y);
  scale(1 - t, 1);
  rect(0, 0, w, h);
  pop();
}

function drawFallDoor(t, x, y, w, h) {
  push();
  translate(x, y + t * 200);
  rotate(t * 2);
  rect(0, 0, w, h);
  pop();
}

/* -----------------------------------------------------------
   TOY BOUNCE POP-OUT
----------------------------------------------------------- */

function drawToyBounce(d, x, y, w, h) {
  let toyName = d.payload;
  let img = toys[toyName];
  if (!img) return;

  let t = d.toyFrame / 30;
  t = constrain(t, 0, 1);

  // Bounce easing
  let scaleAmt = easeOutBack(t);

  push();
  translate(x + w / 2, y + h / 2);
  scale(scaleAmt);
  imageMode(CENTER);
  image(img, 0, 0);
  pop();

  d.toyFrame++;
}

// easing function
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/* -----------------------------------------------------------
   MP4 VIDEO POPUP
----------------------------------------------------------- */

function playVideo(src) {
  if (videoElement) videoElement.remove();

  const container = document.getElementById("canvas-container");

  videoElement = document.createElement("video");
  videoElement.src = src;
  videoElement.autoplay = true;
  videoElement.controls = true;
  videoElement.className = "video-overlay";

  container.appendChild(videoElement);

  videoElement.onended = () => {
    videoElement.remove();
    videoElement = null;
  };
}

/* -----------------------------------------------------------
   SNOW PARTICLES
----------------------------------------------------------- */

function initSnow() {
  for (let layer = 0; layer < 3; layer++) {
    let particles = [];
    for (let i = 0; i < 240; i++) { //120 snowflakes
      particles.push({
        x: random(width),
        y: random(height),
        speed: random(0.3, 1.0) * (layer + 1),
        size: random(2, 6 + layer), //size of snowflakes (1,3 + layer)
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
   ANIMAL MICRO-ANIMATION
----------------------------------------------------------- */

function drawAnimals() {
  // These are placeholder animations for future custom art anchors.
  // Adjust positions to match actual animals in your image.

  // Penguin bob
  push();
  translate(100, 300 + sin(tAnim) * 3);
  pop();

  // Bunny blink
  push();
  let blink = abs(sin(tAnim * 3)) < 0.1;
  if (blink) {
    stroke(0);
    line(400, 500, 420, 500);
  }
  pop();

  // Fox tail swish
  push();
  translate(650, 420);
  rotate(sin(tAnim * 2) * 0.2);
  pop();

  // Hedgehog wiggle
  push();
  translate(820, 700 + sin(tAnim * 2.5) * 2);
  pop();
}
