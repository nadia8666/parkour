import type { GearRegistryKey } from "./GearRegistry";

export type GearSlots = "Grip" | "Core" | "Mod" | "Augment";

export const DataTemplate = {
	EquippedGear: {
		Grip: ["None"] as [GearRegistryKey],
		Core: ["None"] as [GearRegistryKey],
		Mod: ["None", "None"] as [GearRegistryKey, GearRegistryKey],
		Augment: ["None", "None", "None"] as [GearRegistryKey, GearRegistryKey, GearRegistryKey],
	},
};

export type DataFormat = typeof DataTemplate;
