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
	JSONData,
	RootState,
} from '../types.js';

import {
	AdjacencyMap
} from '../adjacency-map.js';
import { TreeSVG } from '../tree-svg.js';


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
	_data : JSONData | undefined;

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

	_svg() : SVGSVGElement | TemplateResult {
		if (!this._adjacencyMap) return svg``;
		return TreeSVG(this._adjacencyMap.treeGraph());
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'main-view': MainView;
	}
}