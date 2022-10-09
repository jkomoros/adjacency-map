import { html, css, svg, TemplateResult} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { PageViewElement } from "./page-view-element.js";
import { connect } from "pwa-helpers/connect-mixin.js";

// This element is connected to the Redux store.
import { store } from "../store.js";

import {
	nextScenarioName,
	previousScenarioName,
	updateFilename,
	updateHoveredNodeID,
	updateScale,
	updateScenarioName,
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
	RenderEdgeValue,
	RootState,
	ScenarioName,
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
					${this._legalScenarioNames.map(scenarioName => html`<option .value=${scenarioName}>${scenarioName || 'Default'}</option>`)}
				</select>` : ''}
				<pre class='result'>Total: ${'\n' + this._adjacencyMap?.resultDescription() || ''}</pre>
			</div>
			<div class='container'>
				${this._svg()}
			</div>
		`;
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
	}

	override updated(changedProps : Map<string, MainView[keyof MainView]>) {
		//We're responsible for calling updateWithSimPageExtra
		if ((changedProps.has('_pageExtra')) && this._pageExtra) {
			store.dispatch(updateWithMainPageExtra(this._pageExtra));
		}
		if (changedProps.has('_hashForCurrentState')) {
			store.dispatch(canonicalizeHash());
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
		const refNode = map.node(edge.ref);
		let midPoint = (sourceNode.x - refNode.x) * edge.bump + refNode.x;
		let yBoost = 0.0;

		//If the source and ref are both at the same y, then bumping won't show
		//anyting by default. So instead of bumping the x left and right, bump
		//the y up and down.
		if (sourceNode.y == refNode.y) {
			//In this case just bump up and down
			midPoint = (sourceNode.x + refNode.x) / 2;
			yBoost = (sourceNode.x - refNode.x) / 2 * (edge.bump - 0.5);
		}

		const result = `M ${refNode.x},${refNode.y}C${midPoint},${refNode.y - yBoost},${midPoint},${sourceNode.y - yBoost},${sourceNode.x},${sourceNode.y}`;
		return result;
	}

	_handleSVGMouseMove(e : MouseEvent) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof Element)) throw new Error('unexpected node');
		const id = ele.id.includes('node:') ? ele.id.replace('node:', '') : undefined;
		store.dispatch(updateHoveredNodeID(id));
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

		return html`<svg @mousemove=${this._handleSVGMouseMove} class='main' viewBox='${a.viewBox}' width='${a.width * this._scale}' height='${a.height * this._scale}' style='max-width: 100%; height: auto; height: intrinsic;' font-family='sans-serif' font-size='10'>
			<g fill="none" stroke-linecap="${strokeLinecap}" stroke-linejoin="${strokeLinejoin}">
				${a.renderEdges.map(edge => svg`<path d="${this._pathForEdge(edge, a)}" stroke-width='${edge.width}' stroke-opacity='${edge.opacity}' stroke='${edge.color.rgbaStr}'></path>`)}
			</g>
			<g>
				${Object.values(a.nodes).map(node => svg`<a transform="translate(${node.x},${node.y})">
					<circle @mousemove=${this._handleSVGMouseMove} id="${'node:' + node.id}" fill="${node.color.rgbaStr}" r="${node.radius}" opacity="${node.opacity}" stroke="${node.strokeColor.rgbaStr}" stroke-width="${node.strokeWidth}" stroke-opacity="${node.strokeOpacity}"></circle>
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