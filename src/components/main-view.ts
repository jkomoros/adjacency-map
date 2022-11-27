import { html, css, TemplateResult} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { PageViewElement } from "./page-view-element.js";
import { connect } from "pwa-helpers/connect-mixin.js";

// This element is connected to the Redux store.
import { store } from "../store.js";

import {
	loadScenariosOverlays,
	nextScenarioName,
	previousScenarioName,
	updateHoveredNodeID,
	updateScale,
	updateSelectedNodeID,
	updateWithMainPageExtra
} from "../actions/data.js";

import {
	selectPageExtra,
	selectFilename,
	selectAdjacencyMap,
	selectScale,
	selectHashForCurrentState,
	selectSelectedNodeID,
	selectAdjacencyMapError,
	selectScenariosOverlays,
	selectCurrentScenarioEditedNodes,
	selectHoveredEdgeID,
	selectDialogOpen
} from "../selectors.js";

// We are lazy loading its reducer.
import data from "../reducers/data.js";
import dialog from "../reducers/dialog.js";
store.addReducers({
	data,
	dialog
});

// These are the shared styles needed by this element.
import { SharedStyles } from "./shared-styles.js";

import {
	ButtonSharedStyles
} from "./button-shared-styles.js";

import {
	DataFilename,
	EdgeIdentifier,
	NodeEvent,
	NodeID,
	NodeValuesOverride,
	RootState,
	ScenariosOverlays,
} from '../types.js';

import {
	AdjacencyMap
} from '../adjacency-map.js';

import {
	SVG_HEIGHT,
	SVG_WIDTH
} from '../constants.js';

import {
	canonicalizeHash,
	canonicalizePath,
	updateHash
} from '../actions/app.js';


import {
	fetchOverlaysFromStorage,
	storeOverlaysToStorage
} from '../util.js';

import './adjacency-map-controls.js';
import './adjacency-map-diagram.js';
import './dialog-element.js';
import { setDialogOpen } from '../actions/dialog.js';

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
	_scenariosOverlays : ScenariosOverlays;

	@state()
	_editedNodes: {[id : NodeID]: {values?: NodeValuesOverride}}

	@state()
	_hashForCurrentState : string;

	@state()
	_selectedNodeID : NodeID | undefined;

	@state()
	_hoveredEdgeID : EdgeIdentifier | undefined;

	@state()
	_dataError : string;

	@state()
	_dialogOpen : boolean;

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
					--stroke-width: 0px;
				}

				adjacency-map-controls {
					position: absolute;
					top: 0;
					left: 0;
					padding: 1em;
					box-sizing: border-box;
					border: 1px solid var(--dark-gray-color);
					width: var(--controls-width);
				}

				adjacency-map-diagram {
					display: flex;
					justify-content: center;
					align-items: center;
				}
			`
		];
	}

	override render() : TemplateResult {
		return html`
			<div class='container'>
					<adjacency-map-controls></adjacency-map-controls>
					<adjacency-map-diagram @node-clicked=${this._handleNodeClicked} @node-hovered=${this._handleNodeHovered} .map=${this._adjacencyMap} .hoveredEdgeID=${this._hoveredEdgeID} .selectedNodeID=${this._selectedNodeID} .scale=${this._scale} .editedNodes=${this._editedNodes}></adjacency-map-diagram>
					<dialog-element .open=${this._dialogOpen} @dialog-should-close=${this._handleDialogShouldClose}>Hello, world!</dialog-element>
			</div>
		`;
	}

	// This is called every time something is updated in the store.
	override stateChanged(state : RootState) {
		this._pageExtra = selectPageExtra(state);
		this._filename = selectFilename(state);
		this._adjacencyMap = selectAdjacencyMap(state);
		this._scale = selectScale(state);
		this._hashForCurrentState = selectHashForCurrentState(state);
		this._selectedNodeID = selectSelectedNodeID(state);
		this._hoveredEdgeID = selectHoveredEdgeID(state);
		this._dataError = selectAdjacencyMapError(state);
		this._scenariosOverlays = selectScenariosOverlays(state);
		this._editedNodes = selectCurrentScenarioEditedNodes(state);
		this._dialogOpen = selectDialogOpen(state);
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

	_handleHashChange() {
		store.dispatch(updateHash(window.location.hash, true));
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

	_handleNodeHovered(e : NodeEvent) {
		store.dispatch(updateHoveredNodeID(e.detail.id));
	}

	_handleNodeClicked(e : NodeEvent) {
		store.dispatch(updateSelectedNodeID(e.detail.id));
	}

	_handleDialogShouldClose() {
		store.dispatch(setDialogOpen(false));
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'main-view': MainView;
	}
}