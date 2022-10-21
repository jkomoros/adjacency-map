import {
	EdgeCombinerDisplay,
	EdgeDisplay,
	Library,
	LibraryType,
	NodeDisplay,
	ValueDefinition
} from './types.js';

export const CORE_LIBRARY_NAME = 'core';

export const BASE_NODE_DISPLAY : NodeDisplay = {
	radius: 6,
	opacity: 1.0,
	color: {
		color: '#333'
	},
	strokeWidth: 0.0,
	strokeOpacity: 1.0,
	strokeColor: {
		color: '#000'
	}
};

//Since none of these return an array of numbers, edges of the same type from
//the same ref/source pair will be combined together. If you want them to not
//combine, override one of these to return {lengthOf:'edges', value: FOO}
export const BASE_EDGE_DISPLAY : EdgeDisplay = {
	width: 1.5,
	color: {
		color: '#555'
	},
	opacity: 0.4,
	distinct: false
};

export const BASE_EDGE_COMBINER_DISPLAY : EdgeCombinerDisplay = {
	width: {
		combine: 'sum',
		value: 'input'
	},
	color: {
		color: '#555'
	},
	opacity: 0.4
};

const baseProductPropertyDefinition = {
	value: {
		operator: '+',
		a: {
			parent: '.'
		},
		b: {
			constant: 'cost'
		}
	},
	extendTags: true,
	display: {
		color: 'red',
		width: {
			constant: 'cost'
		},
		distinct: true
	},
	implies: '*',
	constants: {
		cost: 0.0
	}
} as const;

export const LIBRARIES : {[type in LibraryType] : Library} = {
	core: {
		//Core currently doesn't define anything
		properties: {},
		root: {}
	},
	'product': {
		properties: {
			engineering: {
				...baseProductPropertyDefinition,
				description: 'The amount of engineering effort to build to this use case',
				display: {
					...baseProductPropertyDefinition.display,
					color: 'red'
				}
			},
			ux: {
				...baseProductPropertyDefinition,
				description: 'The amount of ux effort to build to this use case',
				display: {
					...baseProductPropertyDefinition.display,
					color: 'blue'
				}
			},
			data: {
				...baseProductPropertyDefinition,
				description: 'The amount of effort to build up data quality to build to this use case',
				display: {
					...baseProductPropertyDefinition.display,
					color: 'green'
				}
			},
			activation: {
				...baseProductPropertyDefinition,
				description: 'The amount of effort required to modify usage behaviors and expectations to activate this use case. For use cases users want to do, it\'s low. For use cases users don\'t want to do, this would require marketing.',
				display: {
					...baseProductPropertyDefinition.display,
					color: 'gold'
				}
			},
			parentValue: {
				description: 'The component of value that comes from the parent',
				value: {
					parent: 'value'
				},
				hide: true,
				display: {
					width: 0
				}
			},
			selfValue: {
				description: 'The component of the value that comes from net adds on self.',
				usage: 'Value should either be set explicilty on node.values.selfValue, or it will be the sum of features added in this cycle.',
				calculateWhen: 'always',
				hide: true,
				value: {
					combine: 'sum',
					value: {
						tagConstant: 'value',
						which: 'self'
					}
				},
			},
			value: {
				description: 'The overall user value created at this node.',
				calculateWhen: "always",
				value: {
					operator: '+',
					a : {
						result: 'selfValue'
					},
					b: {
						result: 'parentValue'
					}
				}
			},
			incrementalCertainty: {
				description: 'A value between 0 and 1 denoting how much more uncertain this node is than its parent',
				usage: 'Designed to be a constant or set explicitly on a node',
				hide: true,
				calculateWhen: 'always',
				value: 0.9
			},
			certainty: {
				description: 'A value between 0 and 1 denoting how certain the value is at this node',
				combine: 'product',
				value: {
					operator: '*',
					a: {
						parent: 'certainty'
					},
					b: {
						result: 'incrementalCertainty'
					}
				}
			},
			expectedValue: {
				description: 'The value times certainty for this node.',
				calculateWhen: 'always',
				value: {
					operator: '*',
					a: {
						result: 'value'
					},
					b: {
						result: 'certainty'
					}
				}
			},
			implemented: {
				description: 'What percentage of this node is implemented',
				calculateWhen: 'always',
				//Override node.values.implemented to set
				value: 0.0
			}
		},
		root: {
			certainty: 1.0,
			implemented: 1.0
		},
		display: {
			node: {
				radius: {
					operator: '+',
					a: 6,
					b: {result: 'value'}
				},
				opacity: {
					result: 'certainty'
				},
				color: {
					gradient: {
						result: 'implemented'
					},
					a: {color: 'black'},
					b: {color: 'blue'}
				}
			},
			edgeCombiner: {
				color: {
					combine: 'color-mean',
					value: 'input'
				}
			}
		},
	},
	//Returns a value for the smallest number of hops away from root it is
	generation: {
		properties: {
			generation: {
				description: 'The smallest number of edges to get back to root',
				combine: 'min',
				hide: true,
				display: {
					width: 0
				},
				value: {
					operator: '+',
					a: {
						parent: '.'
					},
					b: 1
				}
			}
		},
		root: {
			generation: 0
		}
	},
	//Including this library will make it so edges of various types will not be
	//combined into one type, but rather show a different edge for each type.
	'distinct-across-type': {
		display: {
			edgeCombiner: {
				width: {
					lengthOf: 'input',
					value: BASE_EDGE_COMBINER_DISPLAY.width
				},
				color: {
					lengthOf: 'input',
					value: BASE_EDGE_COMBINER_DISPLAY.color as ValueDefinition
				},
				opacity: {
					lengthOf: 'input',
					value: BASE_EDGE_COMBINER_DISPLAY.opacity
				}
			}
		},
		properties: {},
		root: {}
	},
	//Including this library will make it so edges of the same type will not be
	//combined into one edge but kept separate.
	'distinct-within-type': {
		display: {
			edge: {
				width: {
					lengthOf: 'input',
					value: BASE_EDGE_DISPLAY.width
				},
				color: {
					lengthOf: 'input',
					value: BASE_EDGE_DISPLAY.color as ValueDefinition
				},
				opacity: {
					lengthOf: 'input',
					value: BASE_EDGE_DISPLAY.opacity
				},
				distinct: {
					lengthOf: 'input',
					value: BASE_EDGE_DISPLAY.distinct
				}
			}
		},
		properties: {},
		root: {}
	}
};