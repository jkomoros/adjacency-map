export const UPDATE_FILENAME = 'UPDATE_FILENAME';
export const UPDATE_SCALE = 'UPDATE_SCALE';
export const UPDATE_SCENARIO_NAME = 'UPDATE_SCENARIO_NAME';

export const UPDATE_HOVERED_NODE_ID = 'UPDATE_HOVERED_NODE_ID';
export const UPDATE_SELECTED_NODE_ID = 'UPDATE_SELECTED_NODE_ID';
export const UPDATE_SHOW_HIDDEN_VALUES = 'UPDATE_SHOW_HIDDEN_VALUES';

export const LOAD_SCENARIOS_OVERLAYS = 'LOAD_SCENARIOS_OVERLAYS';
export const BEGIN_EDITING_SCENARIO = 'BEGIN_EDITING_SCENARIO';
export const REMOVE_EDITING_SCENARIO = 'REMOVE_EDITING_SCENARIO';
export const BEGIN_EDITING_NODE_VALUE = 'BEGIN_EDITING_NODE_VALUE';
export const EDITING_UPDATE_NODE_VALUE = 'EDITING_UPDATE_NODE_VALUE';
export const REMOVE_EDITING_NODE_VALUE = 'REMOVE_EDITING_NODE_VALUE';

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
	selectSelectedNodeFieldsEdited
} from '../selectors.js';

import {
	AppActionCreator,
} from '../store.js';

import {
	DataFilename,
	NodeID,
	PropertyName,
	ScenarioName,
	ScenariosOverlays
} from '../types.js';

import {
	AnyAction
} from 'redux';

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

export const updateScale : AppActionCreator = (scale) => (dispatch, getState) => {
	if (scale == selectScale(getState())) return;
	dispatch({
		type: UPDATE_SCALE,
		scale,
	});
};

export const nextScenarioName : AppActionCreator = () => (dispatch, getState) => {
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

export const previousScenarioName : AppActionCreator = () => (dispatch, getState) => {
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

export const updateHoveredNodeID : AppActionCreator =  (nodeID? : NodeID) => (dispatch, getState) => {
	//This will get hit a lot so don't update state if hte nodeID hasn't changed.
	if (selectHoveredNodeID(getState()) == nodeID) return;
	dispatch({
		type: UPDATE_HOVERED_NODE_ID,
		nodeID
	});
};

export const updateSelectedNodeID : AppActionCreator =  (nodeID? : NodeID) => (dispatch, getState) => {
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

export const updateWithMainPageExtra : AppActionCreator = (pageExtra) => (dispatch) => {
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

export const beginEditingScenario : AppActionCreator = (scenarioName? : ScenarioName) => (dispatch, getState) =>{
	if (!scenarioName) scenarioName = selectScenarioName(getState()) + '-customized';
	const scenarioOverlay = selectCurrentScenarioOverlay(getState());
	if (scenarioOverlay[scenarioName]) throw new Error('Scenario name already exists');
	dispatch({
		type: BEGIN_EDITING_SCENARIO,
		scenarioName
	});
};

export const removeEditingScenario : AppActionCreator = (scenarioName? : ScenarioName) => (dispatch, getState) =>{
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

export const beginEditingNodeValue : AppActionCreator = (propertyName : PropertyName, value : number) => (dispatch, getState) => {
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

export const editingUpdateNodeValue : AppActionCreator = (propertyName : PropertyName, value : number | string) => (dispatch, getState) => {
	const state = getState();
	if (!selectCurrentScenarioEditable(state)) throw new Error('Scenario not editable');
	if (selectSelectedNodeID(state) == undefined) throw new Error('No node selected');
	const editableFields = selectSelectedNodeFieldsEdited(state);
	if (!editableFields[propertyName]) dispatch(beginEditingNodeValue(propertyName));
	if (typeof value == 'string') value = parseFloat(value);
	dispatch({
		type: EDITING_UPDATE_NODE_VALUE,
		propertyName,
		value
	});
};

export const removeEditingNodeValue : AppActionCreator = (propertyName : PropertyName) => (dispatch, getState) => {
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