import {
	NodeID
} from './types.js';

export const ROOT_ID : NodeID = '';

/*

	ValueDefinitions exclusively work with numbers, so to represent true/false
	we need a convention.

*/

//Note: any non-false number value is true, so use isTrue to check if a given
//number is true.
export const DEFAULT_TRUE_NUMBER = 1.0;
export const FALSE_NUMBER = 0.0;

export const isTrue = (input : number) => !isFalse(input);
export const isFalse = (input : number) => input == FALSE_NUMBER;

export const NULL_SENTINEL = Number.MAX_SAFE_INTEGER * -1 + 7;

export const SVG_WIDTH = 640;
export const SVG_HEIGHT = 480;