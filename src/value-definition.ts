import {
	COMBINERS
} from './combine.js';

import {
	PropertyDefinition,
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
	ValueDefinitionRootValue,
	ValueDefinitionCollect,
	ValueDefinitionLeaf,
	ValueDefinitionCalculationArgs,
	ValueDefinitionColor,
	ValueDefinitionLengthOf,
	ValueDefinitionInput,
	ValueDefinitionFilter,
	PropertyName
} from './types.js';

import {
	DEFAULT_TRUE_NUMBER,
	FALSE_NUMBER,
	isTrue,
	NULL_SENTINEL
} from './constants.js';

import {
	color,
	packColor
} from './color.js';

import {
	assertUnreachable
} from './util.js';

export const RESERVED_VALUE_DEFINITION_PROPERTIES : {[name : string] : true} = {
	'ref': true,
	'type': true,
	'implies': true,
	//on ExpandedEdgeValue
	'source': true,
	'implied': true
};

//Constants that are allowed to be relied on even if the constants dict doesn't
//define them because the engine will add them. Always a subset of
//RESERVED_VALUE_DEFINITION_PROPERTIES.
export const ALLOWED_CONSTANTS : {[name : string] : true} = {
	'implied' : true
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

export const valueDefinitionIsLeaf = (definition : ValueDefinition) : definition is ValueDefinitionLeaf => {
	if (typeof definition == 'number') return true;
	if (typeof definition == 'boolean') return true;
	if (definition === null) return true;
	return false;
};

//Some of the ValueDefinitions are canonically strings. This checks if the given
//definition is one of them.
export const valueDefinitionIsStringType = (definition : string | ValueDefinition) : definition is ValueDefinition => {
	const castedDefinition = definition as ValueDefinition;
	if ((valueDefinitionIsInput(castedDefinition))) return true;
	return false;
};

const valueDefinitionIsEdgeConstant = (definition : ValueDefinition) : definition is ValueDefintionEdgeConstant => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'constant' in definition;
};

const valueDefinitionIsRefValue = (definition : ValueDefinition) : definition is ValueDefinitionRefValue => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'ref' in definition;
};

const valueDefinitionIsRootValue = (definition : ValueDefinition) : definition is ValueDefinitionRootValue => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'root' in definition;
};

const valueDefinitionIsResultValue = (definition : ValueDefinition) : definition is ValueDefinitionResultValue => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'result' in definition;
};

const valueDefinitionIsCombine = (definition : ValueDefinition) : definition is ValueDefinitionCombine => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'combine' in definition;
};

const valueDefinitionIsColor = (definition : ValueDefinition) : definition is ValueDefinitionColor => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'color' in definition;
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

const valueDefinitionIsFilter = (definition : ValueDefinition): definition is ValueDefinitionFilter => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'filter' in definition;
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

const valueDefinitionIsCollect = (definition : ValueDefinition): definition is ValueDefinitionCollect => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'collect' in definition;
};

const valueDefinitionIsLengthOf = (definition : ValueDefinition): definition is ValueDefinitionLengthOf => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'lengthOf' in definition;
};

const valueDefinitionIsInput = (definition : ValueDefinition): definition is ValueDefinitionInput => {
	if( typeof definition == 'string' && definition == 'input') return true;
	return false;
};

