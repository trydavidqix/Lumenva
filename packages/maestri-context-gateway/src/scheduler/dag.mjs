export function readyNodes(nodes=[]){
  const done=new Set(nodes.filter(node=>node.status==='DONE').map(node=>node.node_id));
  return nodes.filter(node=>!['DONE','BLOCKED','CANCELLED','RUNNING','APPROVAL_REQUIRED'].includes(node.status)&&(node.depends_on||[]).every(id=>done.has(id)));
}
export function validateDag(nodes=[]){
  const visiting=new Set(),visited=new Set(),map=new Map();
  for(const node of nodes){if(!node?.node_id||map.has(node.node_id))return {valid:false,error:'missing or duplicate node_id',source:'DAG dependency graph',measurement_type:'exact',timestamp:new Date().toISOString()};map.set(node.node_id,node);}
  const visit=id=>{if(visiting.has(id))return false;if(visited.has(id))return true;visiting.add(id);for(const dep of map.get(id)?.depends_on||[])if(!map.has(dep)||!visit(dep))return false;visiting.delete(id);visited.add(id);return true;};
  const valid=nodes.every(node=>visit(node.node_id));
  return {valid,error:valid?null:'cycle or missing dependency',source:'DAG dependency graph',measurement_type:'exact',timestamp:new Date().toISOString()};
}
