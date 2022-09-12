import { BaseSimulator } from "./simulator.js";

import { 
	Graph,
	inflateGraph,
}from './graph/graph.js';

import {
	RectangleGraph
} from './graph/rectangle.js';

import {
	shuffleInPlace,
	randomString,
	Urn
} from './util.js';

import {
	GraphData,
	GraphEdge,
	GraphExplorationEdgeScorer,
	GraphNodeID,
	GraphNodeValues,
	PartialSimulationFrame,
	RandomGenerator,
	SimOptions,
	SimulationFrame
} from './types.js';

export type Agent = {
	id : string;
	node? : GraphNodeID;
	emoji? : string;
	type? : string;
	x? : number;
	y? : number;
	height? : number;
	width? : number;
};

type AgentSimulationFrameExtra = {
	agents : Agent[],
	graph: GraphData,
}

type AgentPartialSimulationFrame = PartialSimulationFrame & AgentSimulationFrameExtra;

export type AgentSimulationFrame = SimulationFrame & AgentSimulationFrameExtra;

export type NodeScorer = (neighbor : GraphNodeValues, length : number, path : GraphEdge[]) => number;

export type RowColOptionalSimOptions = SimOptions & {
	rows? : number;
	cols? : number;
}

type AnyNodeTicker = {
	[name : string] : (node : GraphNodeValues, graph : Graph, frame : AgentSimulationFrame, rnd : RandomGenerator) => GraphNodeValues;
}

type AnyAgentTicker = {
	[name : string] : (agent : Agent, agents : Agent[], graph : Graph, frame : AgentSimulationFrame, rnd : RandomGenerator) => Agent | Agent[];
}

export class AgentSimulator extends BaseSimulator {

	/*
		An override point for your generateFirstFrame. You should return the
		graph that agents will traverse. You might also want to override
		graphConstructor.
	*/
	generateGraph(simOptions : RowColOptionalSimOptions, _rnd : RandomGenerator, simWidth : number, simHeight : number) : Graph {
		return RectangleGraph.make(simOptions.rows || 5, simOptions.cols || 5, simWidth, simHeight);
	}

	//baseAgent returns an object with just a random, stable ID 
	baseAgent(rnd : RandomGenerator) : Agent {
		return {
			//By having a stable ID, animations in lit can happen correctly
			//because we can detect identity of an agent when stamping templates.
			id: randomString(6, rnd)
		};
	}

	/*
		An override point, the default generateAgents will call this when it's
		decided a location to generate an agent. parentAgent should be the
		parent that it's spawning from, but is likely null. otherAgents includes
		other agents that exist so far. An agent must be an object, not an
		array. Your return value should extend this.baseAgent(rnd);
	*/
	generateAgent(_parentAgent : Agent, _otherAgents : Agent[], _graph : Graph, _simOptions : SimOptions, rnd : RandomGenerator) : Agent {
		return {
			...this.baseAgent(rnd)
			//Your own properties would go here in your own generateAgent
		};
	}

