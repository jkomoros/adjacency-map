import { html, css, svg, TemplateResult} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { PageViewElement } from "./page-view-element.js";
import { connect } from "pwa-helpers/connect-mixin.js";

// This element is connected to the Redux store.
import { store } from "../store.js";

import {
	addEditingNodeEdge,
	beginEditingNodeValue,
	beginEditingScenario,
	editingUpdateNodeValue,
	loadScenariosOverlays,
	modifyEditingNodeEdge,
	nextScenarioName,
	previousScenarioName,
	removeEditingNodeEdge,
	removeEditingNodeValue,
	removeEditingScenario,
	resetScenariosOverlays,
	setShowEdges,
	updateFilename,
	updateHoveredEdgeID,
	updateHoveredNodeID,
	updateScale,
	updateScenarioName,
	updateSelectedNodeID,
	updateShowHiddenValues,
	updateWithMainPageExtra
} from "../actions/data.js";

import {
	selectPageExtra,
	selectFilename,
	selectAdjacencyMap,
	selectScale,
	selectLegalFilenames,
	selectLegalScenarioNames,
	selectScenarioName,
	selectHashForCurrentState,
	selectSummaryDescription,
	selectSummaryTags,
	selectSummaryValues,
	selectSummaryNodeDisplayName,
	selectSelectedNodeID,
	selectShowHiddenValues,
	selectAdjacencyMapError,
	selectCurrentScenarioEditable,
	selectSelectedNodeFieldsEdited,
	selectScenariosOverlays,
	selectCurrentScenarioEditedNodes,
	selectSummaryNodeID,
	selectShowEdges
} from "../selectors.js";

// We are lazy loading its reducer.
import data from "../reducers/data.js";
store.addReducers({
	data
});

// These are the shared styles needed by this element.
import { SharedStyles } from "./shared-styles.js";

import {
	ButtonSharedStyles
} from "./button-shared-styles.js";

import {
	DataFilename,
	EdgeIdentifier,
	EdgeValue,
	EdgeValueMatchID,
	EdgeValueModificationMap,
	NodeID,
	NodeValues,
	NodeValuesOverride,
	PropertyDefinition,
	PropertyName,
	RenderEdgeValue,
	RootState,
	ScenarioName,
	ScenariosOverlays,
	TagID,
	TagMap,
} from '../types.js';

import {
	AdjacencyMap, AdjacencyMapNode
} from '../adjacency-map.js';

import {
	ROOT_ID,
	SVG_HEIGHT,
	SVG_WIDTH,
	ENABLE_EDITING_SCENARIOS
} from '../constants.js';

import {
	canonicalizeHash,
	canonicalizePath,
	updateHash
} from '../actions/app.js';

import {
	VISIBILITY_ICON,
	VISIBILITY_OFF_ICON,
	EDIT_ICON,
	PLUS_ICON,
	UNDO_ICON,
	CANCEL_ICON,
	DELETE_FOREVER_ICON
} from './my-icons.js';

import {
	fetchOverlaysFromStorage,
	storeOverlaysToStorage,
	renderEdgeStableID,
	constantsForEdge,
	getEdgeValueMatchID
} from '../util.js';

@customElement('main-view')
class MainView extends connect(store)(PageViewElement) {

	@state()
	_pageExtra: string;

	@state()
	_filename: DataFilename;

	@state()
	_adjacencyMap : AdjacencyMap | null;

	@state()
	_scale : number;

	@state()
	_scenarioEditable : boolean;

	@state()
	_summaryNodeEditableFields: {[type : PropertyName]: boolean}

	@state()
	_scenariosOverlays : ScenariosOverlays;

	@state()
	_editedNodes: {[id : NodeID]: {values?: NodeValuesOverride}}

	@state()
	_legalFilenames : DataFilename[];

	@state()
	_legalScenarioNames : ScenarioName[];

	@state()
	_scenarioName : ScenarioName;

	@state()
	_hashForCurrentState : string;

	@state()
	_summaryNodeID : NodeID | undefined;

