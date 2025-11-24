/* -----------------------------------------------------------
   Door Class for Advent Calendar V7
   Handles:
   - Hit detection
   - Drawing closed door
   - Opening animations: slide, hinge, fold, fall
   - Toy bounce after opening
----------------------------------------------------------- */

class Door {
  constructor(cfg, toys, doorSound) {
    this.id = cfg.id;
    this.x = cfg.x;   // normalized 0–1
    this.y = cfg.y;
    this.w = cfg.w;
    this.h = cfg.h;

    this.payload = cfg.payload;       // "star", "bear", "reindeer" or "mp4:assets/door4_video.mp4"
    this.animation = cfg.animation || "slide";

    this.toys = toys;
    this.doorSound = doorSound;

    this.state = "closed";     // "closed" → "opening" → "open"
    this.animProgress = 0;     // 0 → 1 for door animation
    this.toyProgress = 0;      // 0 → 1 for toy bounce
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
      this.animProgress += 1 / 30;  // ~30 frames of animation
      if (this.animProgress >= 1) {
        this.animProgress = 1;
        this.state = "open";

        if (!this.payload.startsWith("mp4:")) {
          this.toyProgress = 0;
        }
      }
    } else if (this.state === "open" && !this.payload.startsWith("mp4:")) {
      if (this.toyProgress < 1) {
        this.toyProgress += 1 / 30;
        if (this.toyProgress > 1) this.toyProgress = 1;
      }
    }
  }

  draw() {
    if (this.state === "closed") {
      this.drawClosedPanel();
    } else if (this.state === "opening") {
      this.drawOpeningPanel();
    } else if (this.state === "open") {
      if (!this.payload.startsWith("mp4:")) {
        this.drawToyBounce();
      }
    }
  }

  /* -----------------------------------------------------------
     Door visuals
  ----------------------------------------------------------- */

  drawClosedPanel() {
    const x = this.px(), y = this.py(), w = this.pw(), h = this.ph();

    push();
    // Door body
    fill(200, 150, 80);
    stroke(120, 80, 40);
    strokeWeight(2);
    rect(x, y, w, h, 5);

    // Inner panel
    noFill();
    stroke(100, 60, 30);
    rect(x + 4, y + 4, w - 8, h - 8, 4);

    // Handle
    stroke(80, 50, 30);
    strokeWeight(2);
    line(x + w - 10, y + h / 2 - 5, x + w - 10, y + h / 2 + 5);
    pop();
  }

  drawOpeningPanel() {
    const t = this.animProgress;   // 0 → 1
    const x = this.px(), y = this.py(), w = this.pw(), h = this.ph();

    push();
    fill(200, 150, 80);
    stroke(120, 80, 40);
    strokeWeight(2);

    switch (this.animation) {
      case "slide":
        // Slide to the right
        translate(x + w * t, y);
        rect(0, 0, w, h, 5);
        break;

      case "hinge":
        // Swing like a door hinged on the left
        translate(x, y);
        translate(0, 0);
        rotate(-HALF_PI * t); // up to -90 degrees
        rect(0, 0, w, h, 5);
        break;

      case "fold":
        // Fold in on itself (scale X)
        translate(x, y);
        scale(1 - t, 1);
        rect(0, 0, w, h, 5);
        break;

      case "fall":
        // Fall down while rotating
        translate(x, y + t * 3 * h);
        rotate(t * PI);
        rect(0, 0, w, h, 5);
        break;

      default:
        // Fallback: slide
        translate(x + w * t, y);
        rect(0, 0, w, h, 5);
        break;
    }

    pop();
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
    image(img, 0, 0);
    pop();
  }

  easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
}

