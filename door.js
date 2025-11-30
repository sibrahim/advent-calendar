/* -----------------------------------------------------------
   Door Class for Advent Calendar V7
   Handles:
   - Hit detection
   - Drawing closed door
   - Opening animations: slide, hinge, fold, fall, double
   - Toy bounce after opening + timed fade/reset
----------------------------------------------------------- */

const DOOR_ANIMATIONS = new Set(["slide", "hinge", "fold", "fall", "double"]);
const ANIM_STEP = 1 / 30;
const RESET_DELAY_MS = 10000;
const FADE_DURATION_MS = 2000;

class Door {
  constructor(cfg, toys, doorSound) {
    this.id = cfg.id;
    this.x = cfg.x;   // normalized 0–1
    this.y = cfg.y;
    this.w = cfg.w;
    this.h = cfg.h;

    this.payload = cfg.payload;       // "star", "bear", "reindeer" or "mp4:assets/door4_video.mp4"
    this.animation = DOOR_ANIMATIONS.has(cfg.animation) ? cfg.animation : "slide";

    this.toys = toys;
    this.doorSound = doorSound;

    this.state = "closed";     // "closed" → "opening" → "open" → "closing"
    this.animProgress = 0;     // 0 → 1 for door animation
    this.toyProgress = 0;      // 0 → 1 for toy bounce
    this.toyAlpha = 1;
    this.openedAt = null;
    this.fadeStartedAt = null;
  }

  // Convenience: convert normalized coords to pixels
  px() { return this.x * width; }
  py() { return this.y * height; }
  pw() { return this.w * width; }
  ph() { return this.h * height; }

  isHit(mx, my) {
    const x = this.px(), y = this.py(), w = this.pw(), h = this.ph();
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
  }

  open() {
    if (this.state !== "closed") return null;

    if (this.doorSound) {
      this.doorSound.currentTime = 0;
      this.doorSound.play();
    }

    this.state = "opening";
    this.animProgress = 0;

    // If this door should play a video, return the src
    if (this.payload && this.payload.startsWith("mp4:")) {
      return this.payload.split(":")[1]; // e.g. "assets/door4_video.mp4"
    }
    return null;
  }

  update() {
    if (this.state === "opening") {
      this.animProgress += ANIM_STEP;  // ~30 frames of animation
      if (this.animProgress >= 1) {
        this.animProgress = 1;
        this.state = "open";

        if (!this.isVideoPayload()) {
          this.resetToyState();
          this.openedAt = millis();
        }
      }
    } else if (this.state === "open" && !this.isVideoPayload()) {
      this.advanceToyReveal();
    } else if (this.state === "closing") {
      this.animProgress -= ANIM_STEP;
      if (this.animProgress <= 0) {
        this.animProgress = 0;
        this.state = "closed";
        this.resetToyState();
      }
    }
  }

  draw() {
    if (this.state === "closed") {
      this.drawClosedPanel();
    } else if (this.state === "opening" || this.state === "closing") {
      this.drawOpeningPanel();
    } else if (this.state === "open") {
      if (!this.isVideoPayload()) {
        this.drawToyBounce();
      }
    }
  }

  /* -----------------------------------------------------------
     Door visuals
  ----------------------------------------------------------- */

  drawClosedPanel() {
    const x = this.px(), y = this.py(), w = this.pw(), h = this.ph();

    const placeBelow = this.animation === "double";
    if (this.animation === "double") {
      const { gap, leafWidth } = this.getDoubleDoorMetrics(w);
      this.drawDoorLeaf(x, y, leafWidth, h, "right");
      this.drawDoorLeaf(x + leafWidth + gap, y, leafWidth, h, "left");
    } else {
      this.drawDoorLeaf(x, y, w, h, "right");
    }

    this.drawDoorNumber(x, y, w, h, placeBelow);
  }

