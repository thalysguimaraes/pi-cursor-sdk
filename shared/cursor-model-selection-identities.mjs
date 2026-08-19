function getParameter(model, id) {
	return (model.parameters ?? []).find((parameter) => parameter.id === id);
}

function getAmbiguousAliases(models) {
	const ownersByAlias = new Map();
	for (const model of models) {
		for (const rawAlias of model.aliases ?? []) {
			const alias = rawAlias.trim();
			if (!alias || alias === model.id) continue;
			const owners = ownersByAlias.get(alias) ?? new Set();
			owners.add(model.id);
			ownersByAlias.set(alias, owners);
		}
	}
	return new Set([...ownersByAlias].filter(([, owners]) => owners.size > 1).map(([alias]) => alias));
}

function getSelectableIds(model, reservedIds, ambiguousAliases) {
	const ids = [model.id];
	for (const rawAlias of model.aliases ?? []) {
		const alias = rawAlias.trim();
		if (!alias || alias === model.id || ids.includes(alias) || reservedIds.has(alias) || ambiguousAliases.has(alias)) continue;
		ids.push(alias);
	}
	return ids;
}

function encodePiModelId(modelId, context) {
	return context ? `${modelId}@${context}` : modelId;
}

export function getCursorModelSelectionIdentities(models) {
	const sortedModels = [...models].sort((a, b) => a.id.localeCompare(b.id));
	const reservedIds = new Set(models.map((model) => model.id));
	const ambiguousAliases = getAmbiguousAliases(models);
	const usedPiModelIds = new Set();
	const identities = [];

	for (const model of sortedModels) {
		const contextValues = getParameter(model, "context")?.values?.map(({ value }) => value) ?? [];
		const contexts = contextValues.length > 0 ? contextValues : [undefined];

		for (const selectionModelId of getSelectableIds(model, reservedIds, ambiguousAliases)) {
			for (const context of contexts) {
				const piModelId = encodePiModelId(selectionModelId, context);
				if (usedPiModelIds.has(piModelId)) continue;
				usedPiModelIds.add(piModelId);
				identities.push({
					model,
					selectionModelId,
					...(context ? { context } : {}),
					piModelId,
					contextWindowKey: piModelId,
					baseContextWindowKey: encodePiModelId(model.id, context),
				});
			}
		}
	}

	return identities;
}

export function normalizeCursorContextWindowEntries(models, entries, source = "context windows") {
	const canonicalBySelectableId = new Map(
		getCursorModelSelectionIdentities(models).map(({ piModelId, contextWindowKey }) => [piModelId, contextWindowKey]),
	);
	const normalized = new Map();
	for (const [modelId, contextWindow] of entries) {
		const canonicalId = modelId === "default" ? modelId : canonicalBySelectableId.get(modelId);
		if (!canonicalId) continue;
		const existing = normalized.get(canonicalId);
		if (existing !== undefined && existing !== contextWindow) {
			throw new Error(`${source} assigns conflicting windows to equivalent selection ${canonicalId}: ${existing} and ${contextWindow}`);
		}
		normalized.set(canonicalId, contextWindow);
	}
	return normalized;
}
