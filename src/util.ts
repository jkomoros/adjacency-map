import {
	JSONData,
	RandomGenerator
} from './types.js';

//TODO: do more validation
export const unpackConfigJSON = (input : unknown) : JSONData => input as JSONData;

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

//Only works for POJOs
export function deepCopy<T extends object>(obj : T) : T {
	return JSON.parse(JSON.stringify(obj));
}

//From https://blog.trannhat.xyz/generate-a-hash-from-string-in-javascript/
export const hash = (s : string) : number => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a;},0);

export const stringHash = (s : string) : string => Math.abs(hash(s)).toString(16);