export function readyNodes(nodes = []) {
  const done = new Set(nodes.filter(node => node.status === 'DONE').map(node => node.node_id));
  return nodes.filter(node => !['DONE', 'BLOCKED'].includes(node.status) && (node.depends_on || []).every(id => done.has(id)));
}

export function validateDag(nodes = []) {
  const visiting = new Set(); const visited = new Set(); const map = new Map(nodes.map(node => [node.node_id, node]));
  const visit = id => { if (visiting.has(id)) return false; if (visited.has(id)) return true; visiting.add(id); for (const dep of map.get(id)?.depends_on || []) if (!map.has(dep) || !visit(dep)) return false; visiting.delete(id); visited.add(id); return true; };
  const valid = nodes.every(node => visit(node.node_id)); return { valid, source: 'DAG dependency graph', measurement_type: 'exact', timestamp: new Date().toISOString() };
}
