export interface SearchClause {
  exclude: boolean;
  source: string;
  regex: RegExp;
}

export interface SearchQuery {
  clauses: SearchClause[];
  groups: SearchClause[][];
  test(text: string): boolean;
  matchingClauses(text: string): SearchClause[];
}

const MAX_QUERY_LENGTH = 500;
const MAX_REGEX_LENGTH = 160;

function literalPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeRegex(source: string): RegExp {
  if (!source) throw new Error("empty regex");
  if (source.length > MAX_REGEX_LENGTH) throw new Error("regex is too long");
  // CloudWatch-style filter regexes deliberately omit grouping and backrefs.
  // Besides keeping the syntax predictable, that excludes the common nested-
  // quantifier shapes that can stall Node's backtracking regexp engine.
  if (/[()]/.test(source) || /\\[1-9]/.test(source) || /\(\?[<!=:]/.test(source))
    throw new Error("regex groups and backreferences are not supported");
  try {
    return new RegExp(source, "i");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "invalid regex");
  }
}

export function parseSearchQuery(raw: string): SearchQuery {
  if (raw.length > MAX_QUERY_LENGTH) throw new Error("search query is too long");
  const clauses: SearchClause[] = [];
  const groups: SearchClause[][] = [[]];
  let i = 0;
  while (i < raw.length) {
    while (/\s/.test(raw[i] ?? "")) i += 1;
    if (i >= raw.length) break;
    let exclude = false;
    if (raw[i] === "-") {
      exclude = true;
      i += 1;
    }
    if (i >= raw.length || /\s/.test(raw[i] ?? "")) throw new Error("'-' must prefix a term");
    const delimiter = raw[i] === '"' ? '"' : raw[i] === "%" ? "%" : null;
    let value = "";
    if (delimiter) {
      i += 1;
      while (i < raw.length && raw[i] !== delimiter) {
        if (raw[i] === "\\" && delimiter === '"' && i + 1 < raw.length) i += 1;
        value += raw[i] ?? "";
        i += 1;
      }
      if (raw[i] !== delimiter)
        throw new Error(`unclosed ${delimiter === '"' ? "quote" : "regex"}`);
      i += 1;
      if (i < raw.length && !/\s/.test(raw[i] ?? ""))
        throw new Error("add a space after a quoted term");
    } else {
      while (i < raw.length && !/\s/.test(raw[i] ?? "")) {
        value += raw[i] ?? "";
        i += 1;
      }
    }
    if (!value) throw new Error("empty search term");
    if (!delimiter && !exclude && value.toUpperCase() === "OR") {
      if (!groups.at(-1)?.length) throw new Error("OR must follow a search term");
      groups.push([]);
      continue;
    }
    const clause = {
      exclude,
      source: value,
      regex: delimiter === "%" ? safeRegex(value) : new RegExp(literalPattern(value), "i"),
    };
    clauses.push(clause);
    groups.at(-1)?.push(clause);
  }
  if (groups.length > 1 && !groups.at(-1)?.length) throw new Error("OR must precede a search term");
  const matchingGroup = (text: string) =>
    groups.find((group) => group.every((clause) => clause.exclude !== clause.regex.test(text)));
  return {
    clauses,
    groups,
    test(text: string) {
      return !!matchingGroup(text);
    },
    matchingClauses(text: string) {
      return matchingGroup(text) ?? [];
    },
  };
}
