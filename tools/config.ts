import { readdirSync, writeFileSync } from 'fs';
import { basename } from 'path';
import { camelCaseFilename } from '../src/util.js';

const DYNAMIC_TYPES_FILE = 'src/data.GENERATED.ts';
const DATA_DIRECTORY = 'data';

const generateConfig = () => {
	const datafiles = [];
	for (const file of readdirSync(DATA_DIRECTORY)) {
		if (!file.endsWith('.ts')) continue;
		if (file.endsWith('.d.ts')) continue;
		const filename = basename(file, '.ts');
		if (filename.includes('SAMPLE')) continue;
		datafiles.push(filename);
	}
	const data = `//This file was generated by 'npm run generate:config'

//We import all data files directly into the build because they aren't that big
//and this way we can get direct typescript type checking at compile time.

import {
	RawMapDefinition
} from './types.js';

${datafiles.map(filename => `import ${camelCaseFilename(filename) + 'Data'} from '../data/${filename}.js';`).join('\n')}

export type DataFilename = ${datafiles.map(filename => `'${filename}'`).join(' | ')};

export const DATA : {[filename in DataFilename]: RawMapDefinition} = {
${datafiles.map(filename => `\t'${filename}': ${camelCaseFilename(filename) + 'Data'}`).join(',\n')}
};
`;

	writeFileSync(DYNAMIC_TYPES_FILE, data);
};

generateConfig();