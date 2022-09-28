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