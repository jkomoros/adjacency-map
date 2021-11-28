/*eslint-env node*/

const puppeteer = require("puppeteer");
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sizeOf = promisify(require('image-size'));
const GIFEncoder = require('gifencoder');
const pngFileStream = require('png-file-stream');

const SCREENSHOT_DIR = 'screenshots';

//rendevous point with screenshot service. Duplicated in sim-view.js
const CURRENT_SIMULATION_INDEX_VARIABLE = 'current_simulation_index';
const CURRENT_RUN_INDEX_VARIABLE = 'current_run_index';
const CURRENT_FRAME_INDEX_VARIABLE = 'current_frame_index';
const CURRENT_SIMULATION_NAME_VARIABLE = 'current_simulation_name';
const SETUP_METHOD_VARIABLE = 'setup_method';
const PREVIOUS_FRAME_METHOD_VARIABLE = 'previous_frame';
const RENDER_COMPLETE_VARIABLE = 'render_complete';

const clearScreenshotsDir = () => {
	if (fs.existsSync(SCREENSHOT_DIR)) {
		const files = fs.readdirSync(SCREENSHOT_DIR);
		for (const file of files) {
			fs.unlinkSync(path.join(SCREENSHOT_DIR, file));
		}
	} else {
		fs.mkdirSync(SCREENSHOT_DIR);
	}
};

const generateScreenshots = async () => {

	const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
	const page = await browser.newPage();
	await page.setViewport({
		//The width and height are required but don't matter that much because we use ele.screenshot
		width: 1000,
		height: 1000,
		deviceScaleFactor: 2.0,
	});
	await page.goto('http://localhost:8081', {waitUntil: 'networkidle2'});

	await page.evaluate('document.querySelector("body").style.setProperty("--override-app-background-color", "transparent")');

	//Get us to the very last sim, run, frame
	await page.evaluate('window.' + SETUP_METHOD_VARIABLE + '()');

	let currentSimulationIndex = await page.evaluate('window.' + CURRENT_SIMULATION_INDEX_VARIABLE);
	let currentRunIndex = await page.evaluate('window.' + CURRENT_RUN_INDEX_VARIABLE);
	let currentFrameIndex = await page.evaluate('window.' + CURRENT_FRAME_INDEX_VARIABLE);
	let currentSimulationName = await page.evaluate('window.' + CURRENT_SIMULATION_NAME_VARIABLE);
	do {
		console.log('Working on state #' + currentSimulationIndex + ' : ' + currentRunIndex + ' : ' + currentFrameIndex);
		const ele = await page.evaluateHandle('document.querySelector("my-app").shadowRoot.querySelector("sim-view").shadowRoot.querySelector("frame-visualization")');
		
		//Simulation name are [a-zA-z0-0-_], but '_' is the delimiter for us
		const safeSimulationName = currentSimulationName.split('_').join('-');

		//When this logic is updated, also change gifNameForFile
		let path = SCREENSHOT_DIR + '/screenshot_' + safeSimulationName + '_' + currentSimulationIndex + '_' + currentRunIndex + '_' + currentFrameIndex;
		path += '.png';
		await ele.screenshot({path, omitBackground:true});

		if(currentSimulationIndex == 0 && currentRunIndex == 0 && currentFrameIndex == 0) break;

		await page.evaluate('window.' + PREVIOUS_FRAME_METHOD_VARIABLE + '()');
		//Wait for the flag to be raised high after rendering has happened
		await page.waitForFunction('window.' + RENDER_COMPLETE_VARIABLE);
		currentSimulationIndex = await page.evaluate('window.' + CURRENT_SIMULATION_INDEX_VARIABLE);
		currentRunIndex = await page.evaluate('window.' + CURRENT_RUN_INDEX_VARIABLE);
		currentFrameIndex = await page.evaluate('window.' + CURRENT_FRAME_INDEX_VARIABLE);
		currentSimulationName = await page.evaluate('window.' + CURRENT_SIMULATION_NAME_VARIABLE);
	} while(currentSimulationIndex >= 0 && currentRunIndex >= 0 && currentFrameIndex >= 0);

	await browser.close();
};

const gifNameForFile = (fileName) => {
	//Needs to be updated every time the logic for filename saving is changed.
	const filenameParts = fileName.split('.');
	if (filenameParts[1].toLowerCase() == 'gif') return '';
	const name = filenameParts[0];
	const pieces = name.split('_');
	return pieces[1];
};

const DEFAULT_GIF_CONFIG = {
	//in ms
	delay: 150,
	repeat: 0,
};

//Returns an object with gifNames and the information on each, including: 
// - width
// - height
// - delay
// - repeat
const gifInfos = async () => {
	const result = {};
	const illegalGifs = {};
	const files = fs.readdirSync(SCREENSHOT_DIR);
	for (const file of files) {
		const gifName = gifNameForFile(file);
		if (!gifName) continue;
		if (illegalGifs[gifName]) continue;
		const dim = await sizeOf(path.join(SCREENSHOT_DIR,file));
		const previousDim = result[gifName];
		if (previousDim && (previousDim.height != dim.height || previousDim.width != dim.width)) {
			console.warn(gifName + ' had previous dimensions of [' + previousDim.height + ',' + previousDim.width + '] but dim of [' + dim.height + ',' + dim.width + '] for file ' + file);
			illegalGifs[gifName] = true;
			continue;
		}
		result[gifName] = dim;
	}
	for (const name of Object.keys(illegalGifs)) {
		delete result[name];
	}
	for (const name of Object.keys(result)) {
		result[name] = {...result[name], ...DEFAULT_GIF_CONFIG};
	}
	return result;
};

const generateGifs = async (infos) => {
	for (const [gifName, info] of Object.entries(infos)) {
		console.log("Generating gif " + gifName + " (this could take awhile)");
		const encoder = new GIFEncoder(info.width, info.height);
		encoder.setDelay(info.delay);
		encoder.setRepeat(info.repeat);
		const stream = pngFileStream(path.join(SCREENSHOT_DIR, 'screenshot_' + gifName + '_*_*_*.png'))
			.pipe(encoder.createWriteStream())
			.pipe(fs.createWriteStream(path.join(SCREENSHOT_DIR, gifName + '.gif')));
 
		await new Promise((resolve, reject) => {
			stream.on('finish', resolve);
			stream.on('error', reject);
		});
	}
};

const COMMAND_SCREENSHOT = 'screenshot';
const COMMAND_GIF = 'gif';
const COMMAND_ALL = 'all';

const DEFAULT_ARGS = {
	[COMMAND_SCREENSHOT]: true,
	[COMMAND_GIF]: true
};

(async() => {

	let args = Object.fromEntries(process.argv.slice(2).map(item => [item, true]));

	if (Object.keys(args).length == 0 || args[COMMAND_ALL]) {
		args = DEFAULT_ARGS;
	}

	if (args[COMMAND_SCREENSHOT]) {
		clearScreenshotsDir();
		await generateScreenshots();
	}

	if (args[COMMAND_GIF]) {
		const infos = await gifInfos();
		await generateGifs(infos);
	}
})();