const listNestedDefinitions = (definition : ValueDefinition) : ValueDefinition[] => {
	if (valueDefinitionIsLeaf(definition)) return [definition];
	if (typeof definition == 'object' && Array.isArray(definition)) {
		return [definition];
	}
	if (valueDefinitionIsEdgeConstant(definition)) {
		return [definition];
	}
	if (valueDefinitionIsRefValue(definition)) {
		return [definition];
	}
	if (valueDefinitionIsRootValue(definition)) {
		return [definition];
	}
	if (valueDefinitionIsResultValue(definition)) {
		return [definition];
	}

	if (valueDefinitionIsCombine(definition)) {
		return [definition, ...listNestedDefinitions(definition.value)];
	}

	if (valueDefinitionIsColor(definition)) {
		return [definition];
	}

	if (valueDefinitionIsArithmetic(definition)) {
		const result = [definition, ...listNestedDefinitions(definition.a)];
		if (!arithmeticIsUnary(definition)) result.push(...listNestedDefinitions(definition.b));
		return result;
	}

	if (valueDefinitionIsCompare(definition)) {
		return [definition, ...listNestedDefinitions(definition.a), ...listNestedDefinitions(definition.b)];
	}

	if (valueDefinitionIsIf(definition)) {
		return [
			definition,
			...listNestedDefinitions(definition.if),
			...listNestedDefinitions(definition.then),
			...listNestedDefinitions(definition.else)

		];
	}

	if (valueDefinitionIsFilter(definition)) {
		return [
			definition,
			...listNestedDefinitions(definition.filter),
			...listNestedDefinitions(definition.value)
		];
	}

	if (valueDefinitionIsClip(definition)) {
		const result = [definition, ...listNestedDefinitions(definition.clip)];
		if (definition.low != undefined) result.push(...listNestedDefinitions(definition.low));
		if (definition.high != undefined) result.push(...listNestedDefinitions(definition.high));
		return result;
	}

	if (valueDefinitionIsRange(definition)) {
		return [
			definition,
			...listNestedDefinitions(definition.range),
			...listNestedDefinitions(definition.low),
			...listNestedDefinitions(definition.high)
		];
	}

	if (valueDefinitionIsPercent(definition)) {
		return [
			definition,
			...listNestedDefinitions(definition.percent),
			...listNestedDefinitions(definition.low),
			...listNestedDefinitions(definition.high)
		];
	}

	if (valueDefinitionIsCollect(definition)) {
		const result : ValueDefinition[] = [definition];
		for (const child of definition.collect) {
			result.push(...listNestedDefinitions(child));
		}
		return result;
	}

	if (valueDefinitionIsLengthOf(definition)) {
		return [
			definition, 
			...listNestedDefinitions(definition.value)
		];
	}

	if (valueDefinitionIsInput(definition)) {
		return [definition];
	}

	return assertUnreachable(definition);
};

export const extractRequiredDependencies = (definition : ValueDefinition) : PropertyName[] => {
	const result : PropertyName[] = [];
	for (const def of listNestedDefinitions(definition)) {
		if (valueDefinitionIsResultValue(def)) {
			result.push(def.result);
		}
	}
	return result;
};

