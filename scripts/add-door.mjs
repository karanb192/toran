import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const LIMITS = { place: 40, line: 140 };

// GitHub renders an issue form as "### Label" headings followed by the answer.
export function parseIssueBody(body) {
  const out = {};
  const parts = String(body || '').split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const [head, ...rest] = part.split('\n');
    out[head.trim().toLowerCase()] = rest.join('\n').trim();
  }
  return { place: out.place || '', line: out.line || '' };
}

export function cleanDoor({ place, line }) {
  const tidy = (s) => String(s).replace(/\s+/g, ' ').trim();
  const p = tidy(place);
  const l = tidy(line);
  if (!p || p === '_No response_') return { error: 'Place is empty.' };
  if (!l || l === '_No response_') return { error: 'Line is empty.' };
  if (p.length > LIMITS.place) return { error: `Place is over ${LIMITS.place} characters.` };
  if (l.length > LIMITS.line) return { error: `Line is over ${LIMITS.line} characters.` };
  if (/https?:\/\/|www\.|[<>]/i.test(p + ' ' + l)) return { error: 'Links and angle brackets are not allowed.' };
  return { place: p, line: l };
}

export function addDoor(doors, door, meta) {
  if (doors.some((d) => d.issue === meta.issue)) return doors;
  return [...doors, { place: door.place, line: door.line, by: meta.by, issue: meta.issue }];
}

function main() {
  const door = cleanDoor(parseIssueBody(process.env.ISSUE_BODY));
  if (door.error) {
    console.error(door.error);
    process.exit(1);
  }
  const file = new URL('../doors.json', import.meta.url);
  const doors = JSON.parse(readFileSync(file, 'utf8'));
  const next = addDoor(doors, door, { by: process.env.ISSUE_AUTHOR || '', issue: Number(process.env.ISSUE_NUMBER) });
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  console.log(`Hung a door from ${door.place}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
