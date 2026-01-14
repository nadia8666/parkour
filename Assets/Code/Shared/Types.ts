import type { GearRegistryKey } from "./GearRegistry";

export type ItemTypes = "Gear" | "Consumable" | "Resource" | "Key";
export type GearSlots = "Grip" | "Core" | "Mod" | "Augment";
export interface ItemInfo<Type extends ItemTypes> {
	Type: Type;
	Key: Type extends "Gear" ? GearRegistryKey : string;
	Level: Type extends "Gear" ? number : undefined;
	ObtainedTime: number;
	UID: string;
}

export type AnyItem = ItemInfo<ItemTypes>;

export interface DataFormat {
	EquippedGear: {
		Grip: [InventoryKey],
		Core: [InventoryKey],
		Mod: [InventoryKey, InventoryKey],
		Augment: [InventoryKey, InventoryKey, InventoryKey],
	}
	Inventory: { [Index: string]: ItemInfo<ItemTypes> }
};

export type InventoryKey = keyof DataFormat["Inventory"]

export const DataTemplate: DataFormat = {
	EquippedGear: {
		Grip: ["None"],
		Core: ["None"],
		Mod: ["None", "None"],
		Augment: ["None", "None", "None"],
	},
	Inventory: {
		DebugGlove: {
			Type: "Gear",
			Key: "BaseGlove",
			Level: 1,
			ObtainedTime: 0,
			UID: "DebugGlove",
		},
		DebugGrip1: {
			Type: "Gear",
			Key: "GripGlove",
			Level: 1,
			ObtainedTime: 0,
			UID: "DebugGrip1",
		},
		DebugGrip2: {
			Type: "Gear",
			Key: "GripGlove",
			Level: 2,
			ObtainedTime: 0,
			UID: "DebugGrip2",
		},
		DebugSlip1: {
			Type: "Gear",
			Key: "SlipGlove",
			Level: 1,
			ObtainedTime: 0,
			UID: "DebugSlip1",
		},
		DebugSlip2: {
			Type: "Gear",
			Key: "SlipGlove",
			Level: 2,
			ObtainedTime: 0,
			UID: "DebugSlip2",
		},
		DebugARCBrace: {
			Type: "Gear",
			Key: "ARCBrace",
			Level: 1,
			ObtainedTime: 0,
			UID: "DebugARCBrace",
		},
	},
};


