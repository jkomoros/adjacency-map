//This file was generated by 'npm run generate:config'

//We import all data files directly into the build because they aren't that big
//and this way we can get direct typescript type checking at compile time.

import defaultData from '../data/default.json' assert { type: "json" };

export const DATA = {
	'default': defaultData
} as const;