//Note: a lot of this validation is also checking things that typescript will
//have already checked. Before, we loaded files from json and had to a
//conversion leap of faith, but now everything is natively typescript even in
//data/ so that leap of faith is less important.
export const validateValueDefinition = (definition : ValueDefinition, exampleValue : NodeValues, edgeDefinition? : PropertyDefinition) : void => {
	if (valueDefinitionIsLeaf(definition)) return;
	if (typeof definition == 'object' && Array.isArray(definition)) {
		if (definition.some(leaf => !valueDefinitionIsLeaf(leaf))) throw new Error('If an array is provided it msut contain only numbers, booleans, or null');
		if (definition.length == 0) throw new Error('If an array of numbers is provided there must be at least one');
		return;
	}
	if (valueDefinitionIsEdgeConstant(definition)) {
		if (RESERVED_VALUE_DEFINITION_PROPERTIES[definition.constant]) {
			if (!ALLOWED_CONSTANTS[definition.constant]) throw new Error(definition.constant + ' is a reserved edge property name');
			//Constants here are allowed to be relied on no matter what.
			return;
		}
		const constants = edgeDefinition?.constants || {};
		if (constants[definition.constant] == undefined) throw new Error(definition.constant + ' for edge type value definition but that constant doesn\'t exist for that type.');
		return;
	}
	if (valueDefinitionIsRefValue(definition)) {
		if (exampleValue[definition.ref] == undefined) throw new Error(definition.ref + ' is not a defined edge type');
		return;
	}
	if (valueDefinitionIsRootValue(definition)) {
		if (exampleValue[definition.root] == undefined) throw new Error(definition.root + ' is not a defined edge type');
		return;
	}
	if (valueDefinitionIsResultValue(definition)) {
		if (edgeDefinition) {
			const declaredDependencies = edgeDefinition.dependencies || [];
			if (!declaredDependencies.some(dependency => dependency == definition.result)) throw new Error(definition.result + ' is used in a ResultValue definition but it is not declared in dependencies.');
		}
		return;
	}

	if (valueDefinitionIsCombine(definition)) {
		validateValueDefinition(definition.value, exampleValue, edgeDefinition);
		if (!COMBINERS[definition.combine]) throw new Error('Unknown combiner: ' + definition.combine);
		return;
	}

	if (valueDefinitionIsColor(definition)) {
		if (!definition.color) throw new Error('No color provided');
		try {
			color(definition.color);
		} catch(er) {
			throw new Error('Invalid color definition: ' + er);
		}
		return;
	}

	if (valueDefinitionIsArithmetic(definition)) {
		validateValueDefinition(definition.a, exampleValue, edgeDefinition);
		if (!Object.keys(OPERATORS).some(operator => operator == definition.operator)) throw new Error('Unknown operator: ' + definition.operator);
		if (!arithmeticIsUnary(definition)) validateValueDefinition(definition.b, exampleValue, edgeDefinition);
		return;
	}

	if (valueDefinitionIsCompare(definition)) {
		validateValueDefinition(definition.a, exampleValue, edgeDefinition);
		validateValueDefinition(definition.b, exampleValue, edgeDefinition);
		if (!Object.keys(COMPARE_OPERATORS).some(operator => operator == definition.compare)) throw new Error('Unknown compare operator: ' + definition.compare);
		return;
	}

	if (valueDefinitionIsIf(definition)) {
		validateValueDefinition(definition.if, exampleValue, edgeDefinition);
		validateValueDefinition(definition.then, exampleValue, edgeDefinition);
		validateValueDefinition(definition.else, exampleValue, edgeDefinition);
		return;
	}

	if (valueDefinitionIsFilter(definition)) {
		validateValueDefinition(definition.filter, exampleValue, edgeDefinition);
		validateValueDefinition(definition.value, exampleValue, edgeDefinition);
		return;
	}

	if (valueDefinitionIsClip(definition)) {
		validateValueDefinition(definition.clip, exampleValue, edgeDefinition);
		if (definition.low == undefined && definition.high == undefined) throw new Error('Clip expects at least one of low or high');
		if (definition.low != undefined) validateValueDefinition(definition.low, exampleValue, edgeDefinition);
		if (definition.high != undefined) validateValueDefinition(definition.high, exampleValue, edgeDefinition);
		return;
	}

	if (valueDefinitionIsRange(definition)) {
		validateValueDefinition(definition.range, exampleValue, edgeDefinition);
		validateValueDefinition(definition.low, exampleValue, edgeDefinition);
		validateValueDefinition(definition.high, exampleValue, edgeDefinition);
		return;
	}

	if (valueDefinitionIsPercent(definition)) {
		validateValueDefinition(definition.percent, exampleValue, edgeDefinition);
		validateValueDefinition(definition.low, exampleValue, edgeDefinition);
		validateValueDefinition(definition.high, exampleValue, edgeDefinition);
		return;
	}

	if (valueDefinitionIsCollect(definition)) {
		if (!definition.collect || definition.collect.length == 0) throw new Error('collect requires at least one child');
		for (const child of definition.collect) {
			validateValueDefinition(child, exampleValue, edgeDefinition);
		}
		return;
	}

	if (valueDefinitionIsLengthOf(definition)) {
		if (definition.lengthOf != 'refs' && definition.lengthOf != 'edges' && definition.lengthOf != 'input') throw new Error('lengthOf property must be either refs or edges or input');
		validateValueDefinition(definition.value, exampleValue, edgeDefinition);
		return;
	}

	if (valueDefinitionIsInput(definition)) {
		//There is no configuration on input
		return;
	}

	return assertUnreachable(definition);
};

export const calculateValueLeaf = (definition : ValueDefinitionLeaf) : number =>  {
	if (typeof definition == 'boolean') return definition ? DEFAULT_TRUE_NUMBER : FALSE_NUMBER;

	if (typeof definition == 'number') return definition;

	if (definition === null) return NULL_SENTINEL;

	return assertUnreachable(definition);
};


