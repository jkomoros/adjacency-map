import {
	COMBINERS
} from './combine.js';

import {
	PropertyDefinition,
	EdgeValue,
	NodeValues,
	ValueDefinition,
	ValueDefinitionArithmetic,
	ValueDefinitionCombine,
	ValueDefinitionRefValue,
	ValueDefinitionResultValue,
	ValueDefintionEdgeConstant,
	ValueDefinitionClip,
	ArithmeticOperator,
	ValueDefinitionRange,
	ValueDefinitionPercent,
	CompareOperator,
	ValueDefinitionCompare,
	ValueDefinitionIf,
	ValueDefinitionArithmeticUnary,
	ValueDefinitionRootValue
} from './types.js';

import {
	DEFAULT_TRUE_NUMBER,
	FALSE_NUMBER,
	isTrue
} from './constants.js';

export const RESERVED_VALUE_DEFINITION_PROPERTIES : {[name : string] : true} = {
	'ref': true,
	'type': true
};

type Operator = (one : number, two: number) => number;

const OPERATORS : {[op in ArithmeticOperator] : Operator}  = {
	'*': (one, two) => one * two,
	'+': (one, two) => one + two,
	'-': (one, two) => one - two,
	'/': (one, two) => one / two,
	'&&': (one, two) => isTrue(one) && isTrue(two) ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER,
	'||': (one, two) => isTrue(one) || isTrue(two) ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER,
	'!': (one) => isTrue(one) ? FALSE_NUMBER : DEFAULT_TRUE_NUMBER
};

const UNARY_OPERATORS : {[op in ArithmeticOperator]+?: true} = {
	'!': true
};

type Comparer = (one : number, two : number) => typeof DEFAULT_TRUE_NUMBER | typeof FALSE_NUMBER;

const COMPARE_OPERATORS : {[op in CompareOperator]: Comparer} = {
	'==': (one, two) => one == two ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER,
	'!=': (one, two) => one != two ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER,
	'<': (one, two) => one < two ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER,
	'>': (one, two) => one > two ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER,
	'<=': (one, two) => one <= two ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER,
	'>=': (one, two) => one >= two ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER,
};

const valueDefintionIsEdgeConstant = (definition : ValueDefinition) : definition is ValueDefintionEdgeConstant => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'constant' in definition;
};

const valueDefintionIsRefValue = (definition : ValueDefinition) : definition is ValueDefinitionRefValue => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'ref' in definition;
};

const valueDefintionIsRootValue = (definition : ValueDefinition) : definition is ValueDefinitionRootValue => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'root' in definition;
};

const valueDefintionIsResultValue = (definition : ValueDefinition) : definition is ValueDefinitionResultValue => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'result' in definition;
};

const valueDefintionIsCombine = (definition : ValueDefinition) : definition is ValueDefinitionCombine => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'combine' in definition;
};

const valueDefinitionIsArithmetic = (definition : ValueDefinition): definition is ValueDefinitionArithmetic => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'operator' in definition;
};

const arithmeticIsUnary = (definition : ValueDefinitionArithmetic): definition is ValueDefinitionArithmeticUnary => {
	return UNARY_OPERATORS[definition.operator] || false;
};

const valueDefinitionIsCompare = (definition : ValueDefinition): definition is ValueDefinitionCompare => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'compare' in definition;
};

const valueDefinitionIsIf = (definition : ValueDefinition): definition is ValueDefinitionIf => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'if' in definition;
};

const valueDefinitionIsClip = (definition : ValueDefinition): definition is ValueDefinitionClip => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'clip' in definition;
};

const valueDefinitionIsRange = (definition : ValueDefinition): definition is ValueDefinitionRange => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'range' in definition;
};

const valueDefinitionIsPercent = (definition : ValueDefinition): definition is ValueDefinitionPercent => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'percent' in definition;
};

