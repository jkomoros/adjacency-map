import {
	deepCopy
} from './util.js';

import {
	SimpleGraph,
	NodeID,
	ParentGraph
} from './types.js';

export const incomingGraph = (graph : SimpleGraph) : SimpleGraph => {
	const result : SimpleGraph = {};
	for (const [nodeID, edges] of Object.entries(graph)) {
		//Make sure that even nodes with no incoming edges show up in result
		if (!result[nodeID]) result[nodeID] = {};
		for (const ref of Object.keys(edges)) {
			if (!result[ref]) result[ref] = {};
			result[ref][nodeID] = true;
		}
	}
	return result;
};

export const topologicalSort = (graph : SimpleGraph) : NodeID[] => {
	//https://stackoverflow.com/questions/4168/graph-serialization/4577#4577
	const result : NodeID[] = [];
	const workingGraph = deepCopy(graph);
	const incoming = incomingGraph(workingGraph);
	const noIncomingEdges = Object.entries(incoming).filter(entry => Object.keys(entry[1]).length == 0).map(entry => entry[0]);
	while (noIncomingEdges.length) {
		const id = noIncomingEdges.shift() as NodeID;
		result.push(id);
		const outbound = workingGraph[id];
		for (const outboundRef of Object.keys(outbound)) {
			delete workingGraph[id][outboundRef];
			const incoming = incomingGraph(workingGraph);
			if (Object.keys(incoming[outboundRef] || {}).length) continue;
			noIncomingEdges.push(outboundRef);
		}
	}
	if (result.length < Object.keys(graph).length) throw new Error('Cycle detected');
	return result;
};

//Given a DAG that might be tangled, return a subset SimpleGraph where each node
//has precisely one parent and the retained parent is the one that will create
//the longest path back to root.
export const tidyLongestTree = (dag : SimpleGraph) : ParentGraph => {
	if (Object.keys(dag).length == 0) return {};
	//https://www.geeksforgeeks.org/find-longest-path-directed-acyclic-graph/
	const topo = topologicalSort(dag);
	topo.reverse();
	const rootID = topo[0];
	const lengths = Object.fromEntries(topo.map(id => [id, Number.NEGATIVE_INFINITY]));
	lengths[rootID] = 0;
	const parents : ParentGraph = {};
	const weight = 1;
	for (const id of topo) {
		for (const other of Object.keys(dag[id])) {
			if (lengths[id] < lengths[other] + weight) {
				lengths[id] = lengths[other] + weight;
				parents[id] = other;
			}
		}
	}
	return parents;
};