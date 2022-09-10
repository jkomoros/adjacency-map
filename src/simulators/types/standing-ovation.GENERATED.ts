export type StandingOvationSimOptions = {
	//Number of rows in the theater
	rows: number;
	//Number of cols in the theater
	cols: number;
	//What percentage of seats should be filled
	filledSeatProportion?: number;
	//How high of quality the performance was
	performanceQuality?: {
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
	//How likely individuals are to do a standing ovation in the first place
	ovationPropensity?: {
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
	//How high of a threshold individuals have for deciding to stand if individuals visible ahead of them stood
	standingThreshold?: {
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
	//How quickly the impact of someone standing in front of this person falls off in mattering
	forwardStandingFalloff?: {
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
	//The threshold of what proportion in the audience must be standing before this person decideds to stand, too
	fomoThreshold?: {
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