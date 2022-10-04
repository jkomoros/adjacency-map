import { html, css, svg, TemplateResult} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { PageViewElement } from "./page-view-element.js";
import { connect } from "pwa-helpers/connect-mixin.js";

// This element is connected to the Redux store.
import { store } from "../store.js";

import {
	updateFilename,
	updateScale,
	updateWithMainPageExtra
} from "../actions/data.js";

import {
	selectPageExtra,
	selectFilename,
	selectAdjacencyMap,
	selectScale,
	selectLegalFilenames,
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
} from '../types.js';

import {
	AdjacencyMap
} from '../adjacency-map.js';

import {
	SVG_HEIGHT,
	SVG_WIDTH
} from '../constants.js';

import {
	canonicalizePath
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
	}

	override updated(changedProps : Map<string, MainView[keyof MainView]>) {
		//We're responsible for calling updateWithSimPageExtra
		if ((changedProps.has('_pageExtra')) && this._pageExtra) {
			store.dispatch(updateWithMainPageExtra(this._pageExtra));
		}
	}

	override firstUpdated() {
		window.addEventListener('resize', () => this.resizeVisualization());
		this.resizeVisualization();
		store.dispatch(canonicalizePath());
	}

	_handleFilenameChanged(e : Event) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof HTMLSelectElement)) throw new Error('not a select element');
		store.dispatch(updateFilename(ele.value));
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
		const midPoint = (refNode.x + sourceNode.x) / 2;
		
		const result = `M ${refNode.x},${refNode.y}C${midPoint},${refNode.y},${midPoint},${sourceNode.y},${sourceNode.x},${sourceNode.y}`;
		return result;
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

		return html`<svg class='main' viewBox='${a.viewBox}' width='${a.width * this._scale}' height='${a.height * this._scale}' style='max-width: 100%; height: auto; height: intrinsic;' font-family='sans-serif' font-size='10'>
			<g fill="none" stroke-linecap="${strokeLinecap}" stroke-linejoin="${strokeLinejoin}">
				${a.renderEdges.map(edge => svg`<path d="${this._pathForEdge(edge, a)}" stroke-width='${edge.width}' stroke-opacity='${edge.opacity}' stroke='${edge.color.rgbaStr}'></path>`)}
			</g>
			<g>
				${Object.values(a.nodes).map(node => svg`<a transform="translate(${node.x},${node.y})">
					<circle fill="${node.color.rgbaStr}" r="${node.radius}" opacity="${node.opacity}"></circle>
					<title>${node.fullDescription()}</title>
					<text dy="0.32em" x="${(node.children.length == 0 ? 1 : -1) * node.radius * 2}" text-anchor="${node.children.length == 0 ? 'start' : 'end'}" paint-order="stroke" stroke="${halo}" stroke-width="${haloWidth}">${node.id}</text>
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