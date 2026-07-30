// LionType shared helpers
export const WORDS = ("the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us life system power light world great mind future speed code data machine neon pulse vision energy signal wave storm quick strong brave hunt pride roar wild swift sharp focus flow zone level rank score win rise high dream build create logic space star night dawn fire steel glass echo drift shift spark surge byte core node grid link sync path track race run jump move turn play team lead grow learn read write test type key word line text page open close start stop end begin next last long short fast slow easy hard true real full deep pure calm bold keen vast").split(" ");

const PUNCT = [",", ".", "!", "?", ";", ":"];

export function genWords(n, punctuation = false) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let w = WORDS[Math.floor(Math.random() * WORDS.length)];
    if (punctuation) {
      if (Math.random() < 0.15) w += PUNCT[Math.floor(Math.random() * PUNCT.length)];
      if (Math.random() < 0.1) w = w[0].toUpperCase() + w.slice(1);
    }
    out.push(w);
  }
  return out;
}

export function escapeHtml(c) {
  return c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c;
}

export function rank(wpm) {
  if (wpm >= 120) return "🦁 APEX LION — legendary velocity";
  if (wpm >= 100) return "⚡ ALPHA PREDATOR — dominating the savanna";
  if (wpm >= 80) return "🔥 PRIDE LEADER — fearsome speed";
  if (wpm >= 60) return "🌟 HUNTER — closing in on the prey";
  if (wpm >= 40) return "🐾 YOUNG LION — claws sharpening";
  return "🌱 CUB — every lion starts somewhere";
}

// Theme palettes shared between CSS (themes.css) and the WebGL scene
export const THEMES = {
  neon:    { a: 0x00e5ff, b: 0x7c4dff, c: 0xffb52e, fog: 0x05060e, mane: 0xffb52e, body: 0x0e1430, eye: 0x00e5ff },
  savanna: { a: 0xffb52e, b: 0xff7a1a, c: 0xffe9b0, fog: 0x0e0903, mane: 0xff8c1a, body: 0x2a1a05, eye: 0xffd77a },
  cyber:   { a: 0xff2ec4, b: 0x7c4dff, c: 0x00e5ff, fog: 0x0c0512, mane: 0xff2ec4, body: 0x180a28, eye: 0x00e5ff }
};

// Persistent stats: personal-best WPM and test count, saved locally
export const storage = {
  async load() {
    return {
      best: +(localStorage.getItem("lt_best") || 0),
      tests: +(localStorage.getItem("lt_tests") || 0)
    };
  },
  save(best, tests) {
    localStorage.setItem("lt_best", best);
    localStorage.setItem("lt_tests", tests);
  }
};

