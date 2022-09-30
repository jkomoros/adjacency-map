import * as d3 from 'd3';

import {
	NodeID,
	LayoutInfo,
	TreeGraph
} from './types.js';

//Heavily adapted from https://observablehq.com/@d3/tree

export const TreeLayout = (data : TreeGraph) : LayoutInfo => {

	// horizontal padding for first and last column
	const padding = 1;

	const root = d3.hierarchy(data);
  
	const width = 640;

	// Compute the layout.
	const dx = 10;
	const dy = width / (root.height + padding);

	//Note that d3.tree() lays out from top to bottom so we rotate 90.

	const positionedRoot = d3.tree().nodeSize([dx, dy])(root) as d3.HierarchyPointNode<TreeGraph>;
  
	const positions : {[id : NodeID] : {x: number, y: number}} = {};

	// Center the tree.
	let x0 = Infinity;
	let x1 = -x0;
	positionedRoot.each(d => {
		if (d.x > x1) x1 = d.x;
		if (d.x < x0) x0 = d.x;
		positions[d.data.name] = {
			//Transpose x and y so it lays out horizontally
			x : d.y,
			y: d.x, 
		};
	});
  
	// Compute the default height.
	const height = x1 - x0 + dx * 2;

	const viewBox = [-dy * padding / 2, x0 - dx, width, height] as [number, number, number, number];

	return {
		width,
		height,
		viewBox,
		positions
	};
};