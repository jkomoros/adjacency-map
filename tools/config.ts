import * as fs from "fs";
import * as path from "path";

import {
	camelCaseFilename
} from '../src/util.js';

const DYNAMIC_TYPES_FILE = 'src/data.GENERATED.ts';
const DATA_DIRECTORY = 'data';

const generateConfig = () => {
	const datafiles = [];
	for (const file of fs.readdirSync(DATA_DIRECTORY)) {
		const filename = path.basename(file, '.json');
		datafiles.push(filename);
	}
	const data =`//This file was generated by 'npm run generate:config'

//We import all data files directly into the build because they aren't that big
//and this way we can get direct typescript type checking at compile time.

${datafiles.map(filename => `import ${camelCaseFilename(filename) + 'Data'} from '../data/${filename}.json' assert { type: "json" };\n`)}
export const DATA = {
${datafiles.map(filename => `\t'${filename}': ${camelCaseFilename(filename) + 'Data'}`).join(',\n')}
} as const;
`;

	fs.writeFileSync(DYNAMIC_TYPES_FILE, data);
};

(async() => {
	generateConfig();
})();

