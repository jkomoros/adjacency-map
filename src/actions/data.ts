export const UPDATE_FILENAME = 'UPDATE_FILENAME';
export const UPDATE_SCALE = 'UPDATE_SCALE';
export const UPDATE_SCENARIO_NAME = 'UPDATE_SCENARIO_NAME';

export const SET_EDITING = 'SET_EDITING';

export const UPDATE_HOVERED_NODE_ID = 'UPDATE_HOVERED_NODE_ID';
export const UPDATE_HOVERED_EDGE_ID = 'UPDATE_HOVERED_EDGE_ID';
export const UPDATE_SELECTED_NODE_ID = 'UPDATE_SELECTED_NODE_ID';
export const UPDATE_SHOW_HIDDEN_VALUES = 'UPDATE_SHOW_HIDDEN_VALUES';
export const SET_SHOW_EDGES = 'SET_SHOW_EDGES';

export const LOAD_SCENARIOS_OVERLAYS = 'LOAD_SCENARIOS_OVERLAYS';
export const RESET_SCENARIOS_OVERLAYS = 'RESET_SCENARIOS_OVERLAYS';
export const BEGIN_EDITING_SCENARIO = 'BEGIN_EDITING_SCENARIO';
export const REMOVE_EDITING_SCENARIO = 'REMOVE_EDITING_SCENARIO';
export const UPDATE_EDITING_SCENARIO_DESCRIPTION = 'UPDATE_EDITING_SCENARIO_DESCRIPTION';
export const UPDATE_EDITING_SCENARIO_NAME = 'UPDATE_EDITING_SCENARIO_NAME';
export const BEGIN_EDITING_NODE_VALUE = 'BEGIN_EDITING_NODE_VALUE';
export const EDITING_UPDATE_NODE_VALUE = 'EDITING_UPDATE_NODE_VALUE';
export const REMOVE_EDITING_NODE_VALUE = 'REMOVE_EDITING_NODE_VALUE';
export const ADD_EDITING_NODE_EDGE = 'ADD_EDITING_NODE_EDGE';
export const REMOVE_EDITING_NODE_EDGE = 'REMOVE_EDITING_NODE_EDGE';
export const MODIFY_EDITING_NODE_EDGE = 'MODIFY_EDITING_NODE_EDGE';

export const DEFAULT_FILE_NAME = 'default';
//Also in tools/config.ts
export const DATA_DIRECTORY = 'data';

import {
	canonicalizePath
} from './app.js';

import {
	selectFilename,
	selectHoveredNodeID,
	selectSelectedNodeID,
	selectLegalScenarioNames,
	selectScale,
	selectScenarioName,
	selectCurrentScenarioOverlay,
	selectCurrentScenarioEditable,
	selectSelectedNodeFieldsEdited,
	selectAdjacencyMap,
	selectShowEdges,
	selectHoveredEdgeID
} from '../selectors.js';

import {
	AppActionCreator,
} from '../store.js';

import {
	DataFilename,
	EdgeIdentifier,
	EdgeValue,
	EdgeValueMatchID,
	NodeID,
	PropertyName,
	RootState,
	ScenarioName,
	ScenariosOverlays
} from '../types.js';

import {
	AnyAction
} from 'redux';

import {
	DEFAULT_SCENARIO_NAME,
	ROOT_ID
} from '../constants.js';
import { edgeIdentifierEquivalent, getEdgeValueMatchID } from '../util.js';
import { RESERVED_EDGE_CONSTANT_NAMES } from '../value-definition.js';
import { ThunkAction } from 'redux-thunk';

export const updateFilename : AppActionCreator = (filename : DataFilename, skipCanonicalize = false) => (dispatch, getState) => {
	const state = getState();
	const currentFilename = selectFilename(state);
	if (currentFilename == filename) return;
	dispatch({
		type: UPDATE_FILENAME,
		filename,
	});
	if (!skipCanonicalize) dispatch(canonicalizePath());
};

export const updateScale = (scale : number) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	if (scale == selectScale(getState())) return;
	dispatch({
		type: UPDATE_SCALE,
		scale,
	});
};

export const nextScenarioName = () : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	const legalNames = selectLegalScenarioNames(state);
	const currentName = selectScenarioName(state);
	let result = 0;
	for (let i = 0; i < legalNames.length; i++) {
		result = i;
		if (legalNames[i] == currentName) break;
	}
	result++;
	if (result >= legalNames.length) result = legalNames.length - 1;
	dispatch(updateScenarioName(legalNames[result]));
};