	/*
		An override point for how many agents to generate by default.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	numStarterAgents(_graph : Graph, _simOptions : SimOptions, _rnd : RandomGenerator) : number {
		return 0;
	}

	/*
		An override point to allow multiple agents to exist in a given cell at a
		time. It is called for each pair of agents that might overlap. For
		example, you could return true unless the type property of each was the
		same.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	allowOverlappingAgents(_primaryAgent : Agent, _secondaryAgent : Agent, _graph : Graph, _simOptions : SimOptions, _rnd : RandomGenerator) : boolean {
		return false;
	}

	allowAgentToOverlapWith(primaryAgent : Agent, secondaryAgent : Agent, graph : Graph, simOptions : SimOptions, rnd : RandomGenerator) : boolean {
		if (!primaryAgent || !secondaryAgent) return true;
		return this.allowOverlappingAgents(primaryAgent, secondaryAgent, graph, simOptions, rnd);
	}

	/*
		An override point for skipping placing agents at the beginning.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	skipPlacingAgents(_graph : Graph, _simOptions : SimOptions, _rnd : RandomGenerator) : boolean {
		return false;
	}

	/*
		Emit your starter set of agents. This will generate
		this.numStarterAgents() number of agents by calling this.generateAgent()
		and randomly place them in the graph (unless skipPlacingAgents()) with no
		overlap.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	generateAgents(graph : Graph, simOptions : SimOptions, rnd : RandomGenerator, _simWidth : number, _simHeight : number) : Agent[] {
		const agents = [];
		const baseAvailableNodes = {...graph.nodes()};
		const agentCount = this.numStarterAgents(graph, simOptions, rnd);
		const skipPlacingAgents = this.skipPlacingAgents(graph, simOptions, rnd);
		for (let i = 0; i < agentCount; i++) {
			const agent = this.generateAgent(null, agents, graph, simOptions, rnd);
			if (!skipPlacingAgents) {
				const availableNodes = {...baseAvailableNodes};
				for (const existingAgent of agents) {
					if (this.allowAgentToOverlapWith(existingAgent, agent, graph, simOptions, rnd)) continue;
					delete availableNodes[existingAgent.node];
				}
				const nodeList = Object.keys(availableNodes);
				if (nodeList.length <= 0) throw new Error('There are no new unocuppied nodes for new agents to occupy');
				const node = nodeList[Math.floor(rnd() * nodeList.length)];
				agent.node = node;
			}
			agents.push(agent);
		}
		return agents;
	}

	/*
		A place to emit extra properties in the first frame.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	generateFirstFrameExtra(_simOptions : SimOptions, _rnd : RandomGenerator, _simWidth : number, _simHeight : number) : {[name : string] : unknown} {
		return {};
	}

	/* 
		Create the graph and the agents
	*/
	override generateFirstFrame(simOptions : SimOptions, rnd : RandomGenerator, simWidth : number, simHeight : number) : AgentPartialSimulationFrame {
		//The default generator will expand this with index and simOptions.
		const graph = this.generateGraph(simOptions, rnd, simWidth, simHeight);
		const agents = this.generateAgents(graph, simOptions, rnd, simWidth, simHeight);
		return {
			...(this.generateFirstFrameExtra(simOptions, rnd, simWidth, simHeight) || {}),
			agents,
			graph: graph.data
		};
	}

	/*
		Called on every frame for every agent. It dispatches to the right ticker
		based on the agent.type, calling <agent.type>AgentTick(). (So agent.type
		= 'ant' would call 'antAgentTick()'). For agents who don't have a type,
		or whose type doesn't have a ticker for it, it calls defaultAgentTick().

		agent is the agent that is being ticked. agents is a list of all agents,
		including this one, with the intermediate state of the unticked agents
		being in their states from last frame and the ticked agents being in
		their new state. Note that other agents that have already ticked and are
		dead might be null.

		Your method should return the agent data to store for agent. If no
		changes, just return agent. If your agent has changed, return a copy of
		agent with modifications. If the agent should die, return null. If you
		want to spawn agents, return an array where the first item is the
		original agent (or null) and the remaining items are new agents that
		should be spawned. The newly spawned agents won't be ticked this frame.
	*/
	agentTick(agent : Agent, agents : Agent[], graph : Graph, frame : AgentSimulationFrame, rnd : RandomGenerator) : Agent | Agent[] {
		const typ = agent.type || '';
		const typeMethod = typ + 'AgentTick';
		const thisTicker = (this as unknown) as AnyAgentTicker;
		if (thisTicker[typeMethod]) return thisTicker[typeMethod](agent, agents, graph, frame, rnd);
		return this.defaultAgentTick(agent, agents, graph, frame, rnd);
	}

	/*
		Called on each agent that doesn't have their own [type]AgentTick method.
		This will get called for every other agent. Return the new agent to store in
		frame. If no modifications you can return the agent as is. IF
		modifications, make a modified copy of agent and return that.

		see agentTick for more about behavior of arguments and return values.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	defaultAgentTick(agent : Agent, _agents : Agent[], _graph : Graph, _frame : AgentSimulationFrame, _rnd : RandomGenerator) : Agent | Agent[] {
		return agent;
	}

	/*
		Called on each node on each frame. By default it dispatches to methods
		called typNodeTick() if node has a type:typ. If no type is set, or no
		method matches the type, it dispatches to defaultNodeTick instead.
		Typically you leave this as is and change defaultNodeTick's behavior.
	*/
	nodeTick(node : GraphNodeValues, graph : Graph, frame : AgentSimulationFrame, rnd : RandomGenerator) : GraphNodeValues {
		const typ = node.type || '';
		const typeMethod = typ + 'NodeTick';
		const thisTicker = (this as unknown) as AnyNodeTicker;
		if (thisTicker[typeMethod]) return thisTicker[typeMethod](node, graph, frame, rnd);
		return this.defaultNodeTick(node, graph, frame, rnd);
	}

