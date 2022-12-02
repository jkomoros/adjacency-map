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
	selectDialogOpen,
	selectDialogKind,
	selectDialogMessage,
	selectCurrentScenarioOverlay
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
	DialogKind,
	EdgeIdentifier,
	NodeEvent,
	NodeID,
	NodeValuesOverride,
	RootState,
	ScenarioName,
	ScenariosOverlays,
	ScenarioWithExtends,
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
	closeDialog, showError
} from '../actions/dialog.js';

import {
	assertUnreachable,
	fetchOverlaysFromStorage,
	storeOverlaysToStorage
} from '../util.js';

import {
	CHECK_CIRCLE_OUTLINE_ICON
} from './my-icons.js';

import './adjacency-map-controls.js';
import './adjacency-map-diagram.js';
import './dialog-element.js';

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

	@state()
	_dialogKind : DialogKind;

	@state()
	_dialogMessage : string;

	@state()
	_currentScenarioOverlay : {
		[name : ScenarioName] : ScenarioWithExtends
	};

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

				dialog-element .buttons {
					display: flex;
					justify-content: flex-end;
				}

				dialog-element .content {
					display: flex;
					flex-direction: column;
					height: 100%;
					width: 100%;
				}

				dialog-element .content .spacer {
					flex-grow: 1;
				}

				pre {
					margin-top: 0;
					margin-bottom: 0;
				}

				pre.noselect {
					user-select: none;
				}

				.instructions {
					user-select: none;
				}
			`
		];
	}

	override render() : TemplateResult {
		return html`
			<div class='container'>
					<adjacency-map-controls></adjacency-map-controls>
					<adjacency-map-diagram @node-clicked=${this._handleNodeClicked} @node-hovered=${this._handleNodeHovered} .map=${this._adjacencyMap} .hoveredEdgeID=${this._hoveredEdgeID} .selectedNodeID=${this._selectedNodeID} .scale=${this._scale} .editedNodes=${this._editedNodes}></adjacency-map-diagram>
					<dialog-element .open=${this._dialogOpen} .title=${this._dialogTitle} @dialog-should-close=${this._handleDialogShouldClose} .hideClose=${true}>${this._dialogContent}</dialog-element>
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
		this._dialogKind = selectDialogKind(state);
		this._dialogMessage = selectDialogMessage(state);
		this._currentScenarioOverlay = selectCurrentScenarioOverlay(state);
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
			store.dispatch(showError(this._dataError));
			console.warn(this._dataError);
		}
		if (changedProps.has('_scenariosOverlays')) {
			storeOverlaysToStorage(this._scenariosOverlays);
		}
		if (changedProps.has('_dialogOpen') && this._dialogOpen) {
			this._dialogOpened();
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
		store.dispatch(closeDialog());
	}

	_withButtons(inner : TemplateResult) : TemplateResult {
		return html`
		<div class='content'>
			<div class='inner'>${inner}</div>
			<div class='spacer'></div>
			<div class='buttons'>
					<button class='round' @click=${this._handleDialogShouldClose}>${CHECK_CIRCLE_OUTLINE_ICON}</button>
			</div>
		</div>`;
	}

	get _dialogContent() : TemplateResult {
		switch(this._dialogKind){
		case 'readout':
			return this._withButtons(this._dialogContentReadout);
		case 'error':
			return this._withButtons(html`${this._dialogMessage}`);
		case '':
			return this._withButtons(html`An unknown error has occurred.`);
		}

		assertUnreachable(this._dialogKind);
	}

	get _dialogContentReadout() : TemplateResult {
		//TODO: have a select for switching to different files in this dialog, too.
		const content = JSON.stringify(this._currentScenarioOverlay, null, '\t');
		const trimmedContent = content.slice(2, -2);
		const tabbedContent = '\t' + trimmedContent.split('\n').join('\n\t');
		return html`<div class='instructions'><em>Copy/paste the selected content into the end of the <code>scenarios</code> block of <code>data/${this._filename}.ts</code></em></div>
<pre class='noselect'>const data : RawMapDefinition = {
	//...
	scenarios: {
		//...</pre>
<pre class='main'>${tabbedContent}</pre>
<pre class='noselect'>	}
};</pre>
		`;
	}

	get _dialogTitle() : string {
		switch(this._dialogKind){
		case 'readout':
			return 'Changes';
		case 'error':
		case '':
			return 'Error';
		}

		assertUnreachable(this._dialogKind);
	}

	_dialogOpened() : void {
		switch (this._dialogKind) {
		case 'readout':
			return this._dialogOpenedReadout();
		case 'error':
		case '':
			return;
		}
		assertUnreachable(this._dialogKind);
	}

	_dialogOpenedReadout() : void {
		const root = this.shadowRoot;
		if (!root) throw new Error('no root');
		const pre = root.querySelector('pre.main');
		if (!pre) throw new Error('no pre');
		const range = document.createRange();
		const selection = window.getSelection();
		if (!selection) throw new Error('no selection');
		selection.removeAllRanges();
		range.selectNodeContents(pre);
		selection.addRange(range);
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'main-view': MainView;
	}
}