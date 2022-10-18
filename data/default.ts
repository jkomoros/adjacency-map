import {
	RawMapDefinition
} from '../src/types.js';

const basePropertyDefinition = {
	value: {
		operator: '+',
		a: {
			ref: '.'
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

const data : RawMapDefinition = {
	description: 'A simple example that shows use cases for a Stable Diffusion project',
	tags: {
		gui: {
			displayName: 'GUI',
			color: 'blue',
			description: 'The user may use a Graphical User Interface instead of a command line interface',
			constants: {
				value: 10
			}
		},
		extended: {
			displayName: 'Extended',
			color: 'green',
			description: 'The underlying model is trained on significantly more images, leading to higher quality results',
			constants: {
				value: 8
			}
		},
		im2Im: {
			displayName: 'Image2Image',
			color: 'red',
			description: 'The underlying model can also take an image as input, making it possible to generate variations on a basic image composition',
			constants: {
				value: 3
			}
		},
	},
	properties: {
		engineering: {
			...basePropertyDefinition,
			description: 'The amount of engineering effort to build to this use case',
			display: {
				...basePropertyDefinition.display,
				color: 'red'
			}
		},
		ux: {
			...basePropertyDefinition,
			description: 'The amount of ux effort to build to this use case',
			display: {
				...basePropertyDefinition.display,
				color: 'blue'
			}
		},
		data: {
			...basePropertyDefinition,
			description: 'The amount of effort to build up data quality to build to this use case',
			display: {
				...basePropertyDefinition.display,
				color: 'green'
			}
		},
		activation: {
			...basePropertyDefinition,
			description: 'The amount of effort required to modify usage behaviors and expectations to activate this use case. For use cases users want to do, it\'s low. For use cases users don\'t want to do, this would require marketing.',
			display: {
				...basePropertyDefinition.display,
				color: 'gold'
			}
		},
		parentValue: {
			description: 'The component of value that comes from the parent',
			value: {
				ref: 'value'
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
					ref: 'certainty'
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
		}
	},
	root: {
		certainty: 1.0
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
			}
		},
		edgeCombiner: {
			color: {
				combine: 'color-mean',
				value: 'input'
			}
		}
	},
	nodes: {
		base_pipeline: {
			description: 'Set up the data pipeline to, given a corpus of images, train a model',
			edges: [
				{
					type: 'engineering',
					cost: 5.0,
				}
			],
			values: {
				selfValue: 1
			}
		},
		base_train: {
			description: 'Train the model on a basic corpus of images',
			edges: [
				{
					type: 'engineering',
					ref: 'base_pipeline',
					cost: 1.0
				},
				{
					type: 'data',
					ref: 'base_pipeline',
					cost: 6.0
				}
			],
			values: {
				selfValue: 2
			}
		},
		base_infer_colab: {
			description: 'Take a trained model and a text prompt and return a generated image in colab',
			edges: [
				{
					type: 'engineering',
					ref: 'base_train',
					cost: 1.0
				},
				{
					type: 'ux',
					ref: 'base_train',
					cost: 1.0
				}
			],
			values: {
				selfValue: 5
			}
		},
		base_infer_gui : {
			description: 'Take the basic results and allow someone to install an electron app to generate an image',
			tags: ['gui'],
			edges: [
				{
					type: 'engineering',
					ref: 'base_infer_colab',
					cost: 5.0
				},
				{
					type: 'ux',
					ref: 'base_infer_colab',
					cost: 10.0,
				}
			]
		},
		extended_infer_gui: {
			description: 'Extend gui to also use the model with more images',
			edges: {
				base_infer_gui: [
					{
						type: 'engineering',
						cost: 2.0
					},
					{
						type: 'ux',
						cost: 3.0
					}
				],
				extended_infer: [
					{
						type: 'engineering',
						cost: 2.0
					}
				]
			}
		},
		extended_infer : {
			description: 'Train on a larger corpus of images',
			tags: ['extended'],
			edges: [
				{
					type: 'engineering',
					ref: 'base_infer_colab',
					cost: 1.0
				},
				{
					type: 'data',
					ref: 'base_infer_colab',
					cost: 5.0
				}
			]
		},
		im_to_im_infer : {
			description: 'Extend the model to also do image to image transfer',
			tags: ['im2Im'],
			edges: [
				{
					type: 'engineering',
					ref: 'base_infer_colab',
					cost: 10.0
				},
				{
					type: 'data',
					ref: 'base_infer_colab',
					cost: 5.0
				}
			]
		},
		im_to_im_infer_gui : {
			description: 'Allow image to image transfer in the gui',
			edges: {
				base_infer_gui: [
					{
						type: 'engineering',
						cost: 1.0
					},
					{
						type: 'ux',
						cost: 5.0
					}
				],
				im_to_im_infer: [
					{
						type: 'engineering',
						cost: 2.0
					}
				]
			}
		},
		extended_im_to_im_infer_gui: {
			description: "GUI allows both image to image transfer on the extened model",
			edges: {
				im_to_im_infer_gui: [
					{
						type: 'engineering',
						cost: 1.0
					},
					{
						type: 'ux',
						cost: 3.0
					}
				],
				extended_infer_gui: [
					{
						type: 'engineering',
						cost: 1.0
					}
				]
			}
		}
	},
	scenarios: {
		'increased-certainty': {
			description: 'Override to increase the certainty of certain values, which increases downstream certainty too',
			nodes: {
				im_to_im_infer: {
					//Take the value it was in the base and add 0.08 to it.
					certainty: {
						operator: '+',
						a: 'input',
						b: 0.08
					}
				},
				extended_infer_gui: {
					//Just override the value of the node's value to 0.8
					certainty: 0.8
				}
			}
		},
		'increased-value': {
			description: 'Extends the increased-capacity scenario and also increases the value at a node',
			extends: 'increased-certainty',
			nodes: {
				extended_im_to_im_infer_gui: {
					//Multiply the previous baseline value by 1.5
					value: {
						operator: '*',
						a: 'input',
						b: 1.5
					}
				}
			}
		}
	}
};

export default data;