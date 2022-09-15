//This file was generated by `npm run generate:types`

import {
	DistributionOptions
} from '../../types.js';

export type StandingOvationSimOptions = {
	/** Number of rows in the theater */
	rows: number;
	/** Number of cols in the theater */
	cols: number;
	/** What percentage of seats should be filled */
	filledSeatProportion?: number;
	/** How high of quality the performance was */
	performanceQuality?: DistributionOptions;
	/** How likely individuals are to do a standing ovation in the first place */
	ovationPropensity?: DistributionOptions;
	/** How high of a threshold individuals have for deciding to stand if individuals visible ahead of them stood */
	standingThreshold?: DistributionOptions;
	/** How quickly the impact of someone standing in front of this person falls off in mattering */
	forwardStandingFalloff?: DistributionOptions;
	/** The threshold of what proportion in the audience must be standing before this person decideds to stand, too */
	fomoThreshold?: DistributionOptions;
};