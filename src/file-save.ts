import { DataFilename } from './data.GENERATED.js';
import { ScenariosDefinition } from './types.js';
import { filenameForDownload } from './util.js';

const DB_NAME = 'adjacency-map-file-handles';
const DB_VERSION = 1;
const STORE = 'handles';

export const fileSaveAvailable = () : boolean => {
	return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
};

const openDB = () : Promise<IDBDatabase> => new Promise((resolve, reject) => {
	const req = indexedDB.open(DB_NAME, DB_VERSION);
	req.onupgradeneeded = () => {
		req.result.createObjectStore(STORE);
	};
	req.onsuccess = () => resolve(req.result);
	req.onerror = () => reject(req.error);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const idbGet = async (key : string) : Promise<any | undefined> => {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const req = tx.objectStore(STORE).get(key);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const idbSet = async (key : string, value : any) : Promise<void> => {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
};

const idbDelete = async (key : string) : Promise<void> => {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).delete(key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ensurePermission = async (handle : any) : Promise<boolean> => {
	const status = await handle.queryPermission({ mode: 'readwrite' });
	if (status === 'granted') return true;
	const reqStatus = await handle.requestPermission({ mode: 'readwrite' });
	return reqStatus === 'granted';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pickHandle = async (filename : DataFilename) : Promise<any> => {
	// @ts-ignore - showSaveFilePicker is not yet in lib.dom for TS 4.7
	const handle = await window.showSaveFilePicker({
		suggestedName: `${filenameForDownload(filename)}.edits.json`,
		types: [{
			description: 'Adjacency map scenario edits',
			accept: { 'application/json': ['.json'] }
		}]
	});
	await idbSet(filename, handle);
	return handle;
};

export const saveScenarios = async (filename : DataFilename, scenarios : ScenariosDefinition) : Promise<void> => {
	let handle = await idbGet(filename);
	if (handle) {
		try {
			const ok = await ensurePermission(handle);
			if (!ok) {
				await idbDelete(filename);
				handle = undefined;
			}
		} catch {
			await idbDelete(filename);
			handle = undefined;
		}
	}
	if (!handle) handle = await pickHandle(filename);

	try {
		const writable = await handle.createWritable();
		await writable.write(JSON.stringify(scenarios, null, '\t'));
		await writable.close();
	} catch (err) {
		// File handle invalid (file deleted/moved): clear and surface error so caller can re-prompt.
		await idbDelete(filename);
		throw err;
	}
};

export const clearStoredHandle = async (filename : DataFilename) : Promise<void> => {
	await idbDelete(filename);
};
