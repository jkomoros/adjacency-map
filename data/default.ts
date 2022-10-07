import {
	RawMapDefinition
} from '../src/types.js';

const data : RawMapDefinition = {
	properties: {
		engineering: {
			description: 'The amount of engineering effort to build to this use case',
			value: {
				operator: '+',
				a: {
					ref: 'engineering'
				},
				b: {
					constant: 'weight'
				}
			},
			display: {
				color: 'red',
				width: {
					constant: 'weight'
				}
			},
			implies: '*',
			constants: {
				weight: 0.0
			}
		},
		ux: {
			description: 'The amount of ux effort to build to this use case',
			value: {
				operator: '+',
				a: {
					ref: 'ux'
				},
				b: {
					constant: 'weight'
				}
			},
			display: {
				color: 'blue',
				width: {
					constant: 'weight'
				}
			},
			implies: '*',
			constants: {
				weight: 0.0
			}
		},
		data: {
			description: 'The amount of effort to build up data quality to build to this use case',
			value: {
				operator: '+',
				a: {
					ref: 'data'
				},
				b: {
					constant: 'weight'
				}
			},
			display: {
				color: 'green',
				width: {
					constant: 'weight'
				}
			},
			implies: '*',
			constants: {
				weight: 0.0
			}
		},
		usage: {
			description: 'The amount of effort required to modify usage behaviors and expectations activate this use case',
			value: {
				operator: '+',
				a: {
					ref: 'usage'
				},
				b: {
					constant: 'weight'
				}
			},
			display: {
				color: 'yellow',
				width: {
					constant: 'weight'
				}
			},
			implies: '*',
			constants: {
				weight: 0.0
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
		}
	}
};

export default data;