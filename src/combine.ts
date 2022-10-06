import {
	CombinerType,
	Combiner
} from './types.js';

import {
	DEFAULT_TRUE_NUMBER,
	FALSE_NUMBER,
	isTrue
} from './constants.js';

import {
	color,
	combine,
	packColor,
	unpackColor
} from './color.js';

export const mean = (nums : number[]) : [number] => {
	if (!nums.length) return [0];
	let sum = 0;
	for (const num of nums) {
		sum += num;
	}
	return [sum / nums.length];
};

export const first = (nums : number[]): [number] => {
	if (!nums.length) return [0];
	return [nums[0]];
};

export const last = (nums : number[]): [number] => {
	if (!nums.length) return [0];
	return [nums[nums.length - 1]];
};

export const min = (nums : number[]): [number] => {
	if (!nums.length) return [0];
	return [Math.min(...nums)];
};

export const max = (nums : number[]): [number] => {
	if (!nums.length) return [0];
	return [Math.max(...nums)];
};

export const sum = (nums : number[]): [number] => {
	if (!nums.length) return [0];
	let result = 0;
	for (const num of nums) result += num;
	return [result];
};

export const product = (nums : number[]): [number] => {
	if (!nums.length) return [0];
	let result = 1;
	for (const num of nums) result *= num;
	return [result];
};

export const and = (nums : number[]): [number] => {
	if (!nums.length) return [0];
	return nums.every(num => isTrue(num)) ? [DEFAULT_TRUE_NUMBER] : [FALSE_NUMBER];
};

export const or = (nums : number[]): [number] => {
	if (!nums.length) return [0];
	return nums.some(num => isTrue(num)) ? [DEFAULT_TRUE_NUMBER] : [FALSE_NUMBER];
};

export const colorMean = (nums: number[]): [number] => {
	if (!nums.length) return [packColor(color('black'))];
	const result = combine(...nums.map(num => unpackColor(num)));
	return [packColor(result)];
};

export const DEFAULT_COMBINER = mean;

export const COMBINERS : {[combinerType in CombinerType] : Combiner} = {
	'mean': mean,
	'first': first,
	'last': last,
	'min': min,
	'max': max,
	'sum': sum,
	'product': product,
	'and': and,
	'or': or,
	'color-mean': colorMean, 
};
