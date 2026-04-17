// Content filter — blocks illegal, explicit, and harmful content
// Covers: English sexual/nudity, weapons, drugs, terrorism, threats
//         Hindi abusive words (romanized transliteration as typed in chat)

// ── English patterns (word-boundary safe) ────────────────────────
const ENGLISH_PATTERNS = [
  // Sexual/explicit
  /\bnude(s)?\b/i, /\bnudity\b/i, /\bporn(o|hub)?\b/i, /\bpornography\b/i,
  /\bsexting\b/i, /\bnaked\b/i, /\bboobs?\b/i, /\bdick\b/i,
  /\bpenis\b/i, /\bvagina\b/i, /\bfuck(ing|er|ed)?\b/i,
  /\bslut\b/i, /\bwhore\b/i, /\bpussy\b/i, /\basshole\b/i,
  /\bcock\b/i, /\bcum\b/i, /\bsend\s*nudes?\b/i,
  /\bchild\s*porn\b/i, /\bcsam\b/i, /\bpedo(phile)?\b/i,
  /\bcp\s*(link|video|pic)\b/i,
  // Weapons — standalone and in context
  /\bweapon(s)?\b/i, /\bgrenade(s)?\b/i, /\bexplosive(s)?\b/i,
  /\bak[-\s]?47\b/i, /\brifle\b/i, /\bpistol\b/i, /\bshotgun\b/i,
  /\b(buy|sell|get|supply)\s*(gun|guns|weapon|weapons|bomb|bombs|explosive|ammo|ammunition)\b/i,
  /\bbomb\s*(threat|blast|making)\b/i, /\bpipe\s*bomb\b/i,
  /\bIED\b/, /\bRDX\b/, /\bTNT\b/,
  // Drugs
  /\bheroin\b/i, /\bcocaine\b/i, /\bmeth(amphetamine)?\b/i,
  /\b(buy|sell|supply|deal)\s*(weed|drugs?|ganja|charas|smack|brown\s*sugar)\b/i,
  /\bdrug\s*deal(er|ing)?\b/i, /\bsmuggl(e|ing|er)\b/i,
  // Terrorism / extremism
  /\bterror(ist|ism|attack)?\b/i, /\bjihad(i)?\b/i,
  /\bisis\b/i, /\bal[\s-]?qaeda\b/i, /\bnaxal(ite)?\b/i,
  /\bblast\s*(plan|attack)\b/i,
  // Threats / violence
  /\bi\s*will\s*(kill|rape|murder|shoot|stab)\b/i,
  /\bkill\s*(you|him|her|them|yourself)\b/i,
  /\bi\s*will\s*rape\b/i, /\brapist\b/i, /\bgang\s*rape\b/i,
  /\bsuicide\s*(bomb|attack|vest)\b/i,
];

// ── Hindi romanized patterns (substring match — no word boundary) ─
// People type these without spaces or with variations
const HINDI_SUBSTRINGS = [
  // Abusive — sexual
  "madarchod", "madarcho", "madarchot",
  "bhenchod", "bhencho", "benchod", "bencho",
  "bhenkelode", "bhenkelo",
  "chutiya", "chutiye", "chutiyap",
  "gaandu", "gandu", "gaand",
  "randi", "randwa", "randwe",
  "harami", "haramzada", "haramzade",
  "kamina", "kamine",
  "lodu", "lode", "lund",
  "bhosdike", "bhosdiwale", "bhosdi",
  "teri maa ki", "teri behen ki",
  "saala", "saali",
  "kutte", "kutta",
  "suar", "suwar",
  // Threats in Hindi
  "jaan se maar", "maar dunga", "maar denge",
  "kaat dunga", "uda dunga",
  "kidnap karunga", "rape karunga",
  // Drugs in Hindi
  "charas bech", "ganja bech", "smack bech",
  "nasha bech", "drug bech",
  // Weapons in Hindi
  "pistol bech", "gun bech", "bomb bana",
  "hatiyar", "hathiyar",
];

// Normalize: lowercase, remove zero-width chars, collapse spaces
const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const containsBannedContent = (text) => {
  if (!text) return false;
  const normalized = normalize(text);

  // Check English word-boundary patterns
  if (ENGLISH_PATTERNS.some((p) => p.test(normalized))) return true;

  // Check Hindi substrings (remove all spaces for evasion like "b h e n c h o d")
  const noSpace = normalized.replace(/\s/g, "");
  if (HINDI_SUBSTRINGS.some((w) => noSpace.includes(w))) return true;

  return false;
};

module.exports = { containsBannedContent };
