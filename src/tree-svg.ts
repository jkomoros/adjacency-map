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