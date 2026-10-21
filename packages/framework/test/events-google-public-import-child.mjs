import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const packageJson=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(Object.hasOwn(packageJson.exports,'./events-cloud-tasks-transport'),false);
assert.equal(Object.hasOwn(packageJson.exports,'./events-google-sdk-lifetime'),false);
await import('../dist/index.js');
await import('../dist/events-postgres.js');
await import('../dist/events-postgres-lifecycle.js');
process.stdout.write('PUBLIC_IMPORTS_GOOGLE_FREE\n');
