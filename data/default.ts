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
			constant: 'weight'
		}
	},
	extendTags: true,
	display: {
		color: 'red',
		width: {
			constant: 'weight'
		},
		distinct: true
	},
	implies: '*',
	constants: {
		weight: 0.0
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
		usage: {
			...basePropertyDefinition,
			description: 'The amount of effort required to modify usage behaviors and expectations activate this use case',
			display: {
				...basePropertyDefinition.display,
				color: 'gold'
			}
		},
		value: {
			description: 'The overall user value created at this node.',
			calculateWhen: "always",
			//Value should be either set explicitly via node.values or the union of values of the features on this edge.
			value: {
				combine: 'sum',
				value: {
					tagConstant: 'value'
				}
			}
		}

	},
	display: {
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
					weight: 5.0,
				}
			],
			values: {
				value: 1
			}
		},
		base_train: {
			description: 'Train the model on a basic corpus of images',
			edges: [
				{
					type: 'engineering',
					ref: 'base_pipeline',
					weight: 1.0
				},
				{
					type: 'data',
					ref: 'base_pipeline',
					weight: 6.0
				}
			],
			values: {
				value: 2
			}
		},
		base_infer_colab: {
			description: 'Take a trained model and a text prompt and return a generated image in colab',
			edges: [
				{
					type: 'engineering',
					ref: 'base_train',
					weight: 1.0
				},
				{
					type: 'ux',
					ref: 'base_train',
					weight: 1.0
				}
			],
			values: {
				value: 5
			}
		},
		base_infer_gui : {
			description: 'Take the basic results and allow someone to install an electron app to generate an image',
			tags: ['gui'],
			edges: [
				{
					type: 'engineering',
					ref: 'base_infer_colab',
					weight: 5.0
				},
				{
					type: 'ux',
					ref: 'base_infer_colab',
					weight: 10.0,
				}
			],
			values: {
				value: 10
			}
		},
		extended_infer_gui: {
			description: 'Extend gui to also use the model with more images',
			edges: {
				base_infer_gui: [
					{
						type: 'engineering',
						weight: 2.0
					},
					{
						type: 'ux',
						weight: 3.0
					}
				],
				extended_infer: [
					{
						type: 'engineering',
						weight: 2.0
					}
				]
			},
			values: {
				value: 15
			}
		},
		extended_infer : {
			description: 'Train on a larger corpus of images',
			tags: ['extended'],
			edges: [
				{
					type: 'engineering',
					ref: 'base_infer_colab',
					weight: 1.0
				},
				{
					type: 'data',
					ref: 'base_infer_colab',
					weight: 5.0
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
					weight: 10.0
				},
				{
					type: 'data',
					ref: 'base_infer_colab',
					weight: 5.0
				}
			]
		},
		im_to_im_infer_gui : {
			description: 'Allow image to image transfer in the gui',
			edges: {
				base_infer_gui: [
					{
						type: 'engineering',
						weight: 1.0
					},
					{
						type: 'ux',
						weight: 5.0
					}
				],
				im_to_im_infer: [
					{
						type: 'engineering',
						weight: 2.0
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
						weight: 1.0
					},
					{
						type: 'ux',
						weight: 3.0
					}
				],
				extended_infer_gui: [
					{
						type: 'engineering',
						weight: 1.0
					}
				]
			}
		}
	}
};

export default data;