export const previousScenarioName = () : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	const legalNames = selectLegalScenarioNames(state);
	const currentName = selectScenarioName(state);
	let result = 0;
	for (let i = 0; i < legalNames.length; i++) {
		result = i;
		if (legalNames[i] == currentName) break;
	}
	result--;
	if (result < 0) result = 0;
	dispatch(updateScenarioName(legalNames[result]));
};

export const updateScenarioName = (scenarioName : ScenarioName) : AnyAction => {
	return {
		type: UPDATE_SCENARIO_NAME,
		scenarioName,
	};
};

export const setEditing = (editing : boolean) : AnyAction => {
	return {
		type: SET_EDITING,
		editing
	};
};

export const updateHoveredNodeID =  (nodeID? : NodeID) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	//This will get hit a lot so don't update state if hte nodeID hasn't changed.
	if (selectHoveredNodeID(getState()) == nodeID) return;
	dispatch({
		type: UPDATE_HOVERED_NODE_ID,
		nodeID
	});
};

export const updateHoveredEdgeID =  (edgeID? : EdgeIdentifier) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	//This will get hit a lot so don't update state if hte nodeID hasn't changed.
	const currentEdgeID = selectHoveredEdgeID(getState());
	if (edgeIdentifierEquivalent(currentEdgeID, edgeID)) return;
	if (edgeID) edgeID = {...edgeID};
	dispatch({
		type: UPDATE_HOVERED_EDGE_ID,
		edgeID
	});
};

export const updateSelectedNodeID =  (nodeID? : NodeID) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	if (selectSelectedNodeID(getState()) == nodeID) return;
	dispatch({
		type: UPDATE_SELECTED_NODE_ID,
		nodeID
	});
};

export const updateShowHiddenValues = (showHiddenValues = false) : AnyAction => {
	return {
		type: UPDATE_SHOW_HIDDEN_VALUES,
		showHiddenValues
	};
};

export const updateWithMainPageExtra = (pageExtra : string) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch) => {
	const parts = pageExtra.split('/');
	//The last piece is the trailing slash
	//TODO: handle malformed URLs better
	if (parts.length != 1) return;
	const filename = parts[0];

	//Each of these will return if a no op
	dispatch(updateFilename(filename, true));
};

export const loadScenariosOverlays = (overlays : ScenariosOverlays) : AnyAction => {
	return {
		type: LOAD_SCENARIOS_OVERLAYS,
		overlays
	};
};

export const resetScenariosOverlays = () : AnyAction => {
	return {
		type: RESET_SCENARIOS_OVERLAYS
	};
};

export const beginEditingScenario = (scenarioName? : ScenarioName) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) =>{
	if (!scenarioName) scenarioName = selectScenarioName(getState()) + '-customized';
	const scenarioOverlay = selectCurrentScenarioOverlay(getState());
	if (scenarioOverlay[scenarioName]) throw new Error('Scenario name already exists');
	dispatch({
		type: BEGIN_EDITING_SCENARIO,
		scenarioName
	});
};

export const removeEditingScenario = (scenarioName? : ScenarioName) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) =>{
	if (scenarioName === undefined) scenarioName = selectScenarioName(getState());
	const scenarioOverlay = selectCurrentScenarioOverlay(getState());
	if (!scenarioOverlay[scenarioName]) throw new Error('Scenario name doesn\'t exist');
	const nextScenarioName = scenarioOverlay[scenarioName].extends || '';
	dispatch({
		type: REMOVE_EDITING_SCENARIO,
		scenarioName,
		//nextScenarioName will only be used if the currentScenarioName is scenarioName.
		nextScenarioName
	});
};

export const updateEditingScenarioDescription = (description : string) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	if (!selectCurrentScenarioEditable(state)) throw new Error('Scenario not editable');
	dispatch({
		type: UPDATE_EDITING_SCENARIO_DESCRIPTION,
		description
	});
};

export const updateEditingScenarioName = (scenarioName : ScenarioName) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	if (!selectCurrentScenarioEditable(state)) throw new Error('Scenario not editable');
	//No op
	if (selectScenarioName(state) == scenarioName) return;
	if (scenarioName == DEFAULT_SCENARIO_NAME) throw new Error('Scenario name must not be default');
	const map = selectAdjacencyMap(state);
	if (!map) throw new Error('no map');
	for (const existingName of Object.keys(map.data.scenarios)){
		if (scenarioName == existingName) throw new Error('Name conclicts with existing name');
	}
	dispatch({
		type: UPDATE_EDITING_SCENARIO_NAME,
		scenarioName
	});
};

