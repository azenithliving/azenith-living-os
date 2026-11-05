import ts from "typescript";
import { arDigits } from "../ops/metricLabels.ts";

export type ModuleNode = {
  exports: string[];
  imports: { from: string; names: string[] }[];
  bindings?: Record<string, string>;
  reexports?: { from: string; imported: string; exported: string }[];
  references?: string[];
  opaqueImports?: boolean;
};
export type ModuleGraph = Record<string, ModuleNode>;
export type Reachability = "live" | "uncalled" | "unreached" | "unknown";

const EXT = /\.(ts|tsx|mjs|js|jsx)$/;

export function normalizePath(path: string): string {
  const clean = path.split("\\").join("/").replace(/^\.\//, "").replace(/^@\//, "");
  return clean.replace(EXT, "");
}

function resolveFrom(importer: string, from: string): string {
  if (!from.startsWith(".")) return normalizePath(from);
  const base = importer.split("/").slice(0, -1);
  const parts = from.split("/");
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return normalizePath(base.join("/"));
}

export function exportedSymbolAt(source: string, index: number): string {
  const tree = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true);
  for (const statement of tree.statements) {
    if (index < statement.getStart(tree) || index >= statement.end) continue;
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) return statement.name?.text ?? "default";
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find((node) => index >= node.getStart(tree) && index < node.end);
      if (declaration && ts.isIdentifier(declaration.name)) return declaration.name.text;
    }
    if (ts.isExportAssignment(statement)) return "default";
  }
  return "module";
}

export function buildGraphFromSources(sources: Record<string, string>): ModuleGraph {
  const graph: ModuleGraph = {};
  for (const [file, source] of Object.entries(sources)) {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const node: ModuleNode = { exports: [], imports: [], bindings: {}, reexports: [], references: [] };
    const references = new Set<string>();
    const addExport = (name: string, local = name) => {
      node.exports.push(name);
      node.bindings![name] = local;
    };
    for (const statement of tree.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const clause = statement.importClause;
        if (clause?.isTypeOnly) continue;
        const names: string[] = [];
        if (!clause) names.push("*");
        if (clause?.name) names.push("default");
        if (clause?.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) names.push("*");
          else for (const item of clause.namedBindings.elements) {
            if (!item.isTypeOnly) names.push((item.propertyName ?? item.name).text);
          }
        }
        if (names.length) node.imports.push({ from: statement.moduleSpecifier.text, names });
        continue;
      }
      if (ts.isExportDeclaration(statement)) {
        if (statement.isTypeOnly) continue;
        const from = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null;
        const clause = statement.exportClause;
        if (clause && ts.isNamedExports(clause)) {
          const names: string[] = [];
          for (const item of clause.elements) {
            if (item.isTypeOnly) continue;
            const imported = (item.propertyName ?? item.name).text;
            addExport(item.name.text, imported);
            names.push(imported);
            if (from) node.reexports!.push({ from, imported, exported: item.name.text });
          }
          if (from && names.length) node.imports.push({ from, names });
        } else if (from) {
          node.imports.push({ from, names: ["*"] });
          node.reexports!.push({ from, imported: "*", exported: clause?.name.text ?? "*" });
        }
        continue;
      }
      const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
      if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const isDefault = modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
        if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
          const local = statement.name?.text ?? "default";
          addExport(isDefault ? "default" : local, local);
        } else if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name)) addExport(declaration.name.text);
          }
        }
      }
      if (ts.isExportAssignment(statement)) addExport("default", ts.isIdentifier(statement.expression) ? statement.expression.text : "default");
      const visit = (child: ts.Node): void => {
        if (ts.isTypeNode(child)) return;
        if (ts.isIdentifier(child) && !("name" in child.parent && child.parent.name === child)) references.add(child.text);
        if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const argument = child.arguments[0];
          if (!argument || !ts.isStringLiteralLike(argument)) node.opaqueImports = true;
          else {
            const parent = ts.isAwaitExpression(child.parent) ? child.parent.parent : child.parent;
            const names = ts.isVariableDeclaration(parent) && ts.isObjectBindingPattern(parent.name)
              ? parent.name.elements.map((item) => item.dotDotDotToken ? "*" : (item.propertyName ?? item.name).getText(tree))
              : ["*"];
            node.imports.push({ from: argument.text, names });
          }
        }
        ts.forEachChild(child, visit);
      };
      visit(statement);
    }
    node.references = [...references];
    graph[file] = node;
  }
  return graph;
}

/** Files the platform runs on its own: pages, layouts and service doors. */
export function isEntryFile(path: string): boolean {
  const clean = path.split("\\").join("/");
  return (
    /^app\//.test(clean) &&
    /\/(page|layout|template|loading|error|not-found|route)\.(tsx|ts)$/.test(clean) &&
    !clean.includes("/actions/")
  );
}