export const validateValueDefinition = (definition : ValueDefinition, edgeDefinition : PropertyDefinition, exampleValue : NodeValues) : void => {
	if (typeof definition == 'boolean') return;
	if (typeof definition == 'number') return;
	if (typeof definition == 'object' && Array.isArray(definition)) {
		if (definition.some(item => typeof item != 'number' && typeof item != 'boolean')) throw new Error('An array was provided but some items were not numbers or booleans');
		if (definition.length == 0) throw new Error('If an array of numbers is provided there must be at least one');
		return;
	}
	if (valueDefintionIsEdgeConstant(definition)) {
		if (RESERVED_VALUE_DEFINITION_PROPERTIES[definition.constant]) throw new Error(definition.constant + ' is a reserved edge property name');
		const constants = edgeDefinition.constants || {};
		if (!constants[definition.constant]) throw new Error(definition.constant + ' for edge type value definition but that constant doesn\'t exist for that type.');
		return;
	}
	if (valueDefintionIsRefValue(definition)) {
		if (exampleValue[definition.ref] == undefined) throw new Error(definition.ref + ' is not a defined edge type');
		return;
	}
	if (valueDefintionIsRootValue(definition)) {
		if (exampleValue[definition.root] == undefined) throw new Error(definition.root + ' is not a defined edge type');
		return;
	}
	if (valueDefintionIsResultValue(definition)) {
		const declaredDependencies = edgeDefinition.dependencies || [];
		if (!declaredDependencies.some(dependency => dependency == definition.result)) throw new Error(definition.result + ' is used in a ResultValue definition but it is not declared in dependencies.');
		return;
	}

	if (valueDefintionIsCombine(definition)) {
		validateValueDefinition(definition.child, edgeDefinition, exampleValue);
		if (!COMBINERS[definition.combine]) throw new Error('Unknown combiner: ' + definition.combine);
		return;
	}

	if (valueDefinitionIsArithmetic(definition)) {
		validateValueDefinition(definition.child, edgeDefinition, exampleValue);
		if (!Object.keys(OPERATORS).some(operator => operator == definition.operator)) throw new Error('Unknown operator: ' + definition.operator);
		if (!arithmeticIsUnary(definition)) validateValueDefinition(definition.term, edgeDefinition, exampleValue);
		return;
	}

	if (valueDefinitionIsCompare(definition)) {
		validateValueDefinition(definition.child, edgeDefinition, exampleValue);
		validateValueDefinition(definition.term, edgeDefinition, exampleValue);
		if (!Object.keys(COMPARE_OPERATORS).some(operator => operator == definition.compare)) throw new Error('Unknown compare operator: ' + definition.compare);
		return;
	}

	if (valueDefinitionIsIf(definition)) {
		validateValueDefinition(definition.if, edgeDefinition, exampleValue);
		validateValueDefinition(definition.then, edgeDefinition, exampleValue);
		validateValueDefinition(definition.else, edgeDefinition, exampleValue);
		return;
	}

	if (valueDefinitionIsClip(definition)) {
		validateValueDefinition(definition.clip, edgeDefinition, exampleValue);
		if (definition.low == undefined && definition.high == undefined) throw new Error('Clip expects at least one of low or high');
		if (definition.low != undefined) validateValueDefinition(definition.low, edgeDefinition, exampleValue);
		if (definition.high != undefined) validateValueDefinition(definition.high, edgeDefinition, exampleValue);
		return;
	}

	if (valueDefinitionIsRange(definition)) {
		validateValueDefinition(definition.range, edgeDefinition, exampleValue);
		validateValueDefinition(definition.low, edgeDefinition, exampleValue);
		validateValueDefinition(definition.high, edgeDefinition, exampleValue);
		return;
	}

	if (valueDefinitionIsPercent(definition)) {
		validateValueDefinition(definition.percent, edgeDefinition, exampleValue);
		validateValueDefinition(definition.low, edgeDefinition, exampleValue);
		validateValueDefinition(definition.high, edgeDefinition, exampleValue);
		return;
	}

	const _exhaustiveCheck : never = definition;
	throw new Error('Illegal value for definition');
	return _exhaustiveCheck;
};