	@state()
	_selectedNodeID : NodeID | undefined;

	@state()
	_summaryNodeDisplayName : string | undefined;

	@state()
	_summaryTags : TagMap;

	@state()
	_summaryDescription : string;

	@state()
	_summaryValues : NodeValues;

	@state()
	_showHiddenValues : boolean;

	@state()
	_showEdges : boolean;

	@state()
	_dataError : string;

	static override get styles() {
		return [
			SharedStyles,
			ButtonSharedStyles,
			css`
				:host {
					position:relative;
					height:100vh;
					width: 100vw;
					background-color: var(--override-app-background-color, var(--app-background-color, #356F9E));
					overflow:scroll;
				}

				.controls {
					position: absolute;
					top: 0;
					left: 0;
					padding: 1em;
					box-sizing: border-box;
					border: 1px solid var(--dark-gray-color);
					width: var(--controls-width);
				}

				.container {
					display: flex;
					justify-content: center;
					align-items: center;
					height: 100%;
					width: 100%;
				}

				ul.removed {
					text-decoration: line-through;
				}

				.container.needs-margin-left frame-visualization {
					margin-left: var(--controls-width);
				}

				.row {
					display: flex;
					flex-direction: row;
				}

				.right {
					justify-content: flex-end;
				}

				ul {
					padding-inline-start: 1em;
				}

				ul input, ul select {
					max-width: 10em;
				}

				.tag {
					background-color: red;
					font-size: 0.8em;
					color: white;
					border-radius: 0.3em;
					box-sizing: border-box;
					padding: 0.2em;
					display: inline-block;
					margin: 0.2em;
					cursor: pointer;
					opacity: 0.2;
				}

				.tag.active {
					opacity: 1.0;
				}

				.tag:hover {
					opacity: 0.6;
				}

				strong.hidden {
					color: var(--lighter-gray-color);
				}

				circle:hover {
					cursor: pointer;
					stroke: white !important;
					stroke-width: 0.2em !important;
				}

				circle.selected {
					stroke: gold !important;
					stroke-width: 0.2em !important;
				}

				circle.edited {
					stroke-width: 0.2em !important;
					stroke-dasharray: 0.2em;
				}

				svg text {
					user-select: none;
					pointer-events: none;
				}

				svg * {
					transition: all 0.1s ease-in-out;
				}

			`
		];
	}

