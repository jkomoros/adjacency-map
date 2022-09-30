import * as d3 from 'd3';

import {
	NodeID,
	LayoutInfo,
	TreeGraph
} from './types.js';

//Heavily adapted from https://observablehq.com/@d3/tree

export const TreeLayout = (data : TreeGraph) : LayoutInfo => {

	// horizontal padding for first and last column
	//const padding = 1;

	const root = d3.hierarchy(data);
  
	//Remember, these are transposed
	const width = 640;
	const height = 480;

	//Note that d3.tree() lays out from top to bottom so we rotate 90.

	const positionedRoot = d3.tree().size([width, height])(root) as d3.HierarchyPointNode<TreeGraph>;
  
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
  
	const viewBox = [0, 0, height, width] as [number, number, number, number];

	return {
		width,
		height,
		viewBox,
		positions
	};
};