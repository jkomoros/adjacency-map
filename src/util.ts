import {
	RandomGenerator
} from './types.js';

export const camelCaseFilename = (name : string) : string => {
	return name.split('-').map((piece, index) => index == 0 ? piece : piece[0].toUpperCase() + piece.slice(1)).join('');
};

const randomCharSetNumbers = '0123456789';
const randomCharSetLetters = 'abcdef';
const randomCharSet = randomCharSetNumbers + randomCharSetLetters;

export const randomString = (length : number, rnd : RandomGenerator = Math.random, charSet : string = randomCharSet) : string => {
	let text = '';
	for (let i = 0; i < length; i++) {
		text += charSet.charAt(Math.floor(rnd() * charSet.length));
	}
	return text;
};

export function shuffleInPlace<T>(array : T[], rnd : RandomGenerator = Math.random) : T[] {
	let currentIndex = array.length;
	let randomIndex;

	while (currentIndex != 0) {
		randomIndex = Math.floor(rnd() * currentIndex);
		currentIndex--;
  
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}
  
	return array;
}

export const deepFreeze = (obj : object) : void => {
	if (!obj) return;
	if (typeof obj != 'object') return;
	Object.freeze(obj);
	for (const val of Object.values(obj)) {
		deepFreeze(val);
	}
};

//Takes n arrays, and then returns a set like what was given, but where each
//array is as long as the longest array, and if a given array was too short it
//wraps its values around to fill the extra spaces.
export const wrapArrays = <T>(...arrays : T[][]) : T[][] => {
	let longestArray = 0;
	for (const array of arrays) {
		if (array.length > longestArray) longestArray = array.length;
	}
	return arrays.map(array => {
		const result : T[] = [];
		for (let i = 0; i < longestArray; i++) {
			result.push(array[i % array.length]);
		}
		return result;
	});
};

//Only works for POJOs
export function deepCopy<T extends object>(obj : T) : T {
	return JSON.parse(JSON.stringify(obj));
}

//From https://blog.trannhat.xyz/generate-a-hash-from-string-in-javascript/
export const hash = (s : string) : number => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a;},0);

export const stringHash = (s : string) : string => Math.abs(hash(s)).toString(16);