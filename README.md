# Advent Calendar

An interactive p5.js-powered advent calendar with animated doors, toy reveals, MP4 popups, snow/animal overlays, and a calendar-based unlock flow.

## Code Structure

- `index.html` — loads p5.js, injects `door.js` (door logic) and `sketch.js` (engine), and hosts the canvas container.
- `sketch.js` — orchestrates rendering: loads assets in `preload`, builds the canvas in `setup`, draws overlays in `draw`, enforces door gating in `mousePressed`, and manages the video overlay plus snow/animal loops.
- `door.js` — encapsulates each door’s state machine: hit-testing, drawing closed/open panels, door animations (`slide`, `hinge`, `fold`, `fall`, `double`), toy bounce + fade-out, the auto-close loop, and locked-door shake feedback.
- `assets/` — contains the illustrated background, toy sprites, MP4 payloads, audio (`open.mp3`, `locked.mp3`), and the authoritative `assets/advent_doors.json`.

## Door Lifecycle

1. **Closed** — draws the panel (single or double leaf) plus the numeric badge (centered for most doors, below for double doors).  
2. **Opening** — plays the configured animation until `animProgress` reaches 1.  
3. **Open** — shows the toy bounce animation (or plays the MP4) and starts the fade/reset timers.  
4. **Closing** — reverses the animation once the toy has faded or a video finishes, then returns to `closed`.

Door sounds and toy progress are reset automatically so doors can be opened again after the cycle completes.

## Calendar-Based Unlocking

Every click re-evaluates the “current day” so long-lived sessions pick up date changes without reloading:

1. If `ALL_DOORS` (from JSON) is `true`, the resolver returns `31`, effectively unlocking every door.  
2. Otherwise, if `testDay` is a number, it is clamped to `1–31` and used as the current day (handy for QA).  
3. Otherwise, the resolver falls back to the user’s local `new Date().getDate()` value.

Each door exposes `unlockDay` (defaults to `id` unless overridden in JSON). When the resolved day is less than `unlockDay`, the door stays closed, plays `locked.mp3`, and briefly shakes to indicate it is not yet available.

## Customization via `assets/advent_doors.json`

### Top-Level Options

```json
{
  "_meta": {
    "animationLegend": "slide | hinge | fold | fall | double",
    "doorAccess": "ALL_DOORS=true overrides the calendar; testDay (1-24) forces a specific day when ALL_DOORS=false."
  },
  "ALL_DOORS": false,
  "testDay": null,
  "doors": [ ... ]
}
```

- `ALL_DOORS`: Set to `true` to bypass the calendar entirely (useful for kiosks or demos).  
- `testDay`: Optional integer to simulate a specific day while leaving `ALL_DOORS` false; set to `null` for real-time behavior.  
- `_meta`: Purely informational hints for maintainers.

### Per-Door Fields

Each entry inside `doors` supports:

| Field       | Description |
|-------------|-------------|
| `id`        | Unique identifier; also used for unlock day unless `unlockDay` is specified. |
| `x`, `y`    | Normalized coordinates (0–1) for the top-left corner relative to the background image. |
| `w`, `h`    | Normalized width/height, enabling responsive scaling. |
| `payload`   | `star`, `bear`, `reindeer`, or `mp4:relative/path.mp4`. Non-MP4 payloads use the toy bounce reveal. |
| `animation` | One of `slide`, `hinge`, `fold`, `fall`, `double`. Unknown values fall back to `slide`. |
| `unlockDay` | *Optional.* Override the calendar day required to open this specific door (defaults to `id`). |

### Files Referenced by Payloads

- Toy images: `assets/toy_star.png`, `assets/toy_bear.png`, `assets/toy_reindeer.png`.  
- Videos: place MP4s under `assets/` (or another web-accessible path) and reference them as `mp4:assets/my_video.mp4`.  
- Audio:
  - `assets/open.mp3` — door-opening chime (played when a door successfully begins opening).  
  - `assets/locked.mp3` — short thud for locked doors.

You can swap these files (keeping dimensions/formats compatible) to reskin the experience.

## Adding Doors or Assets

1. Drop new imagery/audio into `assets/`.  
2. Append a door entry to `assets/advent_doors.json` with the normalized placement, size, payload, and animation.  
3. Optionally override `unlockDay` or point `payload` at a new MP4.  
4. Reload the page (the JSON is fetched at runtime, so no bundling step is necessary).

Because all coordinates are normalized, the same JSON works across different canvas sizes as long as the background image keeps its proportions.

