import { readFileSync } from 'node:fs';
import { defaultStoryPath, validateStory, type Story } from './content.js';

const path = process.argv[2] ? process.argv[2] : defaultStoryPath();
let story: Story;
try {
  story = JSON.parse(readFileSync(path, 'utf8')) as Story;
} catch (e) {
  console.error(`Could not read ${path}: ${(e as Error).message}`);
  process.exit(1);
}
const problems = validateStory(story);
for (const p of problems) console.log(`${p.level === 'error' ? 'ERROR' : 'warn '}  ${p.message}`);
const errors = problems.filter((p) => p.level === 'error').length;
console.log(`\n${path}\n${story.roles.length} roles, ${story.objects.length} objects, ${story.clues.length} clues, ${story.events.length} events: ${errors} error(s), ${problems.length - errors} warning(s)`);
process.exit(errors ? 1 : 0);
