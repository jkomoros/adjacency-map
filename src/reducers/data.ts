import {
	AnyAction
} from "redux";

import {
	UPDATE_FILENAME,
	DEFAULT_FILE_NAME,
	UPDATE_SCALE,
	UPDATE_SCENARIO_NAME,
	UPDATE_HOVERED_NODE_ID,
	UPDATE_SELECTED_NODE_ID,
	TOGGLE_SHOW_EDGES,
	UPDATE_SHOW_HIDDEN_VALUES,
	LOAD_SCENARIOS_OVERLAYS,
	RESET_SCENARIOS_OVERLAYS,
	BEGIN_EDITING_SCENARIO,
	REMOVE_EDITING_SCENARIO,
	BEGIN_EDITING_NODE_VALUE,
	EDITING_UPDATE_NODE_VALUE,
	REMOVE_EDITING_NODE_VALUE,
	ADD_EDITING_NODE_EDGE,
	REMOVE_EDITING_NODE_EDGE
} from "../actions/data.js";

import {
	DataState,
	DataFilename,
	ScenarioName,
	ScenariosOverlays,
	NodeID,
	PropertyName,
	ScenarioNode
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
	hoveredNodeID: undefined,
	showHiddenValues: false,
	showEdges: false,
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

const prepareToEditNodeInOverlay = (state : DataState) : [ScenariosOverlays, ScenarioNode, NodeID, {[id : NodeID]: ScenarioNode}] => {
	const filename = state.filename;
	const scenarioName = state.scenarioName;
	const currentOverlay = state.scenariosOverlays;
	const nodeID = state.selectedNodeID as NodeID;
	const result = deepCopy(currentOverlay);
	const filenameOverlay = result[filename];
	if (filenameOverlay == undefined) throw new Error('filename overlay unexpectededly not set');
	const scenarioOverlay = filenameOverlay[scenarioName];
	if (scenarioOverlay == undefined) throw new Error('scenarioOverlay unexpectedly not set');
	const nodes = scenarioOverlay.nodes;
	if (!nodes[nodeID]) nodes[nodeID] = emptyScenarioNode();
	const node = nodes[nodeID];
	return [result, node, nodeID, nodes];
};

const beginEditingNodeValueInOverlay = (state : DataState, propertyName : PropertyName, value : number) : ScenariosOverlays => {
	const [result, node] = prepareToEditNodeInOverlay(state);
	const values = node.values;
	values[propertyName] = value;
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
	if (node.edges.remove.length > 0) return false;
	if (node.edges.modify.length > 0) return false;
	return true;
};

const removeEditingNodeValueInOverlay = (state : DataState, propertyName : PropertyName) : ScenariosOverlays => {
	const [result, node, nodeID, nodes] = prepareToEditNodeInOverlay(state);
	delete node.values[propertyName];
	//If that was the last property then remove the item
	if (scenarioNodeIsEmpty(node)) delete nodes[nodeID];
	return result;
};

const addEditingNodeEdgeInOverlay = (state : DataState, propertyName : PropertyName, parent: NodeID) : ScenariosOverlays => {
	const [result, node] = prepareToEditNodeInOverlay(state);
	node.edges.add.push({parent, type: propertyName});
	return result;
};

const removeEditingNodeEdgeInOverlay = (state : DataState, propertyName : PropertyName, parent: NodeID) : ScenariosOverlays => {
	const [result, node] = prepareToEditNodeInOverlay(state);
	const id = getEdgeValueMatchID({type: propertyName, parent});
	let changesMade = false;
	for (let i = 0; i < node.edges.add.length; i++) {
		const addition = node.edges.add[i];
		if (getEdgeValueMatchID(addition) != id) continue;
		changesMade = true;
		node.edges.add.splice(i);
		break;
	}
	for (let i = 0; i < node.edges.modify.length; i++) {
		const modification = node.edges.modify[i];
		if (getEdgeValueMatchID(modification) != id) continue;
		changesMade = true;
		node.edges.modify.splice(i);
		break;
	}
	if (!changesMade) {
		node.edges.remove.push({type: propertyName, parent});
	}
	return result;
};

const data = (state : DataState = INITIAL_STATE, action : AnyAction) : DataState => {
	switch (action.type) {
	case UPDATE_FILENAME:
		return {
			...state,
			scenarioName: DEFAULT_FILE_NAME,
			filename: action.filename
		};
	case UPDATE_SCALE:
		return {
			...state,
			scale: action.scale
		};
	case UPDATE_SCENARIO_NAME:
		return {
			...state,
			scenarioName: action.scenarioName
		};
	case UPDATE_HOVERED_NODE_ID:
		return {
			...state,
			hoveredNodeID: action.nodeID
		};
	case UPDATE_SELECTED_NODE_ID:
		return {
			...state,
			selectedNodeID: action.nodeID
		};
	case TOGGLE_SHOW_EDGES:
		return {
			...state,
			showEdges: !state.showEdges
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
			scenariosOverlays: addEditingNodeEdgeInOverlay(state, action.property, action.parent)
		};
	case REMOVE_EDITING_NODE_EDGE:
		return {
			...state,
			scenariosOverlays: removeEditingNodeEdgeInOverlay(state, action.property, action.parent)
		};
	default:
		return state;
	}
};

export default data;
