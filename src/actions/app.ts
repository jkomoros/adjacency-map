export const UPDATE_PAGE = "UPDATE_PAGE";
export const UPDATE_OFFLINE = "UPDATE_OFFLINE";
export const UPDATE_HASH = "UPDATE_HASH";

import {
	AnyAction
} from 'redux';

import {
	selectPage,
	selectPageExtra,
	selectFilename,
	selectHashForCurrentState,
	selectHash
} from '../selectors.js';

import {
	AppActionCreator
} from '../store.js';

import {
	URLHashArgs
} from '../types.js';

import {
	updateScenarioName
} from './data.js';

//if silent is true, then just passively updates the URL to reflect what it should be.
export const navigatePathTo : AppActionCreator = (path, silent) => (dispatch) => {
	//If we're already pointed there, no need to navigate
	if ('/' + path === window.location.pathname) return;
	//Don't replace search or hash if they exist. If htey don't exist, these
	//will be '', but if they do exist they will have the '?' and '#' prepended.
	path = path + window.location.search + window.location.hash;
	if (silent) {
		window.history.replaceState({}, '', path);
		return;
	}
	window.history.pushState({}, '', path);
	dispatch(navigate(path));
};

export const canonicalizeHash : AppActionCreator = () => (dispatch, getState) => {
	const state = getState();
	const hash = selectHashForCurrentState(state);
	dispatch(updateHash(hash));
};

const parseHash = (hash : string) : URLHashArgs => {
	if (hash.startsWith('#')) hash = hash.substring(1);
	const args : URLHashArgs = {};
	if (!hash) return args;
	for (const part of hash.split('&')) {
		const [key, val] = part.split('=');
		switch(key) {
		case 's':
			args.s = val;
			break;
		default:
			//TODO: use assertUnreachable pattern here
			console.warn('Unknown URL arg: ' + key);
		}
	}
	return args;
};

const ingestHash : AppActionCreator = (hash) => (dispatch) => {
	const pieces = parseHash(hash);

	for (const [key, value] of Object.entries(pieces)) {
		switch (key) {
		case 's':
			dispatch(updateScenarioName(value));
			break;
		default:
			//TODO: use assertUnreachable pattern here
			console.warn('Unknown URL arg: ' + key);
		}
	}
};

export const updateHash : AppActionCreator = (hash, comesFromURL = false) => (dispatch, getState) => {
	if (hash.startsWith('#')) hash = hash.substring(1);
	const state = getState();
	const currentHash = selectHash(state);
	if (hash == currentHash && !comesFromURL) return;
	if (comesFromURL) {
		dispatch(ingestHash(hash));
	} else {
		window.location.hash = hash;
		//Clear the '#'
		if (!hash) history.replaceState('', '', window.location.pathname + window.location.search);
	}
	dispatch({
		type: UPDATE_HASH,
		hash
	});
};

export const canonicalizePath : AppActionCreator = () => (dispatch ,getState) => {

	const state = getState();

	const page = selectPage(state);
	const pageExtra = selectPageExtra(state);

	const path = [page];
	
	if (page != 'main') {
		path.push(pageExtra);
	} else {
		const filename = selectFilename(state);
		path.push(filename, '');
	}

	dispatch(navigatePathTo(path.join('/'), true));
};

export const navigate : AppActionCreator = (path) => (dispatch) => {
	// Extract the page name from path.
	const page = path === "/" ? "main" : path.slice(1);

	// Any other info you might want to extract from the path (like page type),
	// you can do here
	dispatch(loadPage(page));
};

const loadPage : AppActionCreator = (location) => (dispatch) => {

	const pieces = location.split('/');

	let page = pieces[0];
	const pageExtra = pieces.length < 2 ? '' : pieces.slice(1).join('/');

	switch(page) {
	case "main":
		import("../components/main-view.js");
		break;
	default:
		page = "view404";
		import("../components/my-view404.js");
	}

	dispatch(updatePage(page, pageExtra));
};

const updatePage = (page : string, pageExtra : string) : AnyAction => {
	return {
		type: UPDATE_PAGE,
		page,
		pageExtra,
	};
};

export const updateOffline : AppActionCreator = (offline) => (dispatch) => {
	dispatch({
		type: UPDATE_OFFLINE,
		offline
	});
};