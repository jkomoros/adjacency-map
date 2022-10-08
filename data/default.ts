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
			]
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
			]
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
			]
		},
		base_infer_gui : {
			description: 'Take the basic results and allow someone to install an electron app to generate an image',
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
			]
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
			}
		},
		extended_infer : {
			description: 'Train on a larger corpus of images',
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