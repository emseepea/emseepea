const contractKeys = ["allowed", "forbidden", "required", "totalCalls"];
const contractKeysWithoutForbidden = ["allowed", "required", "totalCalls"];
const requiredKeys = ["maxCalls", "minCalls", "name"];
const allowedKeys = ["maxCalls", "name"];
const totalKeys = ["maxCalls", "minCalls"];

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function name(value) {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function count(value, minimum) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}

function compareToolNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalToolNames(names) {
  return [...names].sort(compareToolNames);
}

export function normalizeToolSelectionContract(contract, advertisedToolNames) {
  if (!(exactKeys(contract, contractKeys) || exactKeys(contract, contractKeysWithoutForbidden))
    || !Array.isArray(contract.required) || !Array.isArray(contract.allowed)
    || (contract.forbidden !== undefined && !Array.isArray(contract.forbidden))
    || !exactKeys(contract.totalCalls, totalKeys)) {
    throw new TypeError("Tool-selection contract has an invalid shape");
  }
  if (!Array.isArray(advertisedToolNames) || advertisedToolNames.some((toolName) => !name(toolName))
    || new Set(advertisedToolNames).size !== advertisedToolNames.length) {
    throw new TypeError("Advertised tool names must be unique non-empty strings");
  }

  const required = contract.required.map((entry) => {
    if (!exactKeys(entry, requiredKeys) || !name(entry.name)
      || !count(entry.minCalls, 1) || !count(entry.maxCalls, entry.minCalls)) {
      throw new TypeError("Required tools need a name and valid minimum and maximum call counts");
    }
    return { name: entry.name, minCalls: entry.minCalls, maxCalls: entry.maxCalls };
  }).sort((left, right) => compareToolNames(left.name, right.name));
  const allowed = contract.allowed.map((entry) => {
    if (!exactKeys(entry, allowedKeys) || !name(entry.name) || !count(entry.maxCalls, 1)) {
      throw new TypeError("Allowed tools need a name and a positive maximum call count");
    }
    return { name: entry.name, maxCalls: entry.maxCalls };
  }).sort((left, right) => compareToolNames(left.name, right.name));
  const forbidden = canonicalToolNames(contract.forbidden ?? []);
  if (forbidden.some((toolName) => !name(toolName))) {
    throw new TypeError("Forbidden tools must be non-empty strings");
  }
  const named = [...required.map(({ name: toolName }) => toolName),
    ...allowed.map(({ name: toolName }) => toolName), ...forbidden];
  if (new Set(named).size !== named.length) {
    throw new TypeError("Required, allowed, and forbidden tools must be disjoint and unique");
  }
  const advertised = new Set(advertisedToolNames);
  if (named.some((toolName) => !advertised.has(toolName))) {
    throw new TypeError("Every tool-selection contract name must be advertised");
  }
  if (required.length + allowed.length === 0) {
    throw new TypeError("Tool-selection contract must permit at least one tool");
  }

  const { minCalls, maxCalls } = contract.totalCalls;
  if (!count(minCalls, 0) || !count(maxCalls, minCalls)) {
    throw new TypeError("Total call counts must be finite safe integers in ascending order");
  }
  const requiredMinimum = required.reduce((total, entry) => total + entry.minCalls, 0);
  const permittedMaximum = [...required, ...allowed].reduce((total, entry) => total + entry.maxCalls, 0);
  if (!Number.isSafeInteger(requiredMinimum) || !Number.isSafeInteger(permittedMaximum)
    || minCalls < requiredMinimum || maxCalls > permittedMaximum) {
    throw new TypeError("Total call counts must fit the declared per-tool cardinalities");
  }

  return freeze({
    required,
    allowed,
    forbidden,
    totalCalls: { minCalls, maxCalls },
  });
}

export function toolSelectionContractSatisfied(contract, calls) {
  if (!Array.isArray(calls) || calls.some((call) => !call || !name(call.name))) return false;
  if (calls.length < contract.totalCalls.minCalls || calls.length > contract.totalCalls.maxCalls) return false;
  const rules = new Map([
    ...contract.required.map((entry) => [entry.name, entry]),
    ...contract.allowed.map((entry) => [entry.name, { ...entry, minCalls: 0 }]),
  ]);
  const counts = new Map();
  for (const { name: toolName } of calls) {
    if (!rules.has(toolName)) return false;
    counts.set(toolName, (counts.get(toolName) ?? 0) + 1);
  }
  return [...rules].every(([toolName, rule]) => {
    const actual = counts.get(toolName) ?? 0;
    return actual >= rule.minCalls && actual <= rule.maxCalls;
  });
}