export const beginEditingNodeValue = (propertyName : PropertyName, value : number) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	if (!selectCurrentScenarioEditable(state)) throw new Error('Scenario not editable');
	if (selectSelectedNodeID(state) == undefined) throw new Error('No node selected');
	const editableFields = selectSelectedNodeFieldsEdited(state);
	//That field is already editable
	if (editableFields[propertyName]) return;
	dispatch({
		type: BEGIN_EDITING_NODE_VALUE,
		propertyName,
		value
	});
};

export const editingUpdateNodeValue = (propertyName : PropertyName, value : number | string) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	if (!selectCurrentScenarioEditable(state)) throw new Error('Scenario not editable');
	if (selectSelectedNodeID(state) == undefined) throw new Error('No node selected');
	const editableFields = selectSelectedNodeFieldsEdited(state);
	//TODO: set a better default value in that case
	if (!editableFields[propertyName]) dispatch(beginEditingNodeValue(propertyName, 0));
	if (typeof value == 'string') value = parseFloat(value);
	dispatch({
		type: EDITING_UPDATE_NODE_VALUE,
		propertyName,
		value
	});
};

export const removeEditingNodeValue = (propertyName : PropertyName) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	if (!selectCurrentScenarioEditable(state)) throw new Error('Scenario not editable');
	if (selectSelectedNodeID(state) == undefined) throw new Error('No node selected');
	const editableFields = selectSelectedNodeFieldsEdited(state);
	if (!editableFields[propertyName]) return;
	dispatch({
		type: REMOVE_EDITING_NODE_VALUE,
		propertyName
	});
};

export const setShowEdges = (on : boolean) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	if (selectShowEdges(getState()) == on) return;
	dispatch({
		type: SET_SHOW_EDGES,
		on
	});
};

export const addEditingNodeEdge = (edge? : EdgeValue) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	if (!selectCurrentScenarioEditable(state)) throw new Error('Scenario not editable');
	if (selectSelectedNodeID(state) == undefined) throw new Error('No node selected');
	if (!edge) {
		const map = selectAdjacencyMap(state);
		if (!map) throw new Error('no map');
		const propertyNames = map.propertyNames;
		if (propertyNames.length == 0) throw new Error('No property names');
		const propertyName = map.propertyNames[0];
		const parent = ROOT_ID;
		//TODO: if property/parent are already present in an additions list and they
		//were set automatically, then set another pair so as to not overlap.
		edge = {type: propertyName, parent};
	}
	dispatch({
		type: ADD_EDITING_NODE_EDGE,
		edge
	});
};

export const removeEditingNodeEdge = (edge : EdgeValue | EdgeValueMatchID) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	if (!selectCurrentScenarioEditable(state)) throw new Error('Scenario not editable');
	if (selectSelectedNodeID(state) == undefined) throw new Error('No node selected');
	const previousEdgeID = typeof edge == 'string' ? edge : getEdgeValueMatchID(edge);
	dispatch({
		type: REMOVE_EDITING_NODE_EDGE,
		previousEdgeID
	});
};

//We accept both a previousEdge and newEdge because it's possible the
//modification is the type/parent which is how we detect which edge is which.
export const modifyEditingNodeEdge = (previousEdgeID : EdgeValueMatchID, newEdge? : EdgeValue) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	if (!selectCurrentScenarioEditable(state)) throw new Error('Scenario not editable');
	if (selectSelectedNodeID(state) == undefined) throw new Error('No node selected');
	//Remove any constants that are no longer valid for this edge type.
	if (newEdge) {
		const map = selectAdjacencyMap(state);
		if (!map) throw new Error('No map');
		const propertyDefinition = map.data.properties[newEdge.type];
		if (!propertyDefinition) throw new Error('Invalid property');
		const constants = propertyDefinition.constants || {};
		newEdge = {...newEdge};
		for (const key of Object.keys(newEdge)) {
			if (RESERVED_EDGE_CONSTANT_NAMES[key]) continue;
			if (constants[key] !== undefined) continue;
			delete newEdge[key];
		}
	}
	dispatch({
		type: MODIFY_EDITING_NODE_EDGE,
		previousEdgeID,
		edge: newEdge
	});
};