export function symbolReachability(
  file: string,
  symbol: string,
  graph: ModuleGraph,
  entryFiles: string[],
  seen = new Set<string>(),
): Reachability {
  const nodes = Object.entries(graph);
  const paths = new Set(nodes.map(([path]) => normalizePath(path)));
  const target = normalizePath(file);
  const key = `${target}#${symbol}`;
  // Cutting a cycle is this scan's own limit, not a verdict about the code: it says «we stopped
  // looking», never «there is no path».
  if (seen.has(key)) return "unknown";
  if (entryFiles.some((entry) => normalizePath(entry) === target)) return "live";
  const targetNode = nodes.find(([path]) => normalizePath(path) === target)?.[1];
  if (!targetNode) return "unknown";
  const nextSeen = new Set(seen).add(key);
  const names = new Set([symbol, ...Object.entries(targetNode.bindings ?? {}).filter(([, local]) => local === symbol).map(([name]) => name)]);
  let hasImporter = false;
  let uncertain = false;
  for (const [other, node] of nodes) {
    for (const imp of node.imports) {
      const resolved = resolveFrom(other, imp.from);
      if ((paths.has(resolved) ? resolved : `${resolved}/index`) !== target) continue;
      if (symbol !== "*" && !imp.names.some((name) => name === "*" || names.has(name))) continue;
      hasImporter = true;
      const reexports = node.reexports?.filter((edge) => edge.from === imp.from && (edge.imported === "*" || names.has(edge.imported)));
      const nextSymbols = reexports?.length
        ? reexports.map((edge) => edge.exported === "*" ? symbol : edge.exported)
        : ["*"];
      for (const nextSymbol of nextSymbols) {
        const state = symbolReachability(other, nextSymbol, graph, entryFiles, nextSeen);
        if (state === "live") return "live";
        if (state === "unknown") uncertain = true;
      }
    }
  }
  if (uncertain) return "unknown";
  if (hasImporter) return "unreached";
  if (symbol !== "*" && (symbol === "module" || !targetNode.exports.some((name) => names.has(name)) || targetNode.references?.includes(symbol))) {
    const state = symbolReachability(file, "*", graph, entryFiles, nextSeen);
    return state === "live" || state === "unknown" ? "unknown" : state;
  }
  return "uncalled";
}

export type ReachabilityTally = Record<Reachability, number>;
export type Reached<P> = P & { symbol: string; reach: Reachability };

/** A name asked in two places is judged by the strongest place: one dormant caller proves nothing about the other. */
const RANK: Record<Reachability, number> = { live: 0, unknown: 1, unreached: 2, uncalled: 3 };

export function classifyBySymbol<P extends { file: string; at: number; sites?: number[] }>(
  phantoms: P[],
  sources: Record<string, string>,
): Record<Reachability, Reached<P>[]> & { all: Reached<P>[]; tally: ReachabilityTally } {
  const graph = buildGraphFromSources(sources);
  const entries = Object.keys(sources).filter(isEntryFile);
  const opaque = Object.values(graph).some((node) => node.opaqueImports);
  const result: Record<Reachability, Reached<P>[]> = { live: [], uncalled: [], unreached: [], unknown: [] };
  const all: Reached<P>[] = [];
  for (const phantom of phantoms) {
    const source = sources[phantom.file];
    let symbol = "ما اتقارش";
    let site = phantom.at;
    let reach: Reachability | null = null;
    if (source !== undefined) {
      const sites = phantom.sites?.length ? phantom.sites : [phantom.at];
      for (const candidate of sites) {
        const siteSymbol = exportedSymbolAt(source, candidate);
        const state = symbolReachability(phantom.file, siteSymbol, graph, entries);
        const best: Reachability = opaque && state !== "live" ? "unknown" : state;
        if (reach === null || RANK[best] < RANK[reach]) {
          reach = best;
          symbol = siteSymbol;
          site = candidate;
        }
      }
    }
    if (reach === null) reach = "unknown";
    const reached = { ...phantom, at: site, symbol, reach };
    result[reach].push(reached);
    all.push(reached);
  }
  return {
    ...result,
    all,
    tally: { live: result.live.length, uncalled: result.uncalled.length, unreached: result.unreached.length, unknown: result.unknown.length },
  };
}

export function formatReachabilityLine(tally: ReachabilityTally | null): string {
  if (!tally) return "ما اتقارش: روابط الاستيراد ما اتحسبتش";
  return `فحص الكود مش إثبات تشغيل: مسار ظاهر ${arDigits(tally.live)} · بلا استيراد ظاهر ${arDigits(tally.uncalled)} · مسار غير موصول ${arDigits(tally.unreached)} · ما اتقارش ${arDigits(tally.unknown)}`;
}
