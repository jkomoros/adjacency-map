import { html, css, svg, TemplateResult} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { PageViewElement } from "./page-view-element.js";
import { connect } from "pwa-helpers/connect-mixin.js";

// This element is connected to the Redux store.
import { store } from "../store.js";

import {
	loadData,
	DATA_DIRECTORY
} from "../actions/data.js";

import {
	selectPageExtra,
	selectFilename,
	selectData,
	selectAdjacencyMap,
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
	ExpandedEdgeValue,
	MapDefinition,
	RootState,
} from '../types.js';

import {
	AdjacencyMap
} from '../adjacency-map.js';

const fetchData = async(filename : string) => {
	let res;
	filename = ('' + filename).toLowerCase();
	filename = filename.split('/')[0];
	const path = '/' + DATA_DIRECTORY + '/' + filename + '.json';
	try {
		res = await fetch(path);
	} catch (err) {
		console.warn('Couldn\'t fetch ' + path + ': ' + err);
	}

	if (!res) throw new Error('No data from ' + path);

	const blob = await res.json();

	store.dispatch(loadData(blob));
};

@customElement('main-view')
class MainView extends connect(store)(PageViewElement) {

	@state()
	_pageExtra: string;

	@state()
	_filename: string;

	@state()
	_data : MapDefinition | undefined;

	@state()
	_adjacencyMap : AdjacencyMap | null;

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
			<div class='container'>
				${this._svg()}
			</div>
		`;
	}

	// This is called every time something is updated in the store.
	override stateChanged(state : RootState) {
		this._pageExtra = selectPageExtra(state);
		this._filename = selectFilename(state);
		this._data = selectData(state);
		this._adjacencyMap = selectAdjacencyMap(state);
	}

	override updated(changedProps : Map<string, MainView[keyof MainView]>) {
		if (changedProps.has('_filename') && this._filename) {
			fetchData(this._filename);
		}
	}

	_pathForEdge(edge : ExpandedEdgeValue, map : AdjacencyMap) : string {

		const sourceNode = map.node(edge.source);
		const refNode = map.node(edge.ref);
		const midPoint = (refNode.y + sourceNode.y) / 2;
		
		const result = `M ${refNode.y},${refNode.x}C${midPoint},${refNode.x},${midPoint},${sourceNode.x},${sourceNode.y},${sourceNode.x}`;
		return result;
	}

	_svg() : TemplateResult {
		if (!this._adjacencyMap) return svg``;

		const a = this._adjacencyMap;
		
		// radius of nodes
		const r = 3;

		// fill for nodes
		const fill = '#999';
		// stroke for links
		const stroke = '#555';
		// stroke width for links
		const strokeWidth = 1.5;
		// stroke opacity for links
		const strokeOpacity = 0.4;
		// stroke line join for links
		const strokeLinejoin = '';
		// stroke line cap for links
		const strokeLinecap = '';
		// color of label halo 
		const halo = '#fff';
		// padding around the labels
		const haloWidth = 3;

		return html`<svg class='main' viewBox='${a.viewBox}' width='${a.width}' height='${a.height}' style='max-width: 100%; height: auto; height: intrinsic;' font-family='sans-serif' font-size='10'>
			<g fill="none" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-linecap="${strokeLinecap}" stroke-linejoin="${strokeLinejoin}" stroke-width="${strokeWidth}">
				${a.edges.map(edge => svg`<path d="${this._pathForEdge(edge, a)}"></path>`)}
			</g>
			<g>
				${Object.values(a.nodes).map(node => svg`<a transform="translate(${node.y},${node.x})">
					<circle fill="${node.children.length == 0 ? fill : stroke}" r="${r}"></circle>
					<title>${node.description + '\n\n' + Object.entries(node.values).map(entry => entry[0] + ': ' + entry[1]).join('\n')}</title>
					<text dy="0.32em" x="${(node.children.length == 0 ? 1 : -1) * r * 2}" text-anchor="${node.children.length == 0 ? 'start' : 'end'}" paint-order="stroke" stroke="${halo}" stroke-width="${haloWidth}">${node.id}</text>
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