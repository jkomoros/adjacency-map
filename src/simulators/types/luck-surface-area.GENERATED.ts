export type LuckSurfaceAreaSimOptions = {
	//Configuration related to agents
	agents?: {
		//The number of agents
		count?: number;
		//How much value cost an agent takes per time step
		cost?: {
			//The average value for value. Only for types linear, fixed, and normal
			average?: number;
			//The amount that value will be +/- of, or for normal the standard deviation. Only for types linear and normal
			spread?: number;
			//The min bound for the sample for value. Only for distribution min-max
			min?: number;
			//The max bound for the sample for value. Only for distribution min-max
			max?: number;
			//The type of distribution for value
			distribution?: 'linear' | 'normal' | 'min-max' | 'fixed';
		};
		//The starter strength of agents that start at the beginning
		starterStrength?: {
			//The average value for value. Only for types linear, fixed, and normal
			average?: number;
			//The amount that value will be +/- of, or for normal the standard deviation. Only for types linear and normal
			spread?: number;
			//The min bound for the sample for value. Only for distribution min-max
			min?: number;
			//The max bound for the sample for value. Only for distribution min-max
			max?: number;
			//The type of distribution for value
			distribution?: 'linear' | 'normal' | 'min-max' | 'fixed';
		};
		//The starter value of agents that start at the beginning
		starterValue?: {
			//The average value for value. Only for types linear, fixed, and normal
			average?: number;
			//The amount that value will be +/- of, or for normal the standard deviation. Only for types linear and normal
			spread?: number;
			//The min bound for the sample for value. Only for distribution min-max
			min?: number;
			//The max bound for the sample for value. Only for distribution min-max
			max?: number;
			//The type of distribution for value
			distribution?: 'linear' | 'normal' | 'min-max' | 'fixed';
		};
	};
	//The number of rounds
	rounds?: number;
	//The opportunities to show up in the graph
	opportunities?: {
		//Properties related to how value shows up in the graph
		value?: {
			//In each time tick, the likelihood that a random node is 
			likelihood?: number;
			//On each frame tick, what multiplier we should use to get the new node value
			falloff?: number;
		};
		//The static structure of the opportunity graph
		structure?: {
			//The type of graph to use
			graphType?: 'BloomGraph' | 'PreferentialAttachmentGraph';
			//how many layers from default node to go to
			levels?: number;
			//how many children each child should have
			childCount?: number;
			//at each level, the final childCount is childCount * Math.pow(childFactor, level)
			childFactor?: number;
			//How likely the children of each parent node are to have connections amongst themselves. 1.0 is all connected, 0.0 is no connections.
			childLinkLikelihood?: number;
			//The smallest rendered nodeSize in pixels
			minNodeSize?: number;
			//The largest rendered nodeSize in pixels
			maxNodeSize?: number;
			//The percentage size of nodes to start
			nodeSize?: {
				//The average value for value. Only for types linear, fixed, and normal
				average?: number;
				//The amount that value will be +/- of, or for normal the standard deviation. Only for types linear and normal
				spread?: number;
				//The min bound for the sample for value. Only for distribution min-max
				min?: number;
				//The max bound for the sample for value. Only for distribution min-max
				max?: number;
				//The type of distribution for value
				distribution?: 'linear' | 'normal' | 'min-max' | 'fixed';
			};
			//How much space should be left between this node and other nodes, in units of percentage of this node's size
			nodeMargin?: number;
			// If true then there will be no collison forces
			noCollide?: boolean;
			//How likely two random children in the parent are to have an extra connection amongst themselves. 0.0 is no connections, 1.0 is all connections.
			randomLinkLikelihood?: number;
			//How many nodes to create
			nodeCount?: number;
			//How many iterations of adding edges we should do
			iterations?: number;
			//How much to boost every node when choosing which one to add. Higher numbers make the preferential attachment effect weaker.
			nodeBoost?: number;
			//How much to boost every node when choosing which one to add. Higher numbers make the preferential attachment effect weaker.
			distantNodeBoost?: number;
			//How many edges, on each iteration, we should add
			edgeCount?: number;
		};
	};
};