	override render() : TemplateResult {
		const node = (this._adjacencyMap && this._summaryNodeID) ? this._adjacencyMap.node(this._summaryNodeID) : null;
		const [nodeEdges, nodeModMap] = node ? node.edgesForUI : [[] , {}];
		const nodeLegalParentIDs = node ? node.legalParentIDs : {};
		//TODO: only show ones that will ve legal to add
		const nodeLegalPropertyNames = node ? node.legalAdditionalPropertyNames : {};
		return html`
			<div class='controls' @mousemove=${this._handleControlsMouseMove}>
				${this._legalFilenames && this._legalFilenames.length > 1 ? html`
				<label for='filenames'>File</label>
				<select id='filenames' .value=${this._filename} @change=${this._handleFilenameChanged}>
					${this._legalFilenames.map(filename => html`<option .value=${filename}>${filename}${this._scenariosOverlays && this._scenariosOverlays[filename] ? html` (*)` : ''}</option>`)}
				</select>` : ''}
				${ENABLE_EDITING_SCENARIOS && Object.keys(this._scenariosOverlays).length > 0 ? html`<button class='small' title='Remove all edits across all files' @click=${this._handleResetOverlaysClicked}>${DELETE_FOREVER_ICON}</button>` : ''}
				${this._legalScenarioNames.length > 1 || ENABLE_EDITING_SCENARIOS ? html`
				<label for='scenarios'>Scenario</label>
				<select id='scenarios' .value=${this._scenarioName} @change=${this._handleScenarioNameChanged}>
					${this._legalScenarioNames.map(scenarioName => html`<option .value=${scenarioName} .selected=${scenarioName == this._scenarioName}>${scenarioName || 'Default'}</option>`)}
				</select>` : ''}
				${ENABLE_EDITING_SCENARIOS ? html`<button class='small' title='Create a new scenario based on the current scenario' @click=${this._handleCreateScenarioClicked}>${PLUS_ICON}</button>${this._scenarioEditable ? html`<button class='small' title='Remove this scenario' @click=${this._handleRemoveScenarioClicked}>${CANCEL_ICON}</button>` : ''}` : ''}
				<div class='summary'>
					<div>
						<label>Node</label> <strong>${this._summaryNodeDisplayName === undefined ? html`<em>Union of all nodes</em>${this._scenarioEditable ? html`<br/>Select a node to edit it</strong>` : ''}` : (this._summaryNodeDisplayName || html`<em>Root</em>`)}</strong>
					</div>
					<div>
						<label>Description</label> ${this._summaryDescription}
					</div>
					${this._legalScenarioNames.length > 1 ? 
		html`<div>
							<label>Scenario</label> ${this._adjacencyMap?.scenario.description || (this._adjacencyMap?.scenarioName ? html`<em>No description</em>` : html`<em>Default</em>`)}
						</div>`
		: html``}
					<div>
						<label>Values <button class='small' title='Show hidden values'>${this._showHiddenValues ? VISIBILITY_ICON : VISIBILITY_OFF_ICON}</button><input type='checkbox' .checked=${this._showHiddenValues} @change=${this._handleShowHiddenValuesClicked}></input></label>
						${Object.entries(this._summaryValues).filter(entry => this._showHiddenValues || !this._adjacencyMap?.data.properties[entry[0]].hide).map(entry => this._htmlForValue(entry[0], entry[1]))}
					</div>
					${Object.keys(this._summaryTags).length && this._adjacencyMap ? 
		html`<label>Tags</label>
				${Object.keys(this._adjacencyMap.data.tags).map(tagName => this._htmlForTag(tagName, this._summaryTags))}`
		: ''}
					${nodeEdges.length ? html`<details .open=${this._showEdges}><summary @click=${this._handleShowEdgesToggleClicked}><label>Edges</label></summary>
					${nodeEdges.map((edge, i) => this._htmlForEdge(edge, i, node, nodeModMap, nodeLegalParentIDs))}
					${this._scenarioEditable ? html`<select @change=${this._handleAddNewEdgeChanged} .value=${''}>
						<option value='' .selected=${true}>Add a new edge of type...</option>
						${Object.entries(nodeLegalPropertyNames).map(entry => html`<option .value=${entry[0]} data-node-id=${entry[1] == null ? '@INVALID@' : entry[1]} .disabled=${entry[1] == null}>${entry[0]}</option>`)}
					</select>` : ''}
					</details>` 
		: ''}
				</div>
			</div>
			<div class='container'>
				${this._svg()}
			</div>
		`;
	}

	_htmlForValue(propertyName : PropertyName, value : number) : TemplateResult {
		if (!this._adjacencyMap) return html``;
		const property = this._adjacencyMap.data.properties[propertyName];

		let inner = html`${parseFloat(value.toFixed(2))}${this._scenarioEditable && this._selectedNodeID != undefined ? html`<button class='small' @click=${this._handleEditNodePropertyClicked} title='Edit this property' data-property-name=${propertyName} data-value=${String(value)}>${EDIT_ICON}</button>` : ''}`;
		if (this._summaryNodeEditableFields[propertyName]) {
			inner = html`<input type='number' .value=${String(value)} @change=${this._handleUpdateNodeProperty} data-property-name=${propertyName}></input><button class='small' title='Unset this property' @click=${this._handleRemoveNodePropertyClicked} data-property-name=${propertyName}>${CANCEL_ICON}</button>`;
		}
		return html`<div><strong title='${property.description || ''}' class='${property.hide || false ? 'hidden' : ''}'>${propertyName}</strong>: ${inner}</div>`;
	}

