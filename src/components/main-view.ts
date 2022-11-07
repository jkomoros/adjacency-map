import { html, css, svg, TemplateResult} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { PageViewElement } from "./page-view-element.js";
import { connect } from "pwa-helpers/connect-mixin.js";

// This element is connected to the Redux store.
import { store } from "../store.js";

import {
	beginEditingScenario,
	nextScenarioName,
	previousScenarioName,
	updateFilename,
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
	NodeID,
	NodeValues,
	RenderEdgeValue,
	RootState,
	ScenarioName,
	TagID,
	TagMap,
} from '../types.js';

import {
	AdjacencyMap
} from '../adjacency-map.js';

import {
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
	PLUS_ICON
} from './my-icons.js';

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
		return html`
			<div class='controls'>
				${this._legalFilenames && this._legalFilenames.length > 1 ? html`
				<label for='filenames'>File</label>
				<select id='filenames' .value=${this._filename} @change=${this._handleFilenameChanged}>
					${this._legalFilenames.map(filename => html`<option .value=${filename}>${filename}</option>`)}
				</select>` : ''}
				${this._legalScenarioNames.length > 1 ? html`
				<label for='scenarios'>Scenario</label>
				<select id='scenarios' .value=${this._scenarioName} @change=${this._handleScenarioNameChanged}>
					${this._legalScenarioNames.map(scenarioName => html`<option .value=${scenarioName} .selected=${scenarioName == this._scenarioName}>${scenarioName || 'Default'}</option>`)}
				</select>` : ''}
				${ENABLE_EDITING_SCENARIOS ? html`<button class='small' title='Create a new scenario based on the current scenario' @click=${this._handleCreateScenarioClicked}>${PLUS_ICON}</button>` : ''}
				<div class='summary'>
					<div>
						<label>Node</label> <strong>${this._summaryNodeDisplayName === undefined ? html`<em>Union of all nodes</em>` : (this._summaryNodeDisplayName || html`<em>Root</em>`)}</strong>
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
						${Object.entries(this._summaryValues).filter(entry => this._showHiddenValues || !this._adjacencyMap?.data.properties[entry[0]].hide).map(entry => html`<div><strong title='${this._adjacencyMap?.data.properties[entry[0]].description || ''}' class='${this._adjacencyMap?.data.properties[entry[0]].hide || false ? 'hidden' : ''}'>${entry[0]}</strong>: ${parseFloat(entry[1].toFixed(2))}</div>`)}
					</div>
					${Object.keys(this._summaryTags).length && this._adjacencyMap ? 
		html`<label>Tags</label>
				${Object.keys(this._adjacencyMap.data.tags).map(tagName => this._htmlForTag(tagName, this._summaryTags))}`
		: ''}
				</div>
			</div>
			<div class='container'>
				${this._svg()}
			</div>
		`;
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
		this._summaryNodeDisplayName = selectSummaryNodeDisplayName(state);
		this._summaryTags = selectSummaryTags(state);
		this._summaryValues = selectSummaryValues(state);
		this._showHiddenValues = selectShowHiddenValues(state);
		this._dataError = selectAdjacencyMapError(state);
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
	}

	override firstUpdated() {
		document.addEventListener('keydown', e => this._handleKeyDown(e));
		window.addEventListener('resize', () => this.resizeVisualization());
		this.resizeVisualization();
		store.dispatch(canonicalizePath());
		window.addEventListener('hashchange', () => this._handleHashChange());
		this._handleHashChange();
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

	_handleShowHiddenValuesClicked() {
		store.dispatch(updateShowHiddenValues(!this._showHiddenValues));
	}

	_handleCreateScenarioClicked() {
		store.dispatch(beginEditingScenario());
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
				${a.renderEdges.map(edge => svg`<path d="${this._pathForEdge(edge, a)}" stroke-width='${edge.width}' stroke-opacity='${edge.opacity}' stroke='${edge.color.rgbaStr}'><title>${this._titleForEdge(edge)}</title></path>`)}
			</g>
			<g>
				${Object.values(a.nodes).map(node => svg`<a transform="translate(${node.x},${node.y})">
					<circle class='${this._selectedNodeID == node.id ? 'selected' : ''}' @mousemove=${this._handleSVGMouseMove} @click=${this._handleSVGMouseClick} id="${'node:' + node.id}" fill="${node.color.rgbaStr}" r="${node.radius}" opacity="${node.opacity}" stroke="${node.strokeColor.rgbaStr}" stroke-width="${node.strokeWidth}" stroke-opacity="${node.strokeOpacity}"></circle>
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