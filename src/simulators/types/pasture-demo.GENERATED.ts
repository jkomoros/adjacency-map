export type PastureDemoSimOptions = {
	//The number of agents
	agents?: number;
	//Number of rows in the map
	rows?: number;
	//Number of cols in the map
	cols?: number;
	//The number of rounds
	rounds?: number;
	//How quickly value grows in each cell
	growthRate?: number;
	//On each frame, how likely a given agent is to spawn a child
	spawnLikelihood?: number;
	//On each frame, how likely a given agent is to die.
	deathLikelihood?: number;
};