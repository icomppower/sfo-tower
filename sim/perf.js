// Aircraft performance from data/derived/aircraft.json (FAA ACD approach speeds, CWT/SRS from JO 7360.1K) + simple kinematic limits.
// Turn rate: standard rate 3°/s limited by 25° bank (ICAO PANS-OPS: rate = 1091·tan(bank)/TAS).
export function buildPerf(acJson) {
  const types = {};
  for (const t of Object.values(acJson.types)) {
    const heavy = t.faaWeight === 'Heavy' || t.faaWeight === 'Super';
    const jet = t.engine === 'Jet';
    const small = t.faaWeight === 'Small';
    types[t.icao] = {
      icao: t.icao, model: t.model, cwt: t.cwt, srs: t.srs, weight: t.faaWeight, aac: t.aac, wingspanFt: t.wingspanFt,
      vApp: t.approachSpeedKt, // final approach speed (ACD)
      vRef: t.approachSpeedKt, vR: Math.round(t.approachSpeedKt * (jet ? 1.05 : 1.1)),
      vMax: small ? Math.min(160, t.approachSpeedKt * 2) : 250, // FAR 91.117: 250 kt below 10,000 ft
      vClean: small ? Math.min(140, t.approachSpeedKt * 1.8) : jet ? 210 : 180,
      climbFpm: small ? 700 : jet ? (heavy ? 2000 : 2500) : 1500, descentFpm: small ? 800 : 1800,
      accelKts: small ? 1.5 : jet ? 2.2 : 1.8, decelKts: small ? 2 : 1.2, // air; ground roll uses accelGround
      accelGround: small ? 3.5 : heavy ? 3.3 : 4.0, brakeKts: small ? 3 : 2.6,
      rolloutFt: small ? 2500 : heavy ? 6500 : 5200, // typical runway occupancy footprint to a high-speed exit
      maxBank: small ? 20 : 25, isJet: jet, heavy, small,
    };
  }
  return types;
}
export const turnRate = (perf, tas) => Math.min(3, 1091 * Math.tan(perf.maxBank * Math.PI / 180) / Math.max(60, tas));
export const iasToTas = (ias, altFt) => ias * (1 + altFt / 1000 * 0.02);