	_htmlForEdge(edge : EdgeValue, index : number, node : AdjacencyMapNode | null, modMap : EdgeValueModificationMap, legalParentIDs : {[id : NodeID] : true}) : TemplateResult {
		let previousID = modMap[getEdgeValueMatchID(edge)];
		const isRemoved = previousID === null;
		const hasModifications = previousID != null && previousID != undefined;
		const nodeID = node ? node.id : '';
		if (previousID === null) previousID = '';
		if (previousID === undefined) previousID = getEdgeValueMatchID(edge);
		const properties = node ? node._map.legalEdgePropertyNames.map(propertyName => [propertyName, node._map.data.properties[propertyName]] as [PropertyName, PropertyDefinition]) : [];
		const nodeIDs = Object.keys(this._adjacencyMap?.data.nodes || {});
		const allowedMissingConstants = node ? node.allowedMissingConstants(edge) : {};
		return html`<ul class='${isRemoved ? 'removed' : ''}' data-index=${index} data-previous-id=${previousID} data-has-modifications=${hasModifications ? '1' : '0'} @mousemove=${this._handleEdgeMouseMove}>
				${this._scenarioEditable ? html`<li class='buttons'>
					${isRemoved || hasModifications ? html`<button class='small' @click=${this._handleUndoRemoveEdgeClicked} title='Undo changes'>${UNDO_ICON}</button>` : ''}
					${!isRemoved ? html`<button class='small' @click=${this._handleRemoveEdgeClicked}>${CANCEL_ICON}</button>` : ''}
				</li>` : ''}
				<li>Type: ${this._scenarioEditable && !isRemoved ? html`<select .value=${edge.type} @change=${this._handleEdgeTypeChanged}>
					${properties.map(entry => html`<option .value=${entry[0]} .title=${entry[1].description || entry[0]} .selected=${edge.type == entry[0]}>${entry[0]}</option>`)}
				</select>` : html`<strong>${edge.type}</strong>`}</li>
				<li>Parent: ${this._scenarioEditable && !isRemoved ? html`<select .value=${edge.parent || ''} @change=${this._handleEdgeParentChanged}>
					${[ROOT_ID, ...nodeIDs].map(id => html`<option .value=${id} .selected=${(edge.parent || '') == id} .disabled=${id == nodeID || !legalParentIDs[id]}>${id || 'Root'}</option>`)}
				</select>` : html`<strong>${edge.parent}</strong>`}</li>
				${Object.entries(constantsForEdge(edge)).map(entry => html`<li>${entry[0]}: ${this._scenarioEditable && !isRemoved ? 
		html`<input type='number' .value=${String(entry[1])} data-property-name=${entry[0]} @change=${this._handleEdgeConstantChanged}></input><button class='small' data-property-name=${entry[0]} @click=${this._handleEdgeRemoveConstant}>${CANCEL_ICON}</button>` :
		html`<strong>${entry[1]}</strong>`}</li>`)}
			${this._scenarioEditable && !isRemoved && Object.keys(allowedMissingConstants).length ? 
		html`<select @change=${this._handleAddEdgeConstantChanged} .value=${''}>
			<option value='' .selected=${true}>Add a constant...</option>
			${Object.entries(allowedMissingConstants).map(entry => html`<option .value=${entry[0]} data-default-value=${entry[1]}>${entry[0]}</option>`)}
		</select>` :
		''}
			</ul>`;
	}

	_htmlForTag(tagName : TagID, tagMap : TagMap) : TemplateResult {
		if (!this._adjacencyMap) return html`${tagName}`;
		const tagDefinition = this._adjacencyMap.data.tags[tagName];
		if (!tagDefinition) return html`${tagName}`;

		const active = tagMap[tagName] || false;

		const styles : {[propertyName : string] : string} = {
			backgroundColor: tagDefinition.color
		};

		return html`<div class='tag ${active ? 'active' : ''}' style=${styleMap(styles)} title='${tagDefinition.description}'>${tagDefinition.displayName}</div>`;
	}

