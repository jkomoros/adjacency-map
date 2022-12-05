import * as d3 from 'd3';

import {
	NodeID,
	LayoutInfo,
	TreeGraph,
	CircleLayoutInfo,
	LayoutID
} from './types.js';

//Heavily adapted from https://observablehq.com/@d3/tree

export const TreeLayout = (data : TreeGraph, width : number, height : number) : LayoutInfo => {

	// horizontal padding for first and last column
	//const padding = 1;

	const root = d3.hierarchy(data);
  
	//Remember, width and height are transposed

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

//children is child ID to radius
export const CirclePackLayout = (children : {[id : LayoutID] : number}) : CircleLayoutInfo => {

	const items : {id : LayoutID, r : number, x: number, y : number}[] = [];
	for (const [id, r] of Object.entries(children)) {
		items.push({
			id,
			r,
			x: 0,
			y: 0
		});
	}

	d3.packSiblings(items);

	const circle = d3.packEnclose(items);

	return {
		radius: circle.r,
		children: Object.fromEntries(items.map(item => [item.id, {x : item.x, y: item.y}]))
	};
};