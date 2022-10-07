import {
	RawMapDefinition
} from '../src/types.js';

const data : RawMapDefinition = {
	properties: {
		engineering: {
			value: 3,
			constants: {
				weight: 1.0
			}
		},
		ux: {
			value: 4,
			description: "A description of ux"
		}
	},
	root: {
		engineering : 4.0
	},
	nodes: {
		a: {
			description: "Node a",
			edges: [
				{
					type: "engineering",
					weight: 4.0
				},
				{
					type: "engineering"
				}
			]
		},
		b: {
			description: "Node b",
			edges: [
				{
					type: "ux",
					ref: "a"
				}
			]
		},
		c: {
			description: "Node c",
			edges: [
				{
					type: "engineering",
					ref: "a"
				},
				{
					type: "ux",
					ref: "b"
				}
			]
		},
		d: {
			description: "Node d",
			edges: [
				{
					type: "engineering",
					ref: "b"
				}
			]
		}
	}
};

export default data;