	// This is called every time something is updated in the store.
	override stateChanged(state : RootState) {
		this._pageExtra = selectPageExtra(state);
		this._filename = selectFilename(state);
		this._adjacencyMap = selectAdjacencyMap(state);
		this._scale = selectScale(state);
		this._legalFilenames = selectLegalFilenames(state);
		this._scenarioName = selectScenarioName(state);
		this._legalScenarioNames = selectLegalScenarioNames(state);
		this._hashForCurrentState = selectHashForCurrentState(state);
		this._summaryDescription = selectSummaryDescription(state);
		this._selectedNodeID = selectSelectedNodeID(state);
		this._summaryNodeID = selectSummaryNodeID(state);
		this._summaryNodeDisplayName = selectSummaryNodeDisplayName(state);
		this._summaryTags = selectSummaryTags(state);
		this._summaryValues = selectSummaryValues(state);
		this._showEdges = selectShowEdges(state);
		this._showHiddenValues = selectShowHiddenValues(state);
		this._dataError = selectAdjacencyMapError(state);
		this._scenarioEditable = selectCurrentScenarioEditable(state);
		this._summaryNodeEditableFields = selectSelectedNodeFieldsEdited(state);
		this._scenariosOverlays = selectScenariosOverlays(state);
		this._editedNodes = selectCurrentScenarioEditedNodes(state);
	}

	override updated(changedProps : Map<string, MainView[keyof MainView]>) {
		//We're responsible for calling updateWithSimPageExtra
		if ((changedProps.has('_pageExtra')) && this._pageExtra) {
			store.dispatch(updateWithMainPageExtra(this._pageExtra));
		}
		if (changedProps.has('_hashForCurrentState')) {
			store.dispatch(canonicalizeHash());
		}
		if (changedProps.has('_dataError') && this._dataError) {
			alert(this._dataError);
			console.warn(this._dataError);
		}
		if (changedProps.has('_scenariosOverlays')) {
			storeOverlaysToStorage(this._scenariosOverlays);
		}
	}

	override firstUpdated() {
		document.addEventListener('keydown', e => this._handleKeyDown(e));
		window.addEventListener('resize', () => this.resizeVisualization());
		this.resizeVisualization();
		store.dispatch(canonicalizePath());
		window.addEventListener('hashchange', () => this._handleHashChange());
		this._handleHashChange();

		//Fetch overlays from localStorage;
		store.dispatch(loadScenariosOverlays(fetchOverlaysFromStorage()));
	}

	_handleControlsMouseMove() {
		store.dispatch(updateHoveredEdgeID());
	}

	_handleEdgeMouseMove(e : MouseEvent) {
		//Don't go back up and trigger for the whole controls
		e.stopPropagation();
		const [edge] = this._edgeActionClicked(e);
		const identifier : EdgeIdentifier = {
			source: this._summaryNodeID || ROOT_ID,
			parent: edge.parent || ROOT_ID,
			type: edge.type
		};
		store.dispatch(updateHoveredEdgeID(identifier));
	}

	_handleKeyDown(e : KeyboardEvent) {
		//We have to hook this to issue content editable commands when we're
		//active. But most of the time we don't want to do anything.
		if (!this.active) return;

		//Don't trigger keyboard shortcuts if the user is editing a text field
		for (const ele of e.composedPath()) {
			if (!(ele instanceof HTMLElement)) continue;
			if (ele.localName == 'input') return;
			if (ele.localName == 'textarea') return;
		}

		if (e.key == 'ArrowRight') {
			store.dispatch(nextScenarioName());
		} else if (e.key == 'ArrowLeft') {
			store.dispatch(previousScenarioName());
		}
	}

	_handleResetOverlaysClicked() {
		store.dispatch(resetScenariosOverlays());
	}

	_handleShowEdgesToggleClicked() {
		store.dispatch(setShowEdges(!this._showEdges));
	}

