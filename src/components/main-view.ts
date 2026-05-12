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
	updateHoveredLayoutID,
	updateScale,
	updateSelectedLayoutID,
	updateWithMainPageExtra
} from "../actions/data.js";

import {
	selectPageExtra,
	selectFilename,
	selectAdjacencyMap,
	selectScale,
	selectHashForCurrentState,
	selectAdjacencyMapError,
	selectScenariosOverlays,
	selectCurrentScenarioEditedNodes,
	selectHoveredEdgeID,
	selectDialogOpen,
	selectDialogKind,
	selectDialogMessage,
	selectCurrentScenarioOverlay,
	selectHoveredLayoutID,
	selectSelectedLayoutID,
	selectHeadlineMetrics,
	selectCompareScenarioName,
	selectCompareAdjacencyMap,
	selectComparisonDelta,
	selectSearchMatches,
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
	LayoutID,
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
	generateMarkdownReport,
	exportSVGToPNG,
	downloadBlob
} from '../export.js';

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
	closeDialog,
	showHelp
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
	_selectedLayoutID : LayoutID | undefined;

	@state()
	_hoveredLayoutID : LayoutID | undefined;

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

	@state()
	_headlineMetrics : {property: string, value: number}[] = [];

	@state()
	_compareScenarioName : ScenarioName | undefined = undefined;

	@state()
	_compareAdjacencyMap : AdjacencyMap | null = null;

	@state()
	_comparisonDelta : { perNode: {[id: string]: 'changed' | 'added' | 'removed'}, perProperty: {property: string, a: number, b: number, delta: number}[] } | null = null;

	@state()
	_searchMatches : Set<string> | null = null;

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

				.error-banner {
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					z-index: 100;
					background: #b00020;
					color: white;
					padding: 0.5em 1em;
					font-family: monospace;
					font-size: 0.85em;
					white-space: pre-wrap;
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
				}
				.error-banner strong {
					display: block;
					margin-bottom: 0.25em;
					font-family: var(--app-text-font-family, sans-serif);
					font-size: 1em;
				}
				.error-banner a {
					color: white;
					text-decoration: underline;
					cursor: pointer;
				}

				.metrics-strip {
					position: absolute;
					top: 0;
					right: 0;
					z-index: 50;
					display: flex;
					gap: 0.5em;
					padding: 0.5em;
					background: rgba(255, 255, 255, 0.85);
					border-bottom-left-radius: 8px;
					font-size: 0.85em;
					box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
				}
				.metric-tile {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					padding: 0.25em 0.5em;
					border-right: 1px solid #ddd;
				}
				.metric-tile:last-child {
					border-right: none;
				}
				.metric-label {
					font-size: 0.75em;
					color: #555;
					text-transform: uppercase;
					letter-spacing: 0.05em;
				}
				.metric-value {
					font-weight: bold;
					font-variant-numeric: tabular-nums;
				}

				.compare-strip {
					position: absolute;
					top: 0;
					left: 50%;
					transform: translateX(-50%);
					z-index: 40;
					display: flex;
					gap: 0.75em;
					padding: 0.5em 1em;
					background: rgba(255, 255, 255, 0.9);
					border-bottom-left-radius: 8px;
					border-bottom-right-radius: 8px;
					font-size: 0.85em;
					box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
				}
				.compare-metric {
					display: flex;
					flex-direction: column;
					align-items: center;
				}
				.compare-metric .label {
					font-size: 0.75em;
					color: #555;
				}
				.compare-metric .values {
					font-variant-numeric: tabular-nums;
				}
				.compare-delta-pos { color: #43a047; font-weight: bold; }
				.compare-delta-neg { color: #e53935; font-weight: bold; }
				.diagram-pair {
					display: flex;
					gap: 0.5em;
					width: 100%;
				}
				.diagram-pair > * {
					flex: 1 1 0;
					min-width: 0;
				}
				.export-actions {
					margin-top: 0.75em;
					display: flex;
					gap: 0.5em;
					justify-content: flex-end;
				}
				.export-actions button {
					padding: 0.4em 0.9em;
					cursor: pointer;
				}
			`
		];
	}

	override render() : TemplateResult {
		const compareOn = !!this._compareAdjacencyMap;
		return html`
			<div class='container'>
					${this._dataError ? html`
						<div class='error-banner'>
							<strong>Data error in <code>${this._filename}</code></strong>
							${this._dataError}
							<div><a @click=${() => window.location.reload()}>Reload</a></div>
						</div>` : ''}
					${!this._dataError && this._headlineMetrics.length > 0 && !compareOn ? html`
						<div class='metrics-strip'>
							${this._headlineMetrics.map(m => html`
								<div class='metric-tile'>
									<span class='metric-label'>${m.property}</span>
									<span class='metric-value'>${m.value.toFixed(2)}</span>
								</div>
							`)}
						</div>` : ''}
					${compareOn && this._comparisonDelta ? html`
						<div class='compare-strip'>
							${this._comparisonDelta.perProperty.slice(0, 6).map(p => html`
								<div class='compare-metric'>
									<span class='label'>${p.property}</span>
									<span class='values'>${p.a.toFixed(2)} / ${p.b.toFixed(2)}</span>
									<span class='${p.delta >= 0 ? 'compare-delta-pos' : 'compare-delta-neg'}'>${p.delta >= 0 ? '+' : ''}${p.delta.toFixed(2)}</span>
								</div>
							`)}
						</div>` : ''}
					<adjacency-map-controls></adjacency-map-controls>
					${compareOn ? html`
						<div class='diagram-pair'>
							<adjacency-map-diagram @node-clicked=${this._handleNodeClicked} @node-hovered=${this._handleNodeHovered} .map=${this._adjacencyMap} .compareDelta=${this._comparisonDelta} .hoveredEdgeID=${this._hoveredEdgeID} .hoveredLayoutID=${this._hoveredLayoutID} .selectedLayoutID=${this._selectedLayoutID} .scale=${this._scale * 0.5} .editedNodes=${this._editedNodes} .searchMatches=${this._searchMatches}></adjacency-map-diagram>
							<adjacency-map-diagram .map=${this._compareAdjacencyMap} .compareDelta=${this._comparisonDelta} .scale=${this._scale * 0.5} .searchMatches=${this._searchMatches}></adjacency-map-diagram>
						</div>
					` : html`
						<adjacency-map-diagram @node-clicked=${this._handleNodeClicked} @node-hovered=${this._handleNodeHovered} .map=${this._adjacencyMap} .hoveredEdgeID=${this._hoveredEdgeID} .hoveredLayoutID=${this._hoveredLayoutID} .selectedLayoutID=${this._selectedLayoutID} .scale=${this._scale} .editedNodes=${this._editedNodes} .searchMatches=${this._searchMatches}></adjacency-map-diagram>
					`}
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
		this._selectedLayoutID = selectSelectedLayoutID(state);
		this._hoveredLayoutID = selectHoveredLayoutID(state);
		this._hoveredEdgeID = selectHoveredEdgeID(state);
		this._dataError = selectAdjacencyMapError(state);
		this._scenariosOverlays = selectScenariosOverlays(state);
		this._editedNodes = selectCurrentScenarioEditedNodes(state);
		this._dialogOpen = selectDialogOpen(state);
		this._dialogKind = selectDialogKind(state);
		this._dialogMessage = selectDialogMessage(state);
		this._currentScenarioOverlay = selectCurrentScenarioOverlay(state);
		this._headlineMetrics = selectHeadlineMetrics(state);
		this._compareScenarioName = selectCompareScenarioName(state);
		this._compareAdjacencyMap = selectCompareAdjacencyMap(state);
		this._comparisonDelta = selectComparisonDelta(state);
		this._searchMatches = selectSearchMatches(state);
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
		} else if (e.key == 'Escape') {
			store.dispatch(updateSelectedLayoutID(undefined));
		} else if (e.key == '?') {
			store.dispatch(showHelp());
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
		store.dispatch(updateHoveredLayoutID(e.detail.id));
	}

	_handleNodeClicked(e : NodeEvent) {
		store.dispatch(updateSelectedLayoutID(e.detail.id));
	}

	_handleDialogShouldClose() {
		store.dispatch(closeDialog());
	}

	_withButtons(inner : TemplateResult) : TemplateResult {
		return html`
			${inner}
			<button slot='buttons' class='round' @click=${this._handleDialogShouldClose}>${CHECK_CIRCLE_OUTLINE_ICON}</button>
		`;
	}

	get _dialogContent() : TemplateResult {
		switch(this._dialogKind){
		case 'readout':
			return this._withButtons(this._dialogContentReadout);
		case 'export':
			return this._withButtons(this._dialogContentExport);
		case 'help':
			return this._withButtons(this._dialogContentHelp);
		case 'error':
			return this._withButtons(html`${this._dialogMessage}`);
		case '':
			return this._withButtons(html`An unknown error has occurred.`);
		}

		assertUnreachable(this._dialogKind);
	}

	get _dialogContentHelp() : TemplateResult {
		return html`
<div class='help'>
<h4>Keyboard shortcuts</h4>
<ul>
	<li><kbd>←</kbd> / <kbd>→</kbd> — Cycle scenarios</li>
	<li><kbd>Esc</kbd> — Clear node selection (or close this dialog)</li>
	<li><kbd>?</kbd> — Open this help</li>
	<li><kbd>Enter</kbd> in the search box — Select the first matching node</li>
</ul>
<h4>CLI commands</h4>
<ul>
	<li><code>npm run serve</code> — Dev server (with data watcher and state sidecar)</li>
	<li><code>npm run validate</code> — Verify every scenario in every data file constructs cleanly</li>
	<li><code>npm run inspect -- &lt;file&gt; [scenario]</code> — Structured summary of aggregate values + top nodes</li>
	<li><code>npm run diff -- &lt;file&gt; &lt;a&gt; &lt;b&gt;</code> — What's different between two scenarios</li>
	<li><code>npm run rank -- &lt;file&gt; &lt;property&gt; [--ascending]</code> — Rank scenarios by an aggregate</li>
	<li><code>npm run test:smoke</code> — End-to-end smoke test in a headless browser</li>
</ul>
<h4>Agent context</h4>
<ul>
	<li>While the dev server is running, <code>/tmp/adjacency-state.json</code> reflects the current view (file, scenario, selection, compare scenario, hover).</li>
	<li>See <code>AGENTS.md</code> at the repo root for the full agent guide.</li>
</ul>
</div>`;
	}

	get _dialogContentExport() : TemplateResult {
		if (!this._adjacencyMap) return html`<em>No map loaded.</em>`;
		const baseMap = this._adjacencyMap.scenarioName
			? this._buildBaseMapForExport()
			: null;
		const markdown = generateMarkdownReport({
			filename: this._filename || '',
			scenarioName: this._adjacencyMap.scenarioName || '',
			map: this._adjacencyMap,
			baseMap,
			headlineMetrics: this._headlineMetrics
		});
		return html`<div class='instructions'><em>Markdown report below is auto-selected — copy or download below.</em></div>
<pre class='main'>${markdown}</pre>
<div class='export-actions'>
	<button @click=${() => this._handleDownloadMarkdown(markdown)}>Download .md</button>
	<button @click=${this._handleDownloadPNG}>Download .png</button>
</div>`;
	}

	_buildBaseMapForExport() : AdjacencyMap | null {
		try {
			const data = this._adjacencyMap?.data;
			if (!data) return null;
			return new AdjacencyMap(data, '');
		} catch {
			return null;
		}
	}

	_handleDownloadMarkdown(markdown : string) {
		const blob = new Blob([markdown], { type: 'text/markdown' });
		const name = `${this._filename || 'map'}__${this._adjacencyMap?.scenarioName || 'base'}.md`;
		downloadBlob(blob, name);
	}

	async _handleDownloadPNG() {
		const diagram = this.shadowRoot?.querySelector('adjacency-map-diagram');
		const svg = diagram?.shadowRoot?.querySelector('svg.main') as SVGSVGElement | null;
		if (!svg) {
			console.warn('No SVG found to export');
			return;
		}
		try {
			const blob = await exportSVGToPNG(svg, 2);
			const name = `${this._filename || 'map'}__${this._adjacencyMap?.scenarioName || 'base'}.png`;
			downloadBlob(blob, name);
		} catch (err) {
			console.warn('PNG export failed:', err);
		}
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
		case 'export':
			return 'Export';
		case 'help':
			return 'Keyboard shortcuts & CLI';
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
		case 'export':
			return this._dialogOpenedExport();
		case 'help':
		case 'error':
		case '':
			return;
		}
		assertUnreachable(this._dialogKind);
	}

	_dialogOpenedExport() : void {
		const root = this.shadowRoot;
		if (!root) return;
		const pre = root.querySelector('pre.main');
		if (!pre) return;
		const range = document.createRange();
		const selection = window.getSelection();
		if (!selection) return;
		selection.removeAllRanges();
		range.selectNodeContents(pre);
		selection.addRange(range);
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