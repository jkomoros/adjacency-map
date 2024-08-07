import {
	AnyAction
} from "redux";

import {
	UPDATE_FILENAME,
	DEFAULT_FILE_NAME,
	UPDATE_SCALE,
	SET_EDITING,
	UPDATE_SCENARIO_NAME,
	UPDATE_HOVERED_NODE_ID,
	UPDATE_HOVERED_EDGE_ID,
	UPDATE_SELECTED_NODE_ID,
	SET_SHOW_EDGES,
	SET_RENDER_GROUPS,
	UPDATE_SHOW_HIDDEN_VALUES,
	LOAD_SCENARIOS_OVERLAYS,
	RESET_SCENARIOS_OVERLAYS,
	BEGIN_EDITING_SCENARIO,
	REMOVE_EDITING_SCENARIO,
	UPDATE_EDITING_SCENARIO_DESCRIPTION,
	UPDATE_EDITING_SCENARIO_NAME,
	BEGIN_EDITING_NODE_VALUE,
	EDITING_UPDATE_NODE_VALUE,
	REMOVE_EDITING_NODE_VALUE,
	ADD_EDITING_NODE_EDGE,
	REMOVE_EDITING_NODE_EDGE,
	MODIFY_EDITING_NODE_EDGE
} from "../actions/data.js";

import {
	nodeIDFromLayoutID
} from "../adjacency-map.js";

import { DEFAULT_SCENARIO_NAME, ROOT_ID } from "../constants.js";

import {
	DataState,
	DataFilename,
	ScenarioName,
	ScenariosOverlays,
	NodeID,
	PropertyName,
	ScenarioNode,
	EdgeValue,
	EdgeValueMatchID,
	ScenarioWithExtends
} from "../types.js";

import {
	deepCopy,
	emptyScenarioNode,
	getEdgeValueMatchID
} from "../util.js";

const INITIAL_STATE : DataState = {
	filename: DEFAULT_FILE_NAME,
	scale: 1.0,
	scenarioName: '',
	editing: true,
	selectedLayoutID: undefined,
	hoveredLayoutID: undefined,
	hoveredEdgeID: undefined,
	showHiddenValues: false,
	showEdges: false,
	renderGroups: true,
	scenariosOverlays: {}
};

const addScenarioToScenariosOverlay = (filename: DataFilename, currentScenarioName : ScenarioName, newScenarioName: ScenarioName, currentOverlay : ScenariosOverlays) : ScenariosOverlays => {
	return {
		...currentOverlay,
		[filename]: {
			...(currentOverlay[filename] || {}),
			[newScenarioName]: {
				extends: currentScenarioName,
				description: 'A custom scenario based on ' + currentScenarioName,
				nodes: {}
			}
		}
	};
};

const removeScenarioFromScenariosOverlay = (filename : DataFilename, scenarioName : ScenarioName, currentOverlay : ScenariosOverlays) : ScenariosOverlays => {
	const result = deepCopy(currentOverlay);
	const fileOverlay = result[filename];
	if (fileOverlay) {
		delete fileOverlay[scenarioName];
		if (Object.keys(fileOverlay).length == 0) delete result[filename];
	}
	return result;
};

const prepareToEditNodeInOverlay = (state : DataState) : [ScenariosOverlays, ScenarioNode, NodeID, {[id : NodeID]: ScenarioNode}, ScenarioWithExtends, {[name : ScenarioName]: ScenarioWithExtends}] => {
	const filename = state.filename;
	const scenarioName = state.scenarioName;
	const currentOverlay = state.scenariosOverlays;
	//In most action creators, selectedNodeID is known to not be undefined. This
	//just handles the other cases with a minimum of fuss.
	const nodeID = nodeIDFromLayoutID(state.selectedLayoutID) || ROOT_ID;
	const result = deepCopy(currentOverlay);
	const filenameOverlay = result[filename];
	if (filenameOverlay == undefined) throw new Error('filename overlay unexpectededly not set');
	const scenarioOverlay = filenameOverlay[scenarioName];
	if (scenarioOverlay == undefined) throw new Error('scenarioOverlay unexpectedly not set');
	const nodes = scenarioOverlay.nodes;
	if (!nodes[nodeID]) nodes[nodeID] = emptyScenarioNode();
	const node = nodes[nodeID];
	return [result, node, nodeID, nodes, scenarioOverlay, filenameOverlay];
};

const beginEditingNodeValueInOverlay = (state : DataState, propertyName : PropertyName, value : number) : ScenariosOverlays => {
	const [result, node] = prepareToEditNodeInOverlay(state);
	const values = node.values;
	values[propertyName] = value;
	return result;
};

