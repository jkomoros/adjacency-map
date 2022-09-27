import {
	deepCopy
} from './util.js';

import {
	SimpleGraph,
	NodeID
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