//TODO: is there a way to make it clear this must return an array with at least
//one number?
export const calculateValue = (definition : ValueDefinition, args : ValueDefinitionCalculationArgs) : number[] => {

	if (valueDefinitionIsLeaf(definition)) return [calculateValueLeaf(definition)];

	if (Array.isArray(definition)) return definition.map(leaf => calculateValueLeaf(leaf));

	if (valueDefinitionIsEdgeConstant(definition)) {
		return args.edges.map(edge => edge[definition.constant] as number);
	}
	if (valueDefinitionIsRefValue(definition)) {
		return args.refs.map(values => values[definition.ref]);
	}
	if (valueDefinitionIsRootValue(definition)) {
		return [args.rootValue[definition.root]];
	}
	if (valueDefinitionIsResultValue(definition)) {
		return args.edges.map(() => args.partialResult[definition.result]);
	}
	if (valueDefinitionIsCombine(definition)) {
		const subValues = calculateValue(definition.value, args);
		const combiner = COMBINERS[definition.combine];
		return combiner(subValues);
	}

	if (valueDefinitionIsColor(definition)) {
		return [packColor(color(definition.color))];
	}

	if (valueDefinitionIsArithmetic(definition)) {
		const left = calculateValue(definition.a, args);
		const right = arithmeticIsUnary(definition) ? [0] : calculateValue(definition.b, args);
		const op = OPERATORS[definition.operator];
		if (!op) throw new Error('No such operator: ' + definition.operator);
		//The result is the same length as left, but we loop over and repeat numbers in right if necessary.
		return left.map((term, i) => op(term, right[i % right.length]));
	}

	if (valueDefinitionIsCompare(definition)) {
		const left = calculateValue(definition.a, args);
		const right = calculateValue(definition.b, args);
		const op = COMPARE_OPERATORS[definition.compare];
		if (!op) throw new Error('No such comparison operator: ' + definition.compare);
		//The result is the same length as left, but we loop over and repeat numbers in right if necessary.
		return left.map((term, i) => op(term, right[i % right.length]));
	}

	if (valueDefinitionIsIf(definition)) {
		const ifVal = calculateValue(definition.if, args);
		const thenVal = calculateValue(definition.then, args);
		const elseVal = calculateValue(definition.else, args);
		return ifVal.map((term, i) => isTrue(term) ? thenVal[i % thenVal.length] : elseVal[i & elseVal.length]);
	}

	if (valueDefinitionIsFilter(definition)) {
		const filterVal = calculateValue(definition.filter, args);
		const valueVal = calculateValue(definition.value, args);
		const result = valueVal.filter((_, index) =>  isTrue(filterVal[index % filterVal.length]));
		if (result.length == 0) return [NULL_SENTINEL];
		return result;
	}

	if (valueDefinitionIsClip(definition)) {
		const inputArr = calculateValue(definition.clip, args);
		const lowArr = definition.low != undefined ? calculateValue(definition.low, args) : [Number.NEGATIVE_INFINITY];
		const highArr = definition.high != undefined ? calculateValue(definition.high, args) : [Number.POSITIVE_INFINITY];

		return inputArr.map((term, i) => {
			const low = lowArr[i % lowArr.length];
			const high = highArr[i % highArr.length];
			if (term < low) term = low;
			if (term > high) term = high;
			return term;
		});
	}

	if (valueDefinitionIsRange(definition)) {
		const inputArr = calculateValue(definition.range, args);
		const lowArr = calculateValue(definition.low, args);
		const highArr = calculateValue(definition.high, args);

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
		const inputArr = calculateValue(definition.percent, args);
		const lowArr = calculateValue(definition.low, args);
		const highArr = calculateValue(definition.high, args);

		return inputArr.map((term, i) => {
			let low = lowArr[i % lowArr.length];
			let high = highArr[i % highArr.length];
			if (high < low) [low, high] = [high, low];
			if (term < 0.0) term = 0.0;
			if (term > 1.0) term = 1.0;
			return term * (high - low) + low;
		});
	}

	if (valueDefinitionIsCollect(definition)) {
		return definition.collect.map(child => calculateValue(child, args)).flat();
	}

	if (valueDefinitionIsLengthOf(definition)) {
		const values = calculateValue(definition.value, args);
		const result = [];
		let length = 0;
		switch(definition.lengthOf) {
		case 'refs':
			length = args.refs.length;
			break;
		case 'edges':
			length = args.edges.length;
			break;
		case 'input':
			length = args.input ? args.input.length : 1;
			break;
		default:
			assertUnreachable(definition.lengthOf);
		}
		for (let i = 0; i < length; i++) {
			result.push(values[i % values.length]);
		}
		return result;
	}

	if (valueDefinitionIsInput(definition)) {
		return args.input || [NULL_SENTINEL];
	}

	return assertUnreachable(definition);
};