	_edgeActionClicked(e : Event) : [edge : EdgeValue, previousID : EdgeValueMatchID, hasModifications : boolean] {
		let ulEle : HTMLUListElement | null = null;
		for (const ele of e.composedPath()) {
			if (!(ele instanceof HTMLUListElement)) continue;
			ulEle = ele;
		}
		if (!ulEle) throw new Error('Couldnt find ul ele as expected');
		const rawIndex = ulEle.dataset.index;
		if (!rawIndex) throw new Error('No edge index as expected');
		const index = parseInt(rawIndex);
		const node = (this._adjacencyMap && this._summaryNodeID) ? this._adjacencyMap.node(this._summaryNodeID) : null;
		if (!node) throw new Error('No node');
		const [edges] = node.edgesForUI;
		const edge = edges[index];
		if (!edge) throw new Error('No edge');
		const rawPreviousID = ulEle.dataset.previousId;
		if (rawPreviousID == undefined) throw new Error('No previous id');
		const rawHasModifications = ulEle.dataset.hasModifications;
		if (rawHasModifications == undefined) throw new Error('No has Modifications');
		const hasModifications = parseInt(rawHasModifications);
		return [edge, rawPreviousID, hasModifications ? true : false];
	}

	_handleUndoRemoveEdgeClicked(e : MouseEvent) {
		const [edge, previousID, hasModifications] = this._edgeActionClicked(e);
		if (hasModifications) {
			//Passing undefined for second argument will remove all modifications
			store.dispatch(modifyEditingNodeEdge(previousID));
		} else {
			store.dispatch(addEditingNodeEdge(edge));
		}
	}

	_handleRemoveEdgeClicked(e : MouseEvent) {
		const result = this._edgeActionClicked(e);
		const previousEdgeID = result[1];
		store.dispatch(removeEditingNodeEdge(previousEdgeID));
	}

	_handleEdgeTypeChanged(e : Event) {
		const [edge, previousEdgeID] = this._edgeActionClicked(e);
		if (!e.target) throw new Error('No select');
		if (!(e.target instanceof HTMLSelectElement)) throw new Error('not select element');
		const newPropertyName : PropertyName = e.target.value;
		const newEdge = {...edge, type: newPropertyName};
		store.dispatch(modifyEditingNodeEdge(previousEdgeID, newEdge));
	}

	_handleEdgeParentChanged(e : Event) {
		const [edge, previousEdgeID] = this._edgeActionClicked(e);
		if (!e.target) throw new Error('No select');
		if (!(e.target instanceof HTMLSelectElement)) throw new Error('not select element');
		const newParent : NodeID = e.target.value;
		const newEdge = {...edge, parent: newParent};
		store.dispatch(modifyEditingNodeEdge(previousEdgeID, newEdge));
	}

	_handleEdgeConstantChanged(e : Event) {
		const [edge, previousEdgeID] = this._edgeActionClicked(e);
		if (!e.target) throw new Error('No input');
		if (!(e.target instanceof HTMLInputElement)) throw new Error('not input element');
		const value = parseFloat(e.target.value);
		const propertyName = e.target.dataset.propertyName;
		if (!propertyName) throw new Error('No property name');
		const newEdge = {...edge, [propertyName]: value};
		store.dispatch(modifyEditingNodeEdge(previousEdgeID, newEdge));
	}

	_handleAddEdgeConstantChanged(e : Event) {
		const [edge, previousEdgeID] = this._edgeActionClicked(e);
		if (!e.target) throw new Error('No input');
		if (!(e.target instanceof HTMLSelectElement)) throw new Error('not select element');
		const ele : HTMLSelectElement = e.target;
		const propertyName = ele.value;
		//Must have been the first item
		if (!propertyName) return;
		const option = ele.selectedOptions[0];
		const rawDefaultValue = option.dataset.defaultValue;
		if (!rawDefaultValue) throw new Error('No default');
		const defaultValue = parseFloat(rawDefaultValue);
		const newEdge = {...edge, [propertyName]: defaultValue};
		store.dispatch(modifyEditingNodeEdge(previousEdgeID, newEdge));
		ele.selectedIndex = 0;
	}

