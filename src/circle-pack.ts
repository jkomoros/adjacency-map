import * as d3 from 'd3';

import {
	CircleLayoutInfo,
	LayoutID
} from './types.js';

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