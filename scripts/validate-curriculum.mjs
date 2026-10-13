import { readFileSync } from 'node:fs';
import { validateCurriculum } from '../src/lib/curriculum.mjs';
const load = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const missions = load('missions');
const errors = validateCurriculum(missions, load('tracks'));
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Validated ${missions.length} mission contracts and prerequisite graph.`);