const updateEditingScenarioDescriptionInOverlay = (state : DataState, description : string) : ScenariosOverlays => {
	const items = prepareToEditNodeInOverlay(state);
	const result = items[0];
	const scenarioOverlay = items[4];
	scenarioOverlay.description = description;
	return result;
};

const updateEditingScenarioNameInOverlay = (state : DataState, newScenarioName : ScenarioName) : ScenariosOverlays => {
	const items = prepareToEditNodeInOverlay(state);
	const result = items[0];
	const filenameOverlay = items[5];
	const oldScenarioName = state.scenarioName;
	filenameOverlay[newScenarioName] = filenameOverlay[oldScenarioName];
	delete filenameOverlay[oldScenarioName];
	for (const otherScenario of Object.values(filenameOverlay)) {
		if (otherScenario.extends == oldScenarioName) otherScenario.extends = newScenarioName;
	}
	return result;
};

const editingUpdateNodeValueInOverlay = (state : DataState, propertyName : PropertyName, value: number) : ScenariosOverlays => {
	const [result, node] = prepareToEditNodeInOverlay(state);
	const values = node.values;
	values[propertyName] = value;
	return result;
};

const scenarioNodeIsEmpty = (node: ScenarioNode) : boolean => {
	if (Object.keys(node.values).length > 0) return false;
	if (node.edges.add.length > 0) return false;
	if (Object.keys(node.edges.remove).length > 0) return false;
	if (Object.keys(node.edges.modify).length > 0) return false;
	return true;
};

const removeEditingNodeValueInOverlay = (state : DataState, propertyName : PropertyName) : ScenariosOverlays => {
	const [result, node, nodeID, nodes] = prepareToEditNodeInOverlay(state);
	delete node.values[propertyName];
	//If that was the last property then remove the item
	if (scenarioNodeIsEmpty(node)) delete nodes[nodeID];
	return result;
};

const addEditingNodeEdgeInOverlay = (state : DataState, edge : EdgeValue) : ScenariosOverlays => {
	const [result, node, nodeID, nodes] = prepareToEditNodeInOverlay(state);
	const id = getEdgeValueMatchID(edge);
	let changesMade = false;
	for (const removal of Object.keys(node.edges.remove)) {
		if (removal != id) continue;
		changesMade = true;
		delete node.edges.remove[removal];
		break;
	}
	for (const previousID of Object.keys(node.edges.modify)) {
		if (previousID != id) continue;
		changesMade = true;
		node.edges.modify[previousID] = edge;
		break;
	}
	if (!changesMade) node.edges.add.push(edge);
	if (scenarioNodeIsEmpty(node)) delete nodes[nodeID];
	return result;
};

const removeEditingNodeEdgeInOverlay = (state : DataState, previousID : EdgeValueMatchID) : ScenariosOverlays => {
	const [result, node, nodeID, nodes] = prepareToEditNodeInOverlay(state);
	let changesMade = false;
	node.edges.add = node.edges.add.filter(addition => {
		if (getEdgeValueMatchID(addition) != previousID) return true;
		changesMade = true;
		return false;
	});
	for (const modifyID of Object.keys(node.edges.modify)) {
		//The previousID might not match what we were handed; we want to remove
		//the given edge anywhere it shows up.
		if (modifyID != previousID) continue;
		//DON'T mark changesMade, because we need to get rid of not just
		//changes, gbut also the whole item, which requires removing it.
		delete node.edges.modify[previousID];
		break;
	}
	if (!changesMade) {
		node.edges.remove[previousID] = true;
	}
	if (scenarioNodeIsEmpty(node)) delete nodes[nodeID];
	return result;
};

const SENTINEL_EDGE_VALUE : EdgeValue = {
	type: '@SENTINEL@',
};

//We accept previousEdge and newEdge because we might have made a modification
//to type/parent which would change which one we're touching.
const modifyEditingNodeEdgeInOverlay = (state : DataState, previousEdgeID: EdgeValueMatchID, newEdge? : EdgeValue) : ScenariosOverlays => { 
	const [result, node, nodeID, nodes] = prepareToEditNodeInOverlay(state);
	let changesMade = false;
	for (let i = 0; i < node.edges.add.length; i++) {
		if (getEdgeValueMatchID(node.edges.add[i]) != previousEdgeID) continue;
		if (!newEdge) {
			node.edges.add[i] = SENTINEL_EDGE_VALUE;
		} else {
			node.edges.add[i] = newEdge;
		}
		changesMade = true;
	}
	if (changesMade) node.edges.add = node.edges.add.filter(addition => addition != SENTINEL_EDGE_VALUE);
	//We use id/previousID because the thing we're keying off of is not our ID
	for (const previousID of Object.keys(node.edges.modify)) {
		if (previousID != previousEdgeID) continue;
		if (!newEdge) {
			delete node.edges.modify[previousID];
		} else {
			node.edges.modify[previousID] = newEdge;
		}
		changesMade = true;
	}
	//It's possible it's a modify that comes from a scneario above us.
	if (!changesMade && newEdge) node.edges.modify[previousEdgeID] = newEdge;
	if (scenarioNodeIsEmpty(node)) delete nodes[nodeID];
	return result;
};

