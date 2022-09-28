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

export const DEFAULT_REDUCER = mean;

export const REDUCERS = {
	'mean': mean,
	'first': first,
	'last': last,
	'min': min,
	'max': max,
	'sum': sum,
	'product': product
} as const;
