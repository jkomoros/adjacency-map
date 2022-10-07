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
				color: 'red'
			},
			implies: '*',
			constants: {
				weight: 1.0
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
				color: 'blue'
			},
			implies: '*',
			constants: {
				weight: 1.0
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
				color: 'green'
			},
			implies: '*',
			constants: {
				weight: 1.0
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
				color: 'yellow'
			},
			implies: '*',
			constants: {
				weight: 1.0
			}
		},

	},
	nodes: {
		orient: {
			description: 'A basic orientation calibration experience',
			edges: [
				{
					type: 'engineering',
					weight: 6.0
				},
				{
					type: 'ux',
					weight: 4.0
				},
				{
					type: 'data',
					weight: 4.0
				}
			]
		},
		compass: {
			description: 'Once oriented, display compass rose',
			edges: [
				{
					type: 'engineering',
					ref: 'orient',
					weight: 1.0
				},
				{
					type: 'ux',
					weight: 1.0
				}
			]
		},
		'landmarks': {
			description: 'Overlay distant land marks to help orient',
			edges: [
				{
					type: 'engineering',
					ref: 'compass',
					weight: 2.0
				},
				{
					type: 'ux',
					ref: 'compass',
					weight: 2.0
				},
				{
					type: 'data',
					ref: 'compass',
					weight: 1.0
				}
			]
		}
	}
};

export default data;