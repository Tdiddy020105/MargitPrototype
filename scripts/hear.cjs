function readWhisperText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\[[^\]]+\]\s*/, "").replace(/^\uFEFF/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function usableTranscript(text) {
  const value = readWhisperText(text);
  if (value.length < 2) return "";
  const folded = value.toLowerCase();
  if (
    /ondertitel|bedankt voor het kijken|thanks for watching|sous[- ]titr|amara\.org|www\.|ik hoorde je niet/.test(
      folded
    )
  ) {
    return "";
  }
  return value;
}

module.exports = { readWhisperText, usableTranscript };
