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
	SET_SHOW_EDGES,
	UPDATE_SHOW_HIDDEN_VALUES,
	LOAD_SCENARIOS_OVERLAYS,
	RESET_SCENARIOS_OVERLAYS,
	BEGIN_EDITING_SCENARIO,
	REMOVE_EDITING_SCENARIO,
	BEGIN_EDITING_NODE_VALUE,
	EDITING_UPDATE_NODE_VALUE,
	REMOVE_EDITING_NODE_VALUE,
	ADD_EDITING_NODE_EDGE,
	REMOVE_EDITING_NODE_EDGE,
	MODIFY_EDITING_NODE_EDGE
} from "../actions/data.js";

import {
	DataState,
	DataFilename,
	ScenarioName,
	ScenariosOverlays,
	NodeID,
	PropertyName,
	ScenarioNode,
	EdgeValue,
	EdgeValueMatchID
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
	selectedNodeID: undefined,
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
	const [result, node] = prepareToEditNodeInOverlay(state);
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
	return result;
};

const removeEditingNodeEdgeInOverlay = (state : DataState, edge : EdgeValue) : ScenariosOverlays => {
	const [result, node] = prepareToEditNodeInOverlay(state);
	const id = getEdgeValueMatchID(edge);
	let changesMade = false;
	for (let i = 0; i < node.edges.add.length; i++) {
		const addition = node.edges.add[i];
		if (getEdgeValueMatchID(addition) != id) continue;
		changesMade = true;
		node.edges.add.splice(i);
		break;
	}
	for (const previousID of Object.keys(node.edges.modify)) {
		if (previousID != id) continue;
		changesMade = true;
		delete node.edges.modify[previousID];
		break;
	}
	if (!changesMade) {
		node.edges.remove[id] = true;
	}
	return result;
};

//We accept previousEdge and newEdge because we might have made a modification
//to type/parent which would change which one we're touching.
const modifyEditingNodeEdgeInOverlay = (state : DataState, previousEdgeID: EdgeValueMatchID, newEdge? : EdgeValue) : ScenariosOverlays => { 
	const [result, node] = prepareToEditNodeInOverlay(state);
	let changesMade = false;
	for (let i = 0; i < node.edges.add.length; i++) {
		if (getEdgeValueMatchID(node.edges.add[i]) != previousEdgeID) continue;
		if (!newEdge) {
			node.edges.add.splice(i);
		} else {
			node.edges.add[i] = newEdge;
		}
		changesMade = true;
	}
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
	case SET_SHOW_EDGES:
		return {
			...state,
			showEdges: action.on
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
			scenariosOverlays: removeEditingNodeEdgeInOverlay(state, action.edge)
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
