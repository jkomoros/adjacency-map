import * as d3 from 'd3';

import {
	NodeID,
	LayoutInfo,
	TreeGraphWithDetails
} from './types.js';

//Heavily adapted from https://observablehq.com/@d3/tree

export const TreeLayout = (data : TreeGraphWithDetails) : LayoutInfo => {

	// horizontal padding for first and last column
	const padding = 1;

	const root = d3.hierarchy(data);
  

  
	const width = 640;

	// Compute the layout.
	const dx = 10;
	const dy = width / (root.height + padding);
	const positionedRoot = d3.tree().nodeSize([dx, dy])(root) as d3.HierarchyPointNode<TreeGraphWithDetails>;
  
	const positions : {[id : NodeID] : {x: number, y: number}} = {};

	// Center the tree.
	let x0 = Infinity;
	let x1 = -x0;
	positionedRoot.each(d => {
		if (d.x > x1) x1 = d.x;
		if (d.x < x0) x0 = d.x;
		positions[d.data.name] = {
			x : d.x,
			y: d.y, 
		};
	});
  
	// Compute the default height.
	const height = x1 - x0 + dx * 2;

	const viewBox = [-dy * padding / 2, x0 - dx, width, height] as [number, number, number, number];

	return {
		width,
		height,
		viewBox,
		positions,
		d3Tree: positionedRoot
	};
};

export const TreeSVG = (data : TreeGraphWithDetails) : SVGSVGElement => {

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

	const layout = TreeLayout(data);

	const positionedRoot = layout.d3Tree as d3.HierarchyPointNode<TreeGraphWithDetails>;

	// Compute labels and titles.
	const descendants = positionedRoot.descendants();
	const L = descendants.map(d => d.data.name);
	//TODO: should we render out the SVG using LIT, and just use d3 for the layout logic?
	
	const svg = d3.create("svg")
		.attr("viewBox", layout.viewBox)
		.attr("width", layout.width)
		.attr("height", layout.height)
		.attr("style", "max-width: 100%; height: auto; height: intrinsic;")
		.attr("font-family", "sans-serif")
		.attr("font-size", 10);
  
	svg.append("g")
		.attr("fill", "none")
		.attr("stroke", stroke)
		.attr("stroke-opacity", strokeOpacity)
		.attr("stroke-linecap", strokeLinecap)
		.attr("stroke-linejoin", strokeLinejoin)
		.attr("stroke-width", strokeWidth)
		.selectAll("path")
		.data(positionedRoot.links())
		.join("path")
		.attr("d", d3.linkHorizontal<d3.HierarchyPointLink<TreeGraphWithDetails>, d3.HierarchyPointNode<TreeGraphWithDetails>>()
			.x(d => d.y)
			.y(d => d.x));
  
	const node = svg.append("g")
		.selectAll("a")
		.data(positionedRoot.descendants())
		.join("a")
		.attr("transform", d => `translate(${d.y},${d.x})`);
  
	node.append("circle")
		.attr("fill", d => d.children ? stroke : fill)
		.attr("r", r);
  
	node.append("title")
		.text(d => d.data.description + '\n\n' + Object.entries(d.data.values).map(entry => entry[0] + ': ' + entry[1]).join('\n'));
  
	node.append("text")
		.attr("dy", "0.32em")
		.attr("x", d => d.children ? -6 : 6)
		.attr("text-anchor", d => d.children ? "end" : "start")
		.attr("paint-order", "stroke")
		.attr("stroke", halo)
		.attr("stroke-width", haloWidth)
		.text((_d, i) => L[i]);
  
	return svg.node() as SVGSVGElement;
};