import type { ModelListItem } from "@cursor/sdk";
import { describe, expect, it } from "vitest";
import {
	getCursorModelSelectionIdentities,
	normalizeCursorContextWindowEntries,
} from "../shared/cursor-model-selection-identities.mjs";
import { BUNDLED_CONTEXT_WINDOWS } from "../src/bundled-context-windows.js";
import { FALLBACK_MODEL_ITEMS } from "../src/cursor-fallback-models.generated.js";
import { __testUtils as modelDiscoveryTestUtils } from "../src/model-discovery.js";

const models = [
	{
		id: "model-a",
		displayName: "Model A",
		aliases: ["alias-a", "shared", "model-b"],
		parameters: [
			{ id: "context", displayName: "Context", values: [{ value: "1m", displayName: "1M" }] },
			{ id: "fast", displayName: "Fast", values: [{ value: "true", displayName: "On" }, { value: "false", displayName: "Off" }] },
		],
		variants: [{ displayName: "Default", isDefault: true, params: [{ id: "context", value: "1m" }, { id: "fast", value: "false" }] }],
	},
	{ id: "model-b", displayName: "Model B", aliases: ["shared"] },
] satisfies ModelListItem[];

describe("Cursor model-selection identities", () => {
	it("matches runtime registration with base-only identities", () => {
		const identities = getCursorModelSelectionIdentities(models);
		const runtimeIds = modelDiscoveryTestUtils.registerModelItems(models).map(({ id }) => id).sort();
		expect(identities.map(({ piModelId }) => piModelId).sort()).toEqual(runtimeIds);
		expect(Object.fromEntries(identities.map(({ piModelId, contextWindowKey, baseContextWindowKey }) => [
			piModelId,
			{ contextWindowKey, baseContextWindowKey },
		]))).toEqual({
			"model-a@1m": { contextWindowKey: "model-a@1m", baseContextWindowKey: "model-a@1m" },
			"alias-a@1m": { contextWindowKey: "alias-a@1m", baseContextWindowKey: "model-a@1m" },
			"model-b": { contextWindowKey: "model-b", baseContextWindowKey: "model-b" },
		});
	});

	it("omits stale, ambiguous, and legacy fast-alias IDs", () => {
		const normalized = normalizeCursorContextWindowEntries(
			models,
			new Map([
				["default", 200_000],
				["model-a@1m:slow", 300_000],
				["model-a@1m:fast", 1_000_000],
				["alias-a@1m:slow", 300_000],
				["shared", 123_000],
				["removed-model", 456_000],
			]),
		);
		expect(Object.fromEntries(normalized)).toEqual({
			default: 200_000,
		});
	});

	it("keeps every bundled key canonical and reachable in the fallback catalog", () => {
		const bundled = new Map(Object.entries(BUNDLED_CONTEXT_WINDOWS));
		expect(normalizeCursorContextWindowEntries(FALLBACK_MODEL_ITEMS, bundled, "bundled snapshot")).toEqual(bundled);
	});
});
