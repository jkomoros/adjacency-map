import * as d3 from 'd3';

import {
	TreeGraphWithDetails
} from './types.js';

//Heavily adapted from https://observablehq.com/@d3/tree

export const TreeSVG = (data : TreeGraphWithDetails) : SVGSVGElement => {

	// radius of nodes
	const r = 3;
	// horizontal padding for first and last column
	const padding = 1;
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

	const root = d3.hierarchy(data);
  
	// Compute labels and titles.
	const descendants = root.descendants();
	const L = descendants.map(d => d.data.name);
  
	const width = 640;

	// Compute the layout.
	const dx = 10;
	const dy = width / (root.height + padding);
	const positionedRoot = d3.tree().nodeSize([dx, dy])(root) as d3.HierarchyPointNode<TreeGraphWithDetails>;
  
	// Center the tree.
	let x0 = Infinity;
	let x1 = -x0;
	positionedRoot.each(d => {
		if (d.x > x1) x1 = d.x;
		if (d.x < x0) x0 = d.x;
	});
  
	// Compute the default height.
	const height = x1 - x0 + dx * 2;
	
	const svg = d3.create("svg")
		.attr("viewBox", [-dy * padding / 2, x0 - dx, width, height])
		.attr("width", width)
		.attr("height", height)
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
		.text(d => d.data.description);
  
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