	_handleAddNewEdgeChanged(e : Event) {
		if (!e.target) throw new Error('no select');
		if (!(e.target instanceof HTMLSelectElement)) throw new Error('Not a select');
		const selectEle : HTMLSelectElement = e.target;
		const propertyName = selectEle.value;
		const selectedOption = selectEle.selectedOptions[0];
		if (!selectedOption) throw new Error('No selected option');
		const rawNodeID = selectEle.selectedOptions[0].dataset.nodeId;
		if (rawNodeID == undefined) throw new Error('No node ID');
		const nodeID : NodeID = rawNodeID;
		selectEle.selectedIndex = 0;
		store.dispatch(addEditingNodeEdge({type: propertyName, parent:nodeID}));
	}

	_handleEdgeRemoveConstant(e : Event) {
		const [edge, previousEdgeID] = this._edgeActionClicked(e);
		let buttonEle : HTMLButtonElement | null = null;
		for (const ele of e.composedPath()) {
			if (ele instanceof HTMLButtonElement) {
				buttonEle = ele;
				break;
			}
		}
		if (!buttonEle) throw new Error('No button');
		const propertyName = buttonEle.dataset.propertyName;
		if (!propertyName) throw new Error('No property name');
		const newEdge = {...edge};
		delete newEdge[propertyName];
		store.dispatch(modifyEditingNodeEdge(previousEdgeID, newEdge));
	}

	_handleEditNodePropertyClicked(e : MouseEvent) {
		let buttonEle : HTMLButtonElement | null = null;
		for (const ele of e.composedPath()) {
			if (!(ele instanceof HTMLButtonElement)) continue;
			buttonEle = ele;
		}
		if (!buttonEle) throw new Error('Couldnt find button ele as expected');
		const propertyName = buttonEle.dataset.propertyName;
		if (!propertyName) throw new Error('propertyName unexpectedly missing');
		const rawValue = buttonEle.dataset.value;
		if (!rawValue) throw new Error('value unexpectedly missing');
		store.dispatch(beginEditingNodeValue(propertyName, parseFloat(rawValue)));
	}

	_handleRemoveNodePropertyClicked(e :MouseEvent) {
		let buttonEle : HTMLButtonElement | null = null;
		for (const ele of e.composedPath()) {
			if (!(ele instanceof HTMLButtonElement)) continue;
			buttonEle = ele;
		}
		if (!buttonEle) throw new Error('Couldnt find button ele as expected');
		const propertyName = buttonEle.dataset.propertyName;
		if (!propertyName) throw new Error('propertyName unexpectedly missing');
		store.dispatch(removeEditingNodeValue(propertyName));
	}

	_handleUpdateNodeProperty(e: Event) {
		let inputEle : HTMLInputElement | null = null;
		for (const ele of e.composedPath()) {
			if (!(ele instanceof HTMLInputElement)) continue;
			inputEle = ele;
		}
		if (!inputEle) throw new Error('Couldnt find input ele as expected');
		const propertyName = inputEle.dataset.propertyName;
		if (!propertyName) throw new Error('propertyName unexpectedly missing');
		const value = parseFloat(inputEle.value);
		store.dispatch(editingUpdateNodeValue(propertyName, value));
	}

	_handleShowHiddenValuesClicked() {
		store.dispatch(updateShowHiddenValues(!this._showHiddenValues));
	}

	_handleCreateScenarioClicked() {
		store.dispatch(beginEditingScenario());
	}

	_handleRemoveScenarioClicked() {
		store.dispatch(removeEditingScenario());
	}

	_handleHashChange() {
		store.dispatch(updateHash(window.location.hash, true));
	}

