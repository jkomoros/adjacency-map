import { ENABLE_EDITING_SCENARIOS } from './constants.js';
import {
	RandomGenerator,
	ScenariosOverlays,
	ScenarioNode,
	RenderEdgeValue,
	ExpandedEdgeValue,
	ConstantType,
	EdgeValue,
	EdgeValueMatchID
} from './types.js';

import {
	RESERVED_EDGE_CONSTANT_NAMES
} from './value-definition.js';

export const emptyScenarioNode = () : ScenarioNode => {
	return {
		values: {},
		edges: {
			add: [],
			remove: {},
			modify: {}
		}
	};
};

export const renderEdgeStableID = (edge : RenderEdgeValue) : string => {
	const result : string[] = [
		edge.parent,
		edge.source,
		...edge.edges.map(subEdge => subEdge.type)
	];
	return result.join('_');
};

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

export const idToDisplayName = (id = '') : string => {
	return id.split('_').join('-').split('-').map(w => (w[0] || '').toUpperCase() + w.substr(1).toLowerCase()).join(' ');
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

const SCENARIOS_OVERLAYS_LOCAL_STORAGE_KEY = 'scenarios';

export const fetchOverlaysFromStorage = () : ScenariosOverlays => {
	const rawObject = window.localStorage.getItem(SCENARIOS_OVERLAYS_LOCAL_STORAGE_KEY);
	if (!rawObject) return {};
	return JSON.parse(rawObject) as ScenariosOverlays;
};

export const storeOverlaysToStorage = (overlays : ScenariosOverlays) => {
	if (!ENABLE_EDITING_SCENARIOS) return;
	window.localStorage.setItem(SCENARIOS_OVERLAYS_LOCAL_STORAGE_KEY, JSON.stringify(overlays, null, '\t'));
};

export const edgeEquivalent = (one : EdgeValue | ExpandedEdgeValue, two : EdgeValue | ExpandedEdgeValue) : boolean => {
	if (one == two) return true;
	if (Object.keys(one).length != Object.keys(two).length) return false;
	for (const key of Object.keys(one)) {
		if (one[key] != two[key]) return false;
	}
	return true;
};

export const constantsForEdge = (edge : ExpandedEdgeValue | EdgeValue) : {[name : ConstantType]: number} => {
	const result : {[name : ConstantType]: number} = {};
	for (const [property, value] of Object.entries(edge)) {
		if (RESERVED_EDGE_CONSTANT_NAMES[property]) continue;
		if (typeof value != 'number') throw new Error('Illegal constant value');
		result[property] = value;
	}
	return result;
};

export const getEdgeValueMatchID = (value : EdgeValue) : EdgeValueMatchID => {
	return value.type + '+' + (value.parent || '');
};

export const assertUnreachable = (x : never) : never => {
	throw new Error('Exhaustiveness check failed: ' + String(x));
};

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

export const deepEqual = (one : unknown, two: unknown) : boolean => {
	if (one == two) return true;
	if (typeof one != typeof two) return false;
	//If it wasn' an object then the direct equality check abovewas sufficient
	if (!one || !two || typeof one != 'object' || typeof two != 'object') return false;
	if (Array.isArray(one)) {
		if (!Array.isArray(two)) return false;
		if (one.length != two.length) return false;
		for (let i = 0; i < one.length; i++) {
			if (!deepEqual(one[i], two[i])) return false;
		}
		return true;
	}
	if (Object.keys(one).length != Object.keys(two).length) return false;
	for (const [key, value] of Object.entries(one)) {
		if ((two as {[name : string] : unknown})[key] != value) return false;
	}
	return true;
};

//From https://blog.trannhat.xyz/generate-a-hash-from-string-in-javascript/
export const hash = (s : string) : number => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a;},0);

export const stringHash = (s : string) : string => Math.abs(hash(s)).toString(16);