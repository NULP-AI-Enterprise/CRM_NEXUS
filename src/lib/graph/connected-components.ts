/** Path-compressed union-find over an arbitrary edge list. Returns a
 * `nodeId -> componentRoot` map covering only nodes that appear in at least
 * one edge — a node absent from the map is its own singleton component. No
 * framework/runtime dependency, so this is safe to import from server code,
 * client components, or plain data layers alike. */
export function partitionIntoComponents(edges: ReadonlyArray<readonly [string, string]>): Map<string, string> {
  const parent = new Map<string, string>();

  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!;
    let cursor = x;
    while (parent.get(cursor) !== undefined && parent.get(cursor) !== root) {
      const next = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };

  const union = (a: string, b: string) => {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };

  for (const [a, b] of edges) union(a, b);

  const result = new Map<string, string>();
  for (const node of parent.keys()) result.set(node, find(node));
  return result;
}
