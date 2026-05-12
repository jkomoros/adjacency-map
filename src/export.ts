import { AdjacencyMap } from './adjacency-map.js';

type AggregateEntry = { property : string, value : number };
type NodeDelta = { id : string, property : string, before : number, after : number, delta : number } | { id : string, kind : 'added' | 'removed' };

export type ExportReportArgs = {
	filename : string,
	scenarioName : string,
	map : AdjacencyMap,
	baseMap? : AdjacencyMap | null,
	headlineMetrics? : AggregateEntry[]
};

export const generateMarkdownReport = (args : ExportReportArgs) : string => {
	const { filename, scenarioName, map, baseMap, headlineMetrics } = args;
	const out : string[] = [];

	const mapDesc = (map.description || '').trim();
	out.push(`# ${mapDesc || filename}`);
	out.push('');
	out.push(`**File:** \`${filename}\``);
	const displayScenario = scenarioName || '(base)';
	out.push(`**Scenario:** \`${displayScenario}\``);
	const scenario = map.scenario;
	if (scenario && scenario.description) out.push(`**Description:** ${scenario.description}`);
	out.push('');

	out.push('## Decision');
	out.push((scenario && scenario.decision) ? scenario.decision : '_None recorded._');
	out.push('');

	out.push('## Reasoning');
	out.push((scenario && scenario.reasoning) ? scenario.reasoning : '_None recorded._');
	out.push('');

	out.push('## Aggregate metrics');
	out.push('');
	out.push('| Property | Value |');
	out.push('|---|---|');
	const metrics = headlineMetrics && headlineMetrics.length > 0
		? headlineMetrics
		: Object.entries((map.result || {}))
			.filter(([_, v]) => typeof v === 'number' && Math.abs(v as number) > 1e-9)
			.map(([k, v]) => ({ property: k, value: v as number }));
	if (metrics.length === 0) {
		out.push('| _none_ | |');
	}
	for (const m of metrics) {
		out.push(`| \`${m.property}\` | ${m.value.toFixed(2)} |`);
	}
	out.push('');

	// Top 5 nodes by 'value' (or first numeric root property)
	const result = (map.result || {}) as Record<string, unknown>;
	const candidate = 'value' in result && typeof result.value === 'number'
		? 'value'
		: Object.keys(result).find(k => typeof result[k] === 'number');
	if (candidate) {
		const nodeIDs = Object.keys(map.nodes).filter(id => id !== '');
		const ranked = nodeIDs.map(id => {
			const nv = (map.node(id).values || {}) as Record<string, unknown>;
			const v = nv[candidate];
			return { id, score: typeof v === 'number' ? v : 0 };
		}).sort((a, b) => b.score - a.score).slice(0, 5);
		out.push(`## Top 5 nodes by \`${candidate}\``);
		out.push('');
		ranked.forEach((r, i) => out.push(`${i + 1}. \`${r.id}\` — ${r.score.toFixed(2)}`));
		out.push('');
	}

	if (baseMap && scenarioName) {
		out.push('## Modified from base');
		out.push('');
		const deltas : NodeDelta[] = [];
		const allIDs = new Set([...Object.keys(map.nodes), ...Object.keys(baseMap.nodes)]);
		for (const id of allIDs) {
			if (id === '') continue;
			const inThis = id in map.nodes;
			const inBase = id in baseMap.nodes;
			if (!inBase && inThis) { deltas.push({ id, kind: 'added' }); continue; }
			if (inBase && !inThis) { deltas.push({ id, kind: 'removed' }); continue; }
			const av = (baseMap.node(id).values || {}) as Record<string, unknown>;
			const bv = (map.node(id).values || {}) as Record<string, unknown>;
			for (const k of new Set([...Object.keys(av), ...Object.keys(bv)])) {
				const a = av[k];
				const b = bv[k];
				if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) > 1e-9) {
					deltas.push({ id, property: k, before: a, after: b, delta: b - a });
				}
			}
		}
		if (deltas.length === 0) {
			out.push('_None._');
		} else {
			for (const d of deltas) {
				if ('kind' in d) {
					out.push(`- ${d.kind === 'added' ? '+' : '-'} \`${d.id}\` (${d.kind})`);
				} else {
					const sign = d.delta >= 0 ? '+' : '';
					out.push(`- ~ \`${d.id}.${d.property}\`: ${d.before.toFixed(2)} → ${d.after.toFixed(2)} (${sign}${d.delta.toFixed(2)})`);
				}
			}
		}
		out.push('');
	}

	out.push('---');
	out.push(`_Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC_`);
	return out.join('\n');
};

// Serialize an SVG DOM element to a PNG blob. The svgElement should be the
// rendered <svg> on the page; we read its computed width/height and stamp them
// into the serialized form (so the PNG is the correct size). The scale param
// multiplies the output size for hi-DPI.
export const exportSVGToPNG = async (svgElement : SVGSVGElement, scale = 2) : Promise<Blob> => {
	const bbox = svgElement.getBoundingClientRect();
	const width = Math.max(1, Math.round(bbox.width));
	const height = Math.max(1, Math.round(bbox.height));

	// Clone so we don't mutate the live element, then ensure width/height are
	// explicitly set and a viewBox exists.
	const clone = svgElement.cloneNode(true) as SVGSVGElement;
	clone.setAttribute('width', String(width));
	clone.setAttribute('height', String(height));
	if (!clone.getAttribute('viewBox')) {
		clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
	}
	clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

	// Inline any styles from the diagram component's shadow root that affect
	// the SVG. The simplest approach: walk the component's own <style> tags
	// and concatenate their text into a <style> child of the clone.
	const shadowRoot = svgElement.getRootNode();
	if (shadowRoot && shadowRoot instanceof ShadowRoot) {
		const styleTexts : string[] = [];
		for (const styleEl of Array.from(shadowRoot.querySelectorAll('style'))) {
			styleTexts.push(styleEl.textContent || '');
		}
		if (styleTexts.length > 0) {
			const styleNode = document.createElementNS('http://www.w3.org/2000/svg', 'style');
			styleNode.textContent = styleTexts.join('\n');
			clone.insertBefore(styleNode, clone.firstChild);
		}
	}

	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(clone);
	const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(svgBlob);

	try {
		const img = new Image();
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = (e) => reject(new Error('Failed to load SVG image: ' + String(e)));
			img.src = url;
		});

		const canvas = document.createElement('canvas');
		canvas.width = width * scale;
		canvas.height = height * scale;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not get 2D context');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(blob => {
				if (blob) resolve(blob);
				else reject(new Error('canvas.toBlob returned null'));
			}, 'image/png');
		});
	} finally {
		URL.revokeObjectURL(url);
	}
};

export const downloadBlob = (blob : Blob, filename : string) : void => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
};
