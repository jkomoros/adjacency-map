// Publishes a snapshot of the webapp's current view to the dev server via
// POST /__state__. The dev server's middleware writes the JSON to
// /tmp/adjacency-state.json so AI agents can see what the user is currently
// viewing without asking. Safe no-op when the endpoint isn't available
// (production build, no dev server, etc.).

import {
	selectFilename,
	selectScenarioName,
	selectCompareScenarioName,
	selectSelectedLayoutID,
	selectHoveredLayoutID
} from './selectors.js';

import { RootState } from './types.js';

type SidecarStore = {
	getState : () => RootState | object,
	subscribe : (listener : () => void) => void
};

const ENDPOINT = '/__state__';
const DEBOUNCE_MS = 250;

type StateSnapshot = {
	filename : string,
	scenarioName : string,
	compareScenarioName : string | null,
	selectedLayoutID : string | null,
	hoveredLayoutID : string | null,
	updatedAt : string
};

const buildSnapshot = (state : RootState) : StateSnapshot => {
	return {
		filename: selectFilename(state) || '',
		scenarioName: selectScenarioName(state) || '',
		compareScenarioName: selectCompareScenarioName(state) ?? null,
		selectedLayoutID: selectSelectedLayoutID(state) ?? null,
		hoveredLayoutID: selectHoveredLayoutID(state) ?? null,
		updatedAt: new Date().toISOString()
	};
};

const snapshotsEqual = (a : StateSnapshot | null, b : StateSnapshot) : boolean => {
	if (!a) return false;
	return a.filename === b.filename
		&& a.scenarioName === b.scenarioName
		&& a.compareScenarioName === b.compareScenarioName
		&& a.selectedLayoutID === b.selectedLayoutID
		&& a.hoveredLayoutID === b.hoveredLayoutID;
};

const publish = (snapshot : StateSnapshot) : void => {
	const body = JSON.stringify(snapshot);
	try {
		// Use fetch with keepalive — sendBeacon doesn't allow setting JSON content-type.
		fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
			keepalive: true
		}).catch(() => { /* dev server not available; no-op */ });
	} catch {
		/* environment doesn't support fetch; no-op */
	}
};

export const installSidecarSubscriber = (store : SidecarStore) : void => {
	let lastPublished : StateSnapshot | null = null;
	let pending : ReturnType<typeof setTimeout> | null = null;

	const checkAndPublish = () => {
		const raw = store.getState() as RootState;
		if (!raw || !raw.data) return;
		const snap = buildSnapshot(raw);
		if (snapshotsEqual(lastPublished, snap)) return;
		lastPublished = snap;
		publish(snap);
	};

	store.subscribe(() => {
		if (pending) clearTimeout(pending);
		pending = setTimeout(checkAndPublish, DEBOUNCE_MS);
	});
};