const data = (state : DataState = INITIAL_STATE, action : AnyAction) : DataState => {
	switch (action.type) {
	case UPDATE_FILENAME:
		return {
			...state,
			scenarioName: DEFAULT_SCENARIO_NAME,
			filename: action.filename
		};
	case UPDATE_SCALE:
		return {
			...state,
			scale: action.scale
		};
	case SET_EDITING:
		return {
			...state,
			editing: action.editing
		};
	case UPDATE_SCENARIO_NAME:
		return {
			...state,
			scenarioName: action.scenarioName
		};
	case UPDATE_HOVERED_NODE_ID:
		return {
			...state,
			hoveredLayoutID: action.nodeID
		};
	case UPDATE_HOVERED_EDGE_ID:
		return {
			...state,
			hoveredEdgeID: action.edgeID
		};
	case UPDATE_SELECTED_NODE_ID:
		return {
			...state,
			selectedLayoutID: action.nodeID
		};
	case SET_SHOW_EDGES:
		return {
			...state,
			showEdges: action.on
		};
	case SET_RENDER_GROUPS:
		return {
			...state,
			renderGroups: action.on
		};
	case UPDATE_SHOW_HIDDEN_VALUES:
		return {
			...state,
			showHiddenValues: action.showHiddenValues
		};
	case LOAD_SCENARIOS_OVERLAYS:
		return {
			...state,
			scenariosOverlays: action.overlays
		};
	case RESET_SCENARIOS_OVERLAYS:
		return {
			...state,
			//TODO: go back to the scenario we extended that we were on previously if it exists
			scenarioName: '',
			scenariosOverlays: {}
		};
	case BEGIN_EDITING_SCENARIO:
		return {
			...state,
			scenarioName: action.scenarioName,
			scenariosOverlays: addScenarioToScenariosOverlay(state.filename, state.scenarioName, action.scenarioName, state.scenariosOverlays)
		};
	case REMOVE_EDITING_SCENARIO: 
		return {
			...state,
			scenarioName: state.scenarioName == action.scenarioName ? action.nextScenarioName : state.scenarioName,
			scenariosOverlays: removeScenarioFromScenariosOverlay(state.filename, action.scenarioName, state.scenariosOverlays)
		};
	case UPDATE_EDITING_SCENARIO_DESCRIPTION:
		return {
			...state,
			scenariosOverlays: updateEditingScenarioDescriptionInOverlay(state, action.description)
		};
	case UPDATE_EDITING_SCENARIO_NAME:
		return {
			...state,
			scenarioName: action.scenarioName,
			scenariosOverlays: updateEditingScenarioNameInOverlay(state, action.scenarioName)
		};
	case BEGIN_EDITING_NODE_VALUE:
		return {
			...state,
			scenariosOverlays: beginEditingNodeValueInOverlay(state, action.propertyName, action.value)
		};
	case EDITING_UPDATE_NODE_VALUE:
		return {
			...state,
			scenariosOverlays: editingUpdateNodeValueInOverlay(state, action.propertyName, action.value)
		};
	case REMOVE_EDITING_NODE_VALUE:
		return {
			...state,
			scenariosOverlays: removeEditingNodeValueInOverlay(state, action.propertyName)
		};
	case ADD_EDITING_NODE_EDGE:
		return {
			...state,
			scenariosOverlays: addEditingNodeEdgeInOverlay(state, action.edge)
		};
	case REMOVE_EDITING_NODE_EDGE:
		return {
			...state,
			scenariosOverlays: removeEditingNodeEdgeInOverlay(state, action.previousEdgeID)
		};
	case MODIFY_EDITING_NODE_EDGE:
		return {
			...state,
			scenariosOverlays: modifyEditingNodeEdgeInOverlay(state, action.previousEdgeID, action.edge)
		};
	default:
		return state;
	}
};

export default data;