	//ply is how far afield to explore. nodeScorer(neighborNode, length, path)
	//should return a float. edgeScorer is passed to graph.shortestPath and may
	//be undefined. All candidates will be put in an urn with their floats as
	//their probability of being picked.
	selectNodeToMoveTo(agent : Agent, agents : Agent[], graph : Graph, frame : AgentSimulationFrame, rnd : RandomGenerator, ply = 1, nodeScorer : NodeScorer = () => 1.0, edgeScorer? : GraphExplorationEdgeScorer) : GraphNodeValues {
		const neighborsMap = graph.neighbors(agent.node, ply);
		//Agents might have nulls for agents who have already died this tick.
		const agentsByNode = Object.fromEntries(agents.filter(agent => agent).map(agent => [agent.node, agent]));
		for (const neighbor of Object.keys(neighborsMap)) {
			if (this.allowAgentToOverlapWith(agent, agentsByNode[neighbor], graph, frame.simOptions, rnd)) continue;
			delete neighborsMap[neighbor];
		}
		const urn = new Urn<GraphNodeValues>(rnd);
		for (const neighbor of Object.values(neighborsMap)) {
			const [length, shortestPath] = graph.shortestPath(agent.node, neighbor, edgeScorer);
			const score = nodeScorer(neighbor, length, shortestPath);
			urn.add(neighbor, score);
		}
		return urn.pick();
	}

	/*
		defaultNodeTick is the node ticker that is called each frame if there
		isn't an override ticker for this node type. Return the new node to
		store in the frame. If no modifications you can return node as is. If
		modifications, make a copy to modify and return that.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	defaultNodeTick(node : GraphNodeValues, _graph : Graph, _frame : AgentSimulationFrame, _rnd : RandomGenerator) : GraphNodeValues {
		return node;
	}

	/*
		If true, agents will be ticked in a random order each frame.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	randomizeAgentTickOrder(_simOptions : SimOptions) : boolean {
		return true;
	}

	/*
		An opportunity to spawn new agents in this frame. Return an array of
		agents to spawn.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	spawnAgents(_agents : Agent[], _graph : Graph, _frame : AgentSimulationFrame, _rnd : RandomGenerator) : Agent[] {
		return [];
	}

	/*
		An opportunity to do things in the frame before any agents or nodes are
		ticked. You can modify frame directly, but if you modify any sub-objects
		you should copy them.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
	framePreTick(_graph : Graph, _frame : AgentSimulationFrame, _rnd : RandomGenerator) : void {

	}

	/*
		An opportunity to do things to the frame after any agents and nodes have
		been ticked. You can modify frame directly, but if you modify any
		sub-objects you should copy them.
	*/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
	framePostTick(_graph : Graph, _frame : AgentSimulationFrame, _rnd : RandomGenerator) : void {

	}

	/*
		Ticks all agents, and all nodes.
	*/
	override generateFrame(frame : AgentSimulationFrame, rnd : RandomGenerator) : void {
		const graph = inflateGraph(frame.graph);
		const newAgents = [...frame.agents];
		const agentIterationOrder = [...frame.agents.keys()];
		this.framePreTick(graph, frame, rnd);
		if (this.randomizeAgentTickOrder(frame.simOptions)) {
			shuffleInPlace(agentIterationOrder, rnd);
		}
		for (const index of agentIterationOrder) {
			const agent = frame.agents[index];
			const result = this.agentTick(agent, newAgents, graph, frame, rnd);
			const newAgent = Array.isArray(result) ? result[0] : result;
			newAgents[index] = newAgent;
			if (Array.isArray(result)) {
				//We push any newly spawned agents onto the end of newAgents.
				//They won't be ticked this frame, because we already selected
				//the indexes to visit in which order, and they don't include these new agents.
				newAgents.push(...result.slice(1));
			}
		}
		//Filter out agents who died this tick (returned null)
		const filteredNewAgents = newAgents.filter(agent => agent);
		frame.agents = [...filteredNewAgents, ...this.spawnAgents(filteredNewAgents, graph, frame, rnd).filter(agent => agent)];
		for (const [id, node] of Object.entries(graph.nodes())) {
			const newNode = this.nodeTick(node, graph, frame, rnd);
			//If we set the node to the same values as it was, then the graph
			//will detect no changes were made.
			graph.setNode(id, newNode);
		}
		this.framePostTick(graph, frame, rnd);
		if (graph.changesMade) {
			frame.graph = graph.data;
			graph.saved();
		}
	}
}