#!/usr/bin/env node
// NASR (source of truth) + OurAirports + CIFP runway records for KSFO → data/derived/ksfo-airport.json
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAW, arincLat, arincLon, csvObjects, unzipText, writeJSON } from './_util.mjs';

const nasrZip = join(RAW, 'nasr', readdirSync(join(RAW, 'nasr')).find((f) => f.endsWith('_APT_CSV.zip')));
const cifpZip = join(RAW, 'cifp', readdirSync(join(RAW, 'cifp')).find((f) => /^CIFP_\d+\.zip$/.test(f)));
const num = (s) => (s === '' || s == null ? null : +s);

const base = csvObjects(unzipText(nasrZip, 'APT_BASE.csv')).find((r) => r.ARPT_ID === 'SFO' && r.SITE_TYPE_CODE === 'A');
const rwys = csvObjects(unzipText(nasrZip, 'APT_RWY.csv')).filter((r) => r.SITE_NO === base.SITE_NO);
const ends = csvObjects(unzipText(nasrZip, 'APT_RWY_END.csv')).filter((r) => r.SITE_NO === base.SITE_NO);

const nasr = {
  effective: base.EFF_DATE, siteNo: base.SITE_NO, icao: base.ICAO_ID, faa: base.ARPT_ID, name: base.ARPT_NAME,
  lat: +base.LAT_DECIMAL, lon: +base.LONG_DECIMAL, elevFt: +base.ELEV,
  magVar: (base.MAG_HEMIS === 'W' ? -1 : 1) * +base.MAG_VARN, magVarYear: +base.MAG_VARN_YEAR,
  runways: rwys.map((r) => ({ id: r.RWY_ID, lengthFt: +r.RWY_LEN, widthFt: +r.RWY_WIDTH, surface: r.SURFACE_TYPE_CODE })),
  ends: ends.map((e) => ({
    runway: e.RWY_ID, id: e.RWY_END_ID.replace(/^0/, ''), trueHeading: +e.TRUE_ALIGNMENT, ils: e.ILS_TYPE || null,
    endLat: +e.LAT_DECIMAL, endLon: +e.LONG_DECIMAL, endElevFt: num(e.RWY_END_ELEV),
    displacedThrLat: num(e.LAT_DISPLACED_THR_DECIMAL), displacedThrLon: num(e.LONG_DISPLACED_THR_DECIMAL), displacedThrLenFt: num(e.DISPLACED_THR_LEN) ?? 0,
    tdzeFt: num(e.TDZ_ELEV), tchFt: num(e.THR_CROSSING_HGT), glidePathDeg: num(e.VISUAL_GLIDE_PATH_ANGLE), approachLights: e.APCH_LGT_SYSTEM_CODE || null,
    toraFt: num(e.TKOF_RUN_AVBL), ldaFt: num(e.LNDG_DIST_AVBL), rightTraffic: e.RIGHT_HAND_TRAFFIC_PAT_FLAG === 'Y',
  })),
};

const oaAir = csvObjects(readFileSync(join(RAW, 'ourairports/airports.csv'), 'utf8')).find((r) => r.ident === 'KSFO');
const oaRwy = csvObjects(readFileSync(join(RAW, 'ourairports/runways.csv'), 'utf8')).filter((r) => r.airport_ident === 'KSFO');
const ourairports = {
  lat: +oaAir.latitude_deg, lon: +oaAir.longitude_deg, elevFt: +oaAir.elevation_ft,
  ends: oaRwy.flatMap((r) => [
    { id: r.le_ident, lat: +r.le_latitude_deg, lon: +r.le_longitude_deg, elevFt: num(r.le_elevation_ft), trueHeading: num(r.le_heading_degT), displacedThrFt: num(r.le_displaced_threshold_ft) ?? 0, lengthFt: +r.length_ft },
    { id: r.he_ident, lat: +r.he_latitude_deg, lon: +r.he_longitude_deg, elevFt: num(r.he_elevation_ft), trueHeading: num(r.he_heading_degT), displacedThrFt: num(r.he_displaced_threshold_ft) ?? 0, lengthFt: +r.length_ft },
  ]),
};

// CIFP PG records: lat/lon is the landing threshold; bearing is magnetic ×10.
const cifpLines = unzipText(cifpZip, 'FAACIFP18').split('\n');
const pg = cifpLines.filter((l) => l.startsWith('SUSAP KSFOK2G'));
const pa = cifpLines.find((l) => l.startsWith('SUSAP KSFOK2A'));
const cifp = {
  cycle: pa.slice(128, 132), airportLat: arincLat(pa.slice(32, 41)), airportLon: arincLon(pa.slice(41, 51)), elevFt: +pa.slice(56, 61), magVar: (pa.slice(51, 52) === 'W' ? -1 : 1) * +pa.slice(52, 56) / 10,
  ends: pg.map((l) => ({
    id: l.slice(15, 18).trim(), lengthFt: +l.slice(22, 27), magBearing: +l.slice(27, 31) / 10, thrLat: arincLat(l.slice(32, 41)), thrLon: arincLon(l.slice(41, 51)),
    thrElevFt: +l.slice(66, 71), displacedThrFt: +l.slice(71, 75), tchFt: +l.slice(75, 77), widthFt: +l.slice(77, 80), locIdent: l.slice(81, 85).trim() || null, ilsCategory: l.slice(85, 86).trim() || null,
  })),
};

writeJSON('ksfo-airport.json', { generated: 'tools/derive-airport.mjs', nasr, ourairports, cifp });
