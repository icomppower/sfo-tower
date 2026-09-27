// Node-side loader for the derived data (the browser fetches the same files).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const D = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'derived');
const rd = (f) => JSON.parse(readFileSync(join(D, f), 'utf8'));
export function loadData() { return { airport: rd('ksfo-airport.json'), procedures: rd('ksfo-procedures.json'), metar: rd('ksfo-metar.json'), traffic: rd('ksfo-traffic.json'), aircraft: rd('aircraft.json'), capacity: rd('sfo-capacity.json') }; }
