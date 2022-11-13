import {
	RawMapDefinition
} from '../src/types.js';

const data : RawMapDefinition = {
	description: 'A simple example that shows use cases for a Stable Diffusion project',
	//Product is the library that defines all of the main edges we use.
	import: 'product',
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
					parent: 'base_pipeline',
					cost: 1.0
				},
				{
					type: 'data',
					parent: 'base_pipeline',
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
					parent: 'base_train',
					cost: 1.0
				},
				{
					type: 'ux',
					parent: 'base_train',
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
					parent: 'base_infer_colab',
					cost: 5.0
				},
				{
					type: 'ux',
					parent: 'base_infer_colab',
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
					parent: 'base_infer_colab',
					cost: 1.0
				},
				{
					type: 'data',
					parent: 'base_infer_colab',
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
					parent: 'base_infer_colab',
					cost: 10.0
				},
				{
					type: 'data',
					parent: 'base_infer_colab',
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
					values: {
						//Take the value it was in the base and add 0.08 to it.
						certainty: {
							operator: '+',
							a: 'input',
							b: 0.08
						}
					},
					edges: {
						//Add an extra edge in this scenario
						add: [
							{
								type: 'engineering',
								parent: 'base_train',
								cost: 5
							}
						]
					}
				},
				extended_infer_gui: {
					values: {
						//Just override the value of the node's value to 0.8
						certainty: 0.8
					}
				}
			}
		},
		'increased-value': {
			description: 'Extends the increased-capacity scenario and also increases the value at a node',
			extends: 'increased-certainty',
			nodes: {
				extended_im_to_im_infer_gui: {
					values: {
						//Multiply the previous baseline value by 1.5
						value: {
							operator: '*',
							a: 'input',
							b: 1.5
						}
					}
				}
			}
		},
		//This is a progression of sceanarios that build on each other.
		'implemented': [
			{
				extends: 'increased-value',
				nodes: {
					base_pipeline: {
						values: {
							implemented: 1.0
						}
					}
				}
			},
			{
				nodes: {
					base_train: {
						values: {
							implemented: 1.0
						}
					}
				}
			},
			{
				nodes: {
					base_infer_colab: {
						values: {
							implemented: 1.0
						}
					}
				}
			}
		]
	}
};

export default data;