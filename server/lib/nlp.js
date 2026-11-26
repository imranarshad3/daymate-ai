// Tiny natural-language parser for Roman Urdu / English todo text.
// "kal 10:30 par Ali ko call karni hai" -> { date: tomorrow, time: "10:30", title: "Ali ko call karni" }
// NOTE: client/src/utils/nlp.js is an identical copy.

const PERIOD = {
  subah: 'am', subha: 'am', morning: 'am',
  dopahar: 'pm', dopehar: 'pm', dophar: 'pm', afternoon: 'pm',
  shaam: 'pm', sham: 'pm', evening: 'pm',
  raat: 'pm', rat: 'pm', night: 'pm', tonight: 'pm',
};

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function extractTime(input) {
  let s = ` ${input} `;
  let period = null;
  for (const [w, p] of Object.entries(PERIOD)) {
    const re = new RegExp(`\\b${w}\\b`, 'gi');
    if (re.test(s)) {
      period = p;
      s = s.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
    }
  }
  let h = null;
  let min = 0;
  let ap = null;
  let m;
  if ((m = s.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i))) {
    h = +m[1]; min = +m[2]; ap = m[3];
    s = s.replace(m[0], ' ');
  } else if ((m = s.match(/\b(\d{1,2})\s*(am|pm)\b/i))) {
    h = +m[1]; ap = m[2];
    s = s.replace(m[0], ' ');
  } else if ((m = s.match(/\b(\d{1,2})\s*(baje|bje|bjy|bajay|bajy|o'?clock)\b/i))) {
    h = +m[1];
    s = s.replace(m[0], ' ');
  }
  s = s.replace(/\b(baje|bje|bjy|bajay|bajy)\b/gi, ' ');
  if (h === null || h > 23 || min > 59) return { time: '', rest: s };
  ap = (ap || period || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return { time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, rest: s };
}

const FILLER = /\b(par|pe|per|pr|at|on|mujhe|mujhy|muje|mjhe|remind me to|remind me|remind|yaad dilana|yad dilana|hai|hain|he|hy)\b/gi;

const CATEGORY_RULES = [
  ['call', /\b(call|phone|fon|ring)\b/i],
  ['work', /\b(meeting|office|client|email|report|presentation|deadline|boss|project|interview)\b/i],
  ['health', /\b(gym|doctor|dr|dawai|medicine|walk|exercise|workout|run|yoga|dentist|hospital)\b/i],
  ['study', /\b(parhna|parhai|study|class|lecture|exam|homework|assignment|pages|course)\b/i],
  ['shopping', /\b(grocery|shopping|khareedna|khareed|buy|bazaar|market|order)\b/i],
  ['finance', /\b(bill|bank|pay|payment|rent|salary|fee|fees|tax)\b/i],
  ['family', /\b(ammi|abbu|ami|abu|family|bhai|behan|wife|husband|bachay|kids|nani|dadi)\b/i],
];
export function guessCategory(text) {
  for (const [cat, re] of CATEGORY_RULES) if (re.test(text)) return cat;
  return '';
}

export function parseNatural(text, today) {
  let s = String(text || '');
  let date = '';
  const dayRules = [
    [/\b(parson|parso|day after tomorrow)\b/gi, 2],
    [/\b(kal|kl|tomorrow|tmrw|tmr)\b/gi, 1],
    [/\b(aaj|aj|today)\b/gi, 0],
  ];
  for (const [re, n] of dayRules) {
    if (re.test(s)) {
      date = addDays(today, n);
      s = s.replace(re, ' ');
      break;
    }
  }
  const { time, rest } = extractTime(s);
  let title = rest
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .replace(/\s+(karni|karna|karne|krni|krna|krne|kerni|jana|jaana)$/i, '')
    .replace(/^ko\s+/i, '')
    .trim();
  if (!title) title = String(text || '').trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { title, date, time, category: guessCategory(text) };
}
