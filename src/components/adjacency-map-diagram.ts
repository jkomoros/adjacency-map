import { html, css, svg, TemplateResult, LitElement} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { StyleInfo, styleMap } from 'lit/directives/style-map.js';
import { classMap, ClassInfo } from 'lit/directives/class-map.js';

// These are the shared styles needed by this element.
import { SharedStyles } from "./shared-styles.js";

import {
	ButtonSharedStyles
} from "./button-shared-styles.js";

import {
	EdgeIdentifier,
	LayoutID,
	NodeID,
	RenderEdgeValue,
	ScenarioNode,
} from '../types.js';

import {
	renderEdgeStableID,
	edgeIdentifierEquivalent,
	edgeIdentifiersFromRenderEdge
} from '../util.js';

import {
	AdjacencyMap,
	AdjacencyMapNode,
	isLayoutID,
	LayoutNode
} from '../adjacency-map.js';

@customElement('adjacency-map-diagram')
class AdjacencyMapDiagram extends LitElement {

	@property({type: Object})
	hoveredEdgeID : EdgeIdentifier | undefined

	@property({type: String})
	selectedLayoutID : LayoutID | undefined

	@property({type: String})
	hoveredLayoutID : LayoutID | undefined

	@property({type: Object})
	map: AdjacencyMap | null

	@property({type: Number})
	scale: number

	@property({type : Object})
	editedNodes: {
		[id : NodeID] : ScenarioNode
	}

	static override get styles() {
		return [
			SharedStyles,
			ButtonSharedStyles,
			css`
				:host {
					--stroke-width: 0px;
				}

				circle {
					stroke-dasharray: 0;
					stroke-dashoffset: calc(var(--effective-stroke-width) * 2);
					stroke-width: var(--effective-stroke-width);
					--effective-stroke-width: max(var(--stroke-width), var(--min-stroke-width));
					--min-stroke-width: 0px;
					--default-min-stroke-width: 3px;
					cursor: pointer;
				}

				circle:hover {
					cursor: pointer;
					stroke: white !important;

				}

				circle.selected {
					stroke-dasharray: var(--effective-stroke-width);
					animation: 1s linear infinite normal march;
				}

				circle:hover, circle.selected {
					--min-stroke-width: var(--default-min-stroke-width);
					opacity: 1.0 !important;
					stroke-opacity: 1.0 !important;
				}

				circle.edited {
					stroke-dasharray: calc(var(--effective-stroke-width) / 2);
					--min-stroke-width: var(--default-min-stroke-width);
				}

				svg text {
					user-select: none;
					pointer-events: none;
				}

				svg * {
					transition: all 0.1s ease-in-out;
				}

				svg path {
					--min-stroke-width: 0px;
					--default-min-stroke-width: 3px;
					--effective-stroke-width: max(var(--min-stroke-width), var(--stroke-width));
					stroke-width: var(--effective-stroke-width);
					stroke-dashoffset: calc(var(--effective-stroke-width) * 2);
					stroke-dasharray: 0;
				}

				svg path.hovered {
					--min-stroke-width: var(--default-min-stroke-width);
					stroke-dasharray: var(--effective-stroke-width);
					animation: 1s linear infinite normal march;
				}

				@keyframes march {
					to {
						stroke-dashoffset: 0;
					}
				}

			`
		];
	}

	constructor() {
		super();
		this.scale = 1.0;
	}

	override render() : TemplateResult {
		return html`
			<div class='container'>
				${this._svg()}
			</div>
		`;
	}

	_pathForEdge(edge : RenderEdgeValue, map : AdjacencyMap) : string {

		const sourceNode = map.layoutNode(edge.source);
		const parentNode = map.layoutNode(edge.parent);
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

	_svgForEdge(edge : RenderEdgeValue, map : AdjacencyMap) : TemplateResult {
		const hovered = edgeIdentifiersFromRenderEdge(edge).some(id => edgeIdentifierEquivalent(this.hoveredEdgeID, id));
		const styles : StyleInfo = {
			'--stroke-width': String(edge.width) + 'px'
		};
		return svg`<path class='${hovered ? 'hovered' : ''}' style='${styleMap(styles)}' d="${this._pathForEdge(edge, map)}" stroke-opacity='${edge.opacity}' stroke='${edge.color.rgbaStr}'><title>${this._titleForEdge(edge)}</title></path>`;
	}

	_svgForNode(node : LayoutNode) : TemplateResult {
		//For now, only render top-level nodes.
		if (node.group) return svg``;
		// color of label halo 
		const halo = '#fff';
		// padding around the labels
		const haloWidth = 3;
		const selected = this.selectedLayoutID == node._layoutID;
		const edited = this.editedNodes && (node instanceof AdjacencyMapNode) && this.editedNodes[node.id] != undefined;
		const classes : ClassInfo = {
			selected,
			edited
		};
		const styles : StyleInfo = {
			'--stroke-width': String(node.strokeWidth) + 'px'
		};
		const renderText = this.hoveredLayoutID == undefined ? true : this.hoveredLayoutID == node._layoutID;
		return svg`<a transform="translate(${node.x},${node.y})">
			<circle class='${classMap(classes)}' style='${styleMap(styles)}' @mousemove=${this._handleSVGMouseMove} @click=${this._handleSVGMouseClick} id="${node._layoutID}" fill="${node.color.rgbaStr}" r="${node.radius}" opacity="${node.opacity}" stroke="${node.strokeColor.rgbaStr}" stroke-opacity="${node.strokeOpacity}"></circle>
			<title>${node.fullDescription()}</title>
			<text dy="0.32em" x="${(node.hasChildren ? -1 : 1) * node.radius * 2}" text-anchor="${node.hasChildren ? 'end' : 'start'}" paint-order="stroke" stroke="${halo}" stroke-width="${haloWidth}" opacity="${renderText ? '1.0' : '0.0'}">${node.displayName}</text>
		</a>`;
	}

	_handleSVGMouseMove(e : MouseEvent) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof Element)) throw new Error('unexpected node');
		const id = isLayoutID(ele.id) ? ele.id : undefined;
		this.dispatchEvent(new CustomEvent('node-hovered', {composed: true, detail: {id}}));
	}

	_handleSVGMouseClick(e : MouseEvent) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof Element)) throw new Error('unexpected node');
		const id = isLayoutID(ele.id) ? ele.id : undefined;
		this.dispatchEvent(new CustomEvent('node-clicked', {composed: true, detail: {id}}));
	}

	_svg() : TemplateResult {
		if (!this.map) return svg``;

		const a = this.map;
		
		// stroke line join for links
		const strokeLinejoin = '';
		// stroke line cap for links
		const strokeLinecap = '';

		return html`<svg @mousemove=${this._handleSVGMouseMove} @click=${this._handleSVGMouseClick} class='main' viewBox='${a.viewBox}' width='${a.width * this.scale}' height='${a.height * this.scale}' style='max-width: 100%; height: auto; height: intrinsic;' font-family='sans-serif' font-size='10'>
			<g fill="none" stroke-linecap="${strokeLinecap}" stroke-linejoin="${strokeLinejoin}">
				${repeat(a.renderEdges, edge => renderEdgeStableID(edge), edge => this._svgForEdge(edge, a))}
			</g>
			<g>
				${repeat(Object.values(a.layoutNodes), node => node._layoutID, node => this._svgForNode(node))}
			</g>
	</svg>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'adjacency-map-diagram': AdjacencyMapDiagram;
	}
}