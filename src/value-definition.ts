import {
	COMBINERS
} from './combine.js';

import {
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
	ValueDefinitionHasTag,
	PropertyName,
	ValueDefinitionTagConstant,
	AllowedValueDefinitionVariableTypes,
	ValudeDefinitionValidationArgs
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
	assertUnreachable, deepCopy
} from './util.js';

import {
	makeTagMap
} from './adjacency-map.js';

import {
	TypedObject
} from './typed-object.js';

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

export const SELF_PROPERTY_NAME = '.';

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

const valueDefinitionIsHasTag = (definition : ValueDefinition): definition is ValueDefinitionHasTag => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'has' in definition;
};

const valueDefinitionIsTagConstant = (definition : ValueDefinition): definition is ValueDefinitionTagConstant => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'tagConstant' in definition;
};

const VALUE_DEFINITION_VARIABLE_TESTER : {[kind in keyof AllowedValueDefinitionVariableTypes]: (v : ValueDefinition) => boolean} ={
	edgeConstant: valueDefinitionIsEdgeConstant,
	refValue: valueDefinitionIsRefValue,
	rootValue: valueDefinitionIsRootValue,
	resultValue: valueDefinitionIsResultValue,
	input: valueDefinitionIsInput,
	hasTag: valueDefinitionIsHasTag,
	tagConstant: valueDefinitionIsTagConstant
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

	if (valueDefinitionIsHasTag(definition)) {
		return [definition];
	}
	
	if (valueDefinitionIsTagConstant(definition)) {
		const argDefault = definition.default || null;
		return [
			definition,
			...listNestedDefinitions(argDefault)
		];
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
export const validateValueDefinition = (definition : ValueDefinition, args: ValudeDefinitionValidationArgs) : void => {
	if (valueDefinitionIsLeaf(definition)) return;
	if (typeof definition == 'object' && Array.isArray(definition)) {
		if (definition.some(leaf => !valueDefinitionIsLeaf(leaf))) throw new Error('If an array is provided it msut contain only numbers, booleans, or null');
		if (definition.length == 0) throw new Error('If an array of numbers is provided there must be at least one');
		return;
	}
	for (const [variableType, allowed] of TypedObject.entries(args.allowedVariables)) {
		if (allowed) continue;
		const tester = VALUE_DEFINITION_VARIABLE_TESTER[variableType];
		if (tester(definition)) throw new Error('Definition includes a type with variable accessors that is not allowed in this context: ' + variableType);
	}

	if (valueDefinitionIsEdgeConstant(definition)) {
		if (RESERVED_VALUE_DEFINITION_PROPERTIES[definition.constant]) {
			if (!ALLOWED_CONSTANTS[definition.constant]) throw new Error(definition.constant + ' is a reserved edge property name');
			//Constants here are allowed to be relied on no matter what.
			return;
		}
		const constants = args.propertyDefinition?.constants || {};
		if (constants[definition.constant] == undefined) throw new Error(definition.constant + ' for edge type value definition but that constant doesn\'t exist for that type.');
		return;
	}
	if (valueDefinitionIsRefValue(definition)) {
		if (args.exampleValues[definition.ref] == undefined) throw new Error(definition.ref + ' is not a defined edge type');
		return;
	}
	if (valueDefinitionIsRootValue(definition)) {
		if (args.exampleValues[definition.root] == undefined) throw new Error(definition.root + ' is not a defined edge type');
		return;
	}
	if (valueDefinitionIsResultValue(definition)) {
		if (args.propertyDefinition) {
			const declaredDependencies = args.propertyDefinition.dependencies || [];
			if (!declaredDependencies.some(dependency => dependency == definition.result)) throw new Error(definition.result + ' is used in a ResultValue definition but it is not declared in dependencies.');
			//TODO: we also should check that exampleValues has an entry
		}
		return;
	}

	if (valueDefinitionIsCombine(definition)) {
		validateValueDefinition(definition.value, args);
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
		validateValueDefinition(definition.a, args);
		if (!Object.keys(OPERATORS).some(operator => operator == definition.operator)) throw new Error('Unknown operator: ' + definition.operator);
		if (!arithmeticIsUnary(definition)) validateValueDefinition(definition.b, args);
		return;
	}

	if (valueDefinitionIsCompare(definition)) {
		validateValueDefinition(definition.a, args);
		validateValueDefinition(definition.b, args);
		if (!Object.keys(COMPARE_OPERATORS).some(operator => operator == definition.compare)) throw new Error('Unknown compare operator: ' + definition.compare);
		return;
	}

	if (valueDefinitionIsIf(definition)) {
		validateValueDefinition(definition.if, args);
		validateValueDefinition(definition.then, args);
		validateValueDefinition(definition.else, args);
		return;
	}

	if (valueDefinitionIsFilter(definition)) {
		validateValueDefinition(definition.filter, args);
		validateValueDefinition(definition.value, args);
		return;
	}

	if (valueDefinitionIsClip(definition)) {
		validateValueDefinition(definition.clip, args);
		if (definition.low == undefined && definition.high == undefined) throw new Error('Clip expects at least one of low or high');
		if (definition.low != undefined) validateValueDefinition(definition.low, args);
		if (definition.high != undefined) validateValueDefinition(definition.high, args);
		return;
	}

	if (valueDefinitionIsRange(definition)) {
		validateValueDefinition(definition.range, args);
		validateValueDefinition(definition.low, args);
		validateValueDefinition(definition.high, args);
		return;
	}

	if (valueDefinitionIsPercent(definition)) {
		validateValueDefinition(definition.percent, args);
		validateValueDefinition(definition.low, args);
		validateValueDefinition(definition.high, args);
		return;
	}

	if (valueDefinitionIsCollect(definition)) {
		if (!definition.collect || definition.collect.length == 0) throw new Error('collect requires at least one child');
		for (const child of definition.collect) {
			validateValueDefinition(child, args);
		}
		return;
	}

	if (valueDefinitionIsLengthOf(definition)) {
		if (definition.lengthOf != 'refs' && definition.lengthOf != 'edges' && definition.lengthOf != 'input') throw new Error('lengthOf property must be either refs or edges or input');
		validateValueDefinition(definition.value, args);
		return;
	}

	if (valueDefinitionIsInput(definition)) {
		//There is no configuration on input
		return;
	}

	if (valueDefinitionIsHasTag(definition)) {
		const tags = makeTagMap(definition.has);
		if (Object.keys(tags).some(tag => !args.data.tags[tag])) throw new Error('Unknown tag in definition.has');
		return;
	}

	if (valueDefinitionIsTagConstant(definition)) {
		const tagNames = Object.keys(args.data.tags);
		if (tagNames.length == 0) throw new Error('No tags defined');
		//All tags must have the same constant sets
		const firstTagValues = args.data.tags[tagNames[0]];
		if (firstTagValues.constants[definition.tagConstant] === undefined) throw new Error('Invalid tagConstant: ' + definition.tagConstant);
		if (definition.default !== undefined) validateValueDefinition(definition.default, args);
		return;
	}

	return assertUnreachable(definition);
};

const cloneDefinition = (definition : ValueDefinition) : ValueDefinition => {
	if (definition && typeof definition == 'object') return deepCopy(definition);
	return definition;
};

//Returns a valude defintiion like definition (sometimes precisely the same) but
//with any propertyName references wihtin to SELF_NAME replaced with self.
export const cloneWithSelf = (definition: ValueDefinition, self : PropertyName) : ValueDefinition => {
	const definitions = listNestedDefinitions(definition);
	const includedPropertyNames = Object.fromEntries(definitions.map(def => {
		if (valueDefinitionIsRefValue(def)) return def.ref;
		if (valueDefinitionIsRootValue(def)) return def.root;
		return '';
	}).map(name => [name, true]));
	if (!includedPropertyNames[SELF_PROPERTY_NAME]) return definition;
	//We need to clone it because at least one uses the self property name.
	const clone = cloneDefinition(definition);
	const clonedDefs = listNestedDefinitions(clone);
	for (const clonedDef of clonedDefs) {
		if (valueDefinitionIsRefValue(clonedDef) && clonedDef.ref == SELF_PROPERTY_NAME) {
			clonedDef.ref = self;
		}
		if (valueDefinitionIsRootValue(clonedDef) && clonedDef.root == SELF_PROPERTY_NAME) {
			clonedDef.root = self;
		}
		//We dont' support self for resultValue because that would be a dependency
	}
	return clone;
};

//Returns true if the value definition relies on edge values
export const valueDefinitionReliesOnEdges = (definition : ValueDefinition) : boolean => {
	const defs = listNestedDefinitions(definition);
	return defs.some(def => valueDefinitionIsRefValue(def) || valueDefinitionIsEdgeConstant(def));
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
		return [args.partialResult[definition.result]];
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

	if (valueDefinitionIsHasTag(definition)) {
		const tags = Object.keys(makeTagMap(definition.has));
		if (definition.all) {
			return tags.every(tag => args.tags[tag]) ? [DEFAULT_TRUE_NUMBER] : [FALSE_NUMBER];
		}
		return tags.some(tag => args.tags[tag]) ? [DEFAULT_TRUE_NUMBER] : [FALSE_NUMBER];
	}

	if (valueDefinitionIsTagConstant(definition)) {
		const result = Object.keys(args.tags).map(tagName => {
			const tagDefinition = args.definition.tags[tagName];
			const constant = tagDefinition.constants[definition.tagConstant];
			if (constant === undefined) return NULL_SENTINEL;
			return constant;
		});
		if (result.length == 0) {
			if (definition.default === undefined) return [0];
			return calculateValue(definition.default, args);
		}
		return result;
	}

	return assertUnreachable(definition);
};