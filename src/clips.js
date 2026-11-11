const POSES = ["wave", "idle", "talk", "cheer", "victory", "confused"];

export function poseName(pose) {
  if (pose === "scratch" || pose === "confused") return "confused";
  if (POSES.includes(pose)) return pose;
  return "idle";
}

export function classifyClip(name) {
  const label = String(name).toLowerCase();
  if (label.includes("scratch") || label.includes("confused") || label.includes("puzzle")) {
    return "confused";
  }
  if (label.includes("victory")) return "victory";
  if (label.includes("cheer") || label.includes("motiv") || label.includes("celebrat")) {
    return "cheer";
  }
  if (
    label.includes("wave") ||
    label.includes("hello") ||
    label.includes("greet")
  ) {
    return "wave";
  }
  if (
    label.includes("talk") ||
    label.includes("speak") ||
    label.includes("gesture") ||
    label.includes("explain")
  ) {
    return "talk";
  }
  if (
    label.includes("idle") ||
    label.includes("stand") ||
    label.includes("breath") ||
    label.includes("rest")
  ) {
    return "idle";
  }
  return null;
}

export function resolveClips(clips) {
  const found = {
    wave: null,
    idle: null,
    talk: null,
    cheer: null,
    victory: null,
    confused: null
  };

  for (const clip of clips || []) {
    const name = typeof clip === "string" ? clip : clip?.name;
    if (!name) continue;
    const pose = classifyClip(name);
    if (pose && !found[pose]) found[pose] = name;
  }

  return found;
}

const TALKING = new Set(["mistake", "too-hard", "help", "chat", "start-game"]);

export function poseForTurn({ moment, spelling = false } = {}) {
  if (spelling) return "idle";
  if (moment === "greeting") return "wave";
  if (moment === "success") return "cheer";
  if (TALKING.has(moment)) return "talk";
  return "idle";
}