//TODO: is there a way to make it clear this must return an array with at least
//one number?
export const calculateValue = (definition : ValueDefinition, edges : EdgeValue[], refs : NodeValues[], partialResult : NodeValues, rootValue : NodeValues) : number[] => {
	if (typeof definition == 'boolean') return [definition ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER];
	
	if (typeof definition == 'number') return [definition];

	if (Array.isArray(definition)) return definition.map(input => typeof input == 'boolean' ? (input ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER): input);

	if (valueDefintionIsEdgeConstant(definition)) {
		return edges.map(edge => edge[definition.constant] as number);
	}
	if (valueDefintionIsRefValue(definition)) {
		return refs.map(values => values[definition.ref]);
	}
	if (valueDefintionIsRootValue(definition)) {
		return [rootValue[definition.root]];
	}
	if (valueDefintionIsResultValue(definition)) {
		return edges.map(() => partialResult[definition.result]);
	}
	if (valueDefintionIsCombine(definition)) {
		const subValues = calculateValue(definition.child, edges, refs, partialResult, rootValue);
		const combiner = COMBINERS[definition.combine];
		return combiner(subValues);
	}
	if (valueDefinitionIsArithmetic(definition)) {
		const left = calculateValue(definition.child, edges, refs, partialResult, rootValue);
		const right = arithmeticIsUnary(definition) ? [0] : calculateValue(definition.term, edges, refs, partialResult, rootValue);
		const op = OPERATORS[definition.operator];
		if (!op) throw new Error('No such operator: ' + definition.operator);
		//The result is the same length as left, but we loop over and repeat numbers in right if necessary.
		return left.map((term, i) => op(term, right[i % right.length]));
	}

	if (valueDefinitionIsCompare(definition)) {
		const left = calculateValue(definition.child, edges, refs, partialResult, rootValue);
		const right = calculateValue(definition.term, edges, refs, partialResult, rootValue);
		const op = COMPARE_OPERATORS[definition.compare];
		if (!op) throw new Error('No such comparison operator: ' + definition.compare);
		//The result is the same length as left, but we loop over and repeat numbers in right if necessary.
		return left.map((term, i) => op(term, right[i % right.length]));
	}

	if (valueDefinitionIsIf(definition)) {
		const ifVal = calculateValue(definition.if, edges, refs, partialResult, rootValue);
		const thenVal = calculateValue(definition.then, edges, refs, partialResult, rootValue);
		const elseVal = calculateValue(definition.else, edges, refs, partialResult, rootValue);
		return ifVal.map((term, i) => isTrue(term) ? thenVal[i % thenVal.length] : elseVal[i & elseVal.length]);
	}

	if (valueDefinitionIsClip(definition)) {
		const inputArr = calculateValue(definition.clip, edges, refs, partialResult, rootValue);
		const lowArr = definition.low != undefined ? calculateValue(definition.low, edges, refs, partialResult, rootValue) : [Number.NEGATIVE_INFINITY];
		const highArr = definition.high != undefined ? calculateValue(definition.high, edges, refs, partialResult, rootValue) : [Number.POSITIVE_INFINITY];

		return inputArr.map((term, i) => {
			const low = lowArr[i % lowArr.length];
			const high = highArr[i % highArr.length];
			if (term < low) term = low;
			if (term > high) term = high;
			return term;
		});
	}

	if (valueDefinitionIsRange(definition)) {
		const inputArr = calculateValue(definition.range, edges, refs, partialResult, rootValue);
		const lowArr = calculateValue(definition.low, edges, refs, partialResult, rootValue);
		const highArr = calculateValue(definition.high, edges, refs, partialResult, rootValue);

		return inputArr.map((term, i) => {
			let low = lowArr[i % lowArr.length];
			let high = highArr[i % highArr.length];
			if (high < low) [low, high] = [high, low];
			if (term < low) term = low;
			if (term > high) term = high;
			return (term - low) / (high - low);
		});
	}

	if (valueDefinitionIsPercent(definition)) {
		const inputArr = calculateValue(definition.percent, edges, refs, partialResult, rootValue);
		const lowArr = calculateValue(definition.low, edges, refs, partialResult, rootValue);
		const highArr = calculateValue(definition.high, edges, refs, partialResult, rootValue);

		return inputArr.map((term, i) => {
			let low = lowArr[i % lowArr.length];
			let high = highArr[i % highArr.length];
			if (high < low) [low, high] = [high, low];
			if (term < 0.0) term = 0.0;
			if (term > 1.0) term = 1.0;
			return term * (high - low) + low;
		});
	}

	const _exhaustiveCheck : never = definition;
	throw new Error('Illegal value for definition');
	return _exhaustiveCheck;
};