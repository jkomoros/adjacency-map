import {
	COMBINERS
} from './combine.js';

import {
	EdgeDefinition,
	EdgeValue,
	NodeValues,
	ValueDefinition,
	ValueDefinitionArithmetic,
	ValueDefinitionCombine,
	ValueDefinitionRefValue,
	ValueDefinitionResultValue,
	ValueDefintionEdgeConstant
} from './types.js';

export const RESERVED_VALUE_DEFINITION_PROPERTIES : {[name : string] : true} = {
	'ref': true,
	'type': true
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

export const validateValueDefinition = (definition : ValueDefinition, edgeDefinition : EdgeDefinition, exampleValue : NodeValues) : void => {
	if (typeof definition == 'number') return;
	if (typeof definition == 'object' && Array.isArray(definition)) {
		if (definition.some(item => typeof item != 'number')) throw new Error('An array was provided but some items were not numbers');
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
		validateValueDefinition(definition.term, edgeDefinition, exampleValue);
		if (!['+', '*'].some(operator => operator == definition.operator)) throw new Error('Unknown operator: ' + definition.operator);
		return;
	}

	const _exhaustiveCheck : never = definition;
	throw new Error('Illegal value for definition');
	return _exhaustiveCheck;
};

//TODO: is there a way to make it clear this must return an array with at least
//one number?
export const calculateValue = (definition : ValueDefinition, edges : EdgeValue[], refs : NodeValues[], partialResult : NodeValues) : number[] => {
	if (typeof definition == 'number') return [definition];

	if (Array.isArray(definition)) return definition;

	if (valueDefintionIsEdgeConstant(definition)) {
		return edges.map(edge => edge[definition.constant] as number);
	}
	if (valueDefintionIsRefValue(definition)) {
		return refs.map(values => values[definition.ref]);
	}
	if (valueDefintionIsResultValue(definition)) {
		return edges.map(() => partialResult[definition.result]);
	}
	if (valueDefintionIsCombine(definition)) {
		const subValues = calculateValue(definition.child, edges, refs, partialResult);
		const combiner = COMBINERS[definition.combine];
		return combiner(subValues);
	}
	if (valueDefinitionIsArithmetic(definition)) {
		const left = calculateValue(definition.child, edges, refs, partialResult);
		const right = calculateValue(definition.term, edges, refs, partialResult);
		const op = definition.operator == '*' ? (one : number, two : number) => one * two : (one : number, two : number) => one + two;
		//The result is the same length as left, but we loop over and repeat numbers in right if necessary.
		return left.map((term, i) => op(term, right[i % right.length]));
	}

	const _exhaustiveCheck : never = definition;
	throw new Error('Illegal value for definition');
	return _exhaustiveCheck;
};