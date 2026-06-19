// Public surface of the stable model — single import point for the client UI and
// the authoritative server.
export type * from "./types";
export {
  STABLE_VERSION,
  PERK_MAX,
  createDefaultStable,
  recruit,
  attributeCost,
  buyAttributePoint,
  perkCost,
  buyPerk,
  healCost,
  heal,
  effectiveAttributes,
  gladiatorToUnitSpec,
  parseStable,
} from "./model";
