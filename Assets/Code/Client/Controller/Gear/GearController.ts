import { deepCopy as DeepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";
import Core from "Code/Core/Core";
import type { GearRegistryKey } from "Code/Shared/GearRegistry";
import type { AnyItem, GearSlots, InventoryKey, ItemInfo } from "Code/Shared/Types";

const MaxAmmo = {
	Wallrun: 2,
	Wallclimb: 1,
	Jump: 1,
	WallKick: 1,
};

export default class GearController extends AirshipSingleton {
	// Ammo
	public Ammo = DeepCopy(MaxAmmo);
	public MaxAmmo = DeepCopy(MaxAmmo);

	public ResetAmmo(Skip?: (keyof typeof MaxAmmo)[]) {
		for (const [Index, Ammo] of pairs(this.MaxAmmo)) {
			if (Skip?.includes(Index)) continue;
			this.Ammo[Index] = Ammo;
		}

		this.RefreshUI();
	}

	public IsAmmoReset() {
		return this.Ammo.Wallclimb === this.MaxAmmo.Wallclimb && this.Ammo.Wallrun === this.MaxAmmo.Wallrun && this.Ammo.Jump === this.MaxAmmo.Jump;
	}

	// UI
	public RefreshUI() {
		Core().Client.UI.UpdateAmmoCount({ Wallrun: this.MaxAmmo.Wallrun, Wallclimb: this.MaxAmmo.Wallclimb });
	}

	public UpdateUI() {
		Core().Client.UI.UpdateAmmoFill({ Wallrun: this.Ammo.Wallrun, Wallclimb: this.Ammo.Wallclimb });
	}

	// Gear functions
	public TryEquipGear(Slot: GearSlots, Index: number, Contents?: AnyItem) {
		if (Contents && Contents.Type !== "Gear") return;

		const Key = Contents ? (Contents as ItemInfo<"Gear">).Key : "None";
		const Gear = Core().Gear[Key];
		if (Key === "None" ? false : Gear.Slot !== Slot) return;

		const Data = Core().Client.Data.GetLink().Data;
		if (Contents) {
			for (const [Index, ItemID] of pairs(Data.EquippedGear[Slot])) {
				if (ItemID === Contents.UID) {
					Data.EquippedGear[Slot][Index - 1] = "None";
				}
			}
		}

		Data.EquippedGear[Slot][Index - 1] = Contents?.UID ?? "None";

		return true;
	}

	public HasLevel(GearName: GearRegistryKey, Level: number) {
		const Gear = Core().Gear[GearName];
		const Slot = Core().Client.Data.GetLink().Data.EquippedGear[Gear.Slot];

		for (const [_, ID] of pairs(Slot)) {
			const Item = this.GetItem(ID) as ItemInfo<"Gear">;
			if (!Item) continue;
			if (Item.Key === GearName && Item.Level >= Level) {
				return true;
			}
		}

		return false;
	}

	// Utillity
	public GetName(Item: AnyItem) {
		if (Item.Type === "Gear") {
			return Core().Gear[(Item as ItemInfo<"Gear">).Key].Name;
		} else {
			// TEMP
			return Item.Key;
		}
	}

	public GetItem(ID: InventoryKey) {
		if (ID === "None") return;

		return Core().Client.Data.GetLink().Data.Inventory[ID];
	}
}