  drawOpeningPanel() {
    const t = this.animProgress;   // 0 → 1
    const x = this.px(), y = this.py(), w = this.pw(), h = this.ph();

    switch (this.animation) {
      case "slide":
        // Slide to the right
        push();
        translate(x + w * t, y);
        this.drawDoorLeaf(0, 0, w, h, "right");
        pop();
        break;

      case "hinge":
        // Swing like a door hinged on the left
        push();
        translate(x, y);
        rotate(-HALF_PI * t); // up to -90 degrees
        this.drawDoorLeaf(0, 0, w, h, "right");
        pop();
        break;

      case "fold":
        // Fold in on itself (scale X)
        push();
        translate(x, y);
        scale(1 - t, 1);
        this.drawDoorLeaf(0, 0, w, h, "right");
        pop();
        break;

      case "fall":
        // Fall down while rotating
        push();
        translate(x, y + t * 3 * h);
        rotate(t * PI);
        this.drawDoorLeaf(0, 0, w, h, "right");
        pop();
        break;

      case "double": {
        // Split from center: left leaf slides left, right leaf slides right
        const { gap, leafWidth } = this.getDoubleDoorMetrics(w);
        const offset = t * (leafWidth + gap + 4);

        push();
        translate(x - offset, y);
        this.drawDoorLeaf(0, 0, leafWidth, h, "right");
        pop();

        push();
        translate(x + leafWidth + gap + offset, y);
        this.drawDoorLeaf(0, 0, leafWidth, h, "left");
        pop();
        break;
      }

      default:
        // Fallback: slide
        push();
        translate(x + w * t, y);
        this.drawDoorLeaf(0, 0, w, h, "right");
        pop();
        break;
    }
  }

  /* -----------------------------------------------------------
     Toy bounce reveal
  ----------------------------------------------------------- */

  drawToyBounce() {
    const toyKey = this.payload;
    const img = this.toys[toyKey];
    if (!img) return;

    const t = this.toyProgress;
    const s = this.easeOutBack(t);

    const cx = this.px() + this.pw() / 2;
    const cy = this.py() + this.ph() / 2;

    push();
    translate(cx, cy);
    scale(s);
    imageMode(CENTER);
    const alpha = constrain(this.toyAlpha, 0, 1) * 255;
    tint(255, alpha);
    image(img, 0, 0);
    noTint();
    pop();
  }

  easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  drawDoorLeaf(x, y, w, h, handleSide = "right") {
    push();

    fill(200, 150, 80);
    stroke(120, 80, 40);
    strokeWeight(2);
    rect(x, y, w, h, 5);

    noFill();
    stroke(100, 60, 30);
    rect(x + 4, y + 4, w - 8, h - 8, 4);

    const handleX = handleSide === "left" ? x + 10 : x + w - 10;
    stroke(80, 50, 30);
    strokeWeight(2);
    line(handleX, y + h / 2 - 5, handleX, y + h / 2 + 5);

    pop();
  }

  getDoubleDoorMetrics(totalWidth) {
    const gap = Math.max(2, totalWidth * 0.02);
    const leafWidth = (totalWidth - gap) / 2;
    return { gap, leafWidth };
  }

  drawDoorNumber(x, y, w, h, placeBelow = false) {
    push();
    fill(190, 0, 20);
    noStroke();
    textAlign(CENTER, placeBelow ? TOP : CENTER);
    textStyle(BOLD);
    textFont("Georgia");
    const size = Math.min(w, h) * 0.6;
    textSize(size);
    const padding = Math.min(w, h) * 0.15;
    const textY = placeBelow ? y + h + padding : y + h / 2 + size * 0.05;
    text(this.id, x + w / 2, textY);
    pop();
  }

  advanceToyReveal() {
    if (this.toyProgress < 1) {
      this.toyProgress += ANIM_STEP;
      if (this.toyProgress > 1) this.toyProgress = 1;
    }

    if (this.openedAt === null) {
      this.openedAt = millis();
      return;
    }

    const now = millis();
    if (!this.fadeStartedAt && now - this.openedAt >= RESET_DELAY_MS) {
      this.fadeStartedAt = now;
    }

    if (this.fadeStartedAt) {
      const elapsed = now - this.fadeStartedAt;
      const ratio = constrain(elapsed / FADE_DURATION_MS, 0, 1);
      this.toyAlpha = 1 - ratio;
      if (this.toyAlpha <= 0) {
        this.toyAlpha = 0;
        this.startClosing();
      }
    }
  }

  startClosing() {
    if (this.state === "closing" || this.state === "closed") return;
    this.state = "closing";
  }

  handleVideoFinished() {
    if (!this.isVideoPayload()) return;
    this.startClosing();
  }

  resetToyState() {
    this.toyProgress = 0;
    this.toyAlpha = 1;
    this.openedAt = null;
    this.fadeStartedAt = null;
  }

  isVideoPayload() {
    return this.payload && this.payload.startsWith("mp4:");
  }
}