	_handleFilenameChanged(e : Event) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof HTMLSelectElement)) throw new Error('not a select element');
		store.dispatch(updateFilename(ele.value));
	}

	_handleScenarioNameChanged(e : Event) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof HTMLSelectElement)) throw new Error('not a select element');
		store.dispatch(updateScenarioName(ele.value));
	}

	//Should be called any time the scale of visualization might need to change.
	//width, height, configurationExpanded, descriptionExpanded or page resizes
	resizeVisualization() {



		const pageRect = this.getBoundingClientRect();
		const availableWidth = pageRect.width;
		const availableHeight = pageRect.height;

		const heightScale = availableHeight / SVG_HEIGHT;
		const widthScale = availableWidth / SVG_WIDTH;

		const scale =  Math.min(heightScale, widthScale);
		if (!Number.isFinite(scale)) return;

		store.dispatch(updateScale(scale));

	}

	_pathForEdge(edge : RenderEdgeValue, map : AdjacencyMap) : string {

		const sourceNode = map.node(edge.source);
		const parentNode = map.node(edge.parent);
		let midPoint = (sourceNode.x - parentNode.x) * edge.bump + parentNode.x;
		let yBoost = 0.0;

		//If the source and ref are both at the same y, then bumping won't show
		//anyting by default. So instead of bumping the x left and right, bump
		//the y up and down.
		if (sourceNode.y == parentNode.y) {
			//In this case just bump up and down
			midPoint = (sourceNode.x + parentNode.x) / 2;
			yBoost = (sourceNode.x - parentNode.x) / 2 * (edge.bump - 0.5);
		}

		const result = `M ${parentNode.x},${parentNode.y}C${midPoint},${parentNode.y - yBoost},${midPoint},${sourceNode.y - yBoost},${sourceNode.x},${sourceNode.y}`;
		return result;
	}

	_titleForEdge(edge : RenderEdgeValue) : string {
		//TODO: better rendering
		return edge.edges.map(edge => edge.type).join(', ');
	}

	_handleSVGMouseMove(e : MouseEvent) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof Element)) throw new Error('unexpected node');
		const id = ele.id.includes('node:') ? ele.id.replace('node:', '') : undefined;
		store.dispatch(updateHoveredNodeID(id));
	}

	_handleSVGMouseClick(e : MouseEvent) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof Element)) throw new Error('unexpected node');
		const id = ele.id.includes('node:') ? ele.id.replace('node:', '') : undefined;
		store.dispatch(updateSelectedNodeID(id));
	}

	_svg() : TemplateResult {
		if (!this._adjacencyMap) return svg``;

		const a = this._adjacencyMap;
		
		// stroke line join for links
		const strokeLinejoin = '';
		// stroke line cap for links
		const strokeLinecap = '';
		// color of label halo 
		const halo = '#fff';
		// padding around the labels
		const haloWidth = 3;

		return html`<svg @mousemove=${this._handleSVGMouseMove} @click=${this._handleSVGMouseClick} class='main' viewBox='${a.viewBox}' width='${a.width * this._scale}' height='${a.height * this._scale}' style='max-width: 100%; height: auto; height: intrinsic;' font-family='sans-serif' font-size='10'>
			<g fill="none" stroke-linecap="${strokeLinecap}" stroke-linejoin="${strokeLinejoin}">
				${repeat(a.renderEdges, edge => renderEdgeStableID(edge), edge => svg`<path d="${this._pathForEdge(edge, a)}" stroke-width='${edge.width}' stroke-opacity='${edge.opacity}' stroke='${edge.color.rgbaStr}'><title>${this._titleForEdge(edge)}</title></path>`)}
			</g>
			<g>
				${Object.values(a.nodes).map(node => svg`<a transform="translate(${node.x},${node.y})">
					<circle class='${this._selectedNodeID == node.id ? 'selected' : ''} ${this._editedNodes && this._editedNodes[node.id] ? 'edited' : ''}' @mousemove=${this._handleSVGMouseMove} @click=${this._handleSVGMouseClick} id="${'node:' + node.id}" fill="${node.color.rgbaStr}" r="${node.radius}" opacity="${node.opacity}" stroke="${node.strokeColor.rgbaStr}" stroke-width="${node.strokeWidth}" stroke-opacity="${node.strokeOpacity}"></circle>
					<title>${node.fullDescription()}</title>
					<text dy="0.32em" x="${(node.children.length == 0 ? 1 : -1) * node.radius * 2}" text-anchor="${node.children.length == 0 ? 'start' : 'end'}" paint-order="stroke" stroke="${halo}" stroke-width="${haloWidth}">${node.displayName}</text>
				</a>`)}
			</g>
	</svg>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'main-view': MainView;
	}
}