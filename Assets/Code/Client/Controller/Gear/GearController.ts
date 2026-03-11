import { deepCopy as DeepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";
import { WithGear } from "Code/Client/Config";
import Core from "Code/Core/Core";
import type { GearRegistryKey } from "Code/Shared/GearRegistry";
import { type AnyItem, type GearItem, type InventoryKey, type ItemInfo, ItemTypes } from "Code/Shared/Types";
import { Utility } from "Code/Shared/Utility/Utility";

const MaxAmmo = {
	Wallrun: 2,
	Wallclimb: 1,
	Jump: 1,
	WallKick: 1,

	Grappler: WithGear({ None: 0, Grappler: [1, 2, 3] }),
};

type _MX = typeof MaxAmmo;
type StripAmmo = {
	[P in keyof _MX]: _MX[P] extends () => unknown ? ReturnType<_MX[P]> : _MX[P];
};

export default class GearController extends AirshipSingleton {
	// Ammo
	public Ammo: StripAmmo;

	@Client()
	override Start() {
		const Max = DeepCopy(MaxAmmo);
		for (const [Index, Ammo] of pairs(Max)) {
			(Max as unknown as StripAmmo)[Index] = typeIs(Ammo, "number") ? Ammo : Ammo();
		}

		this.Ammo = Max as unknown as StripAmmo;
	}

	public ResetAmmo(Skip?: (keyof typeof MaxAmmo)[]) {
		for (const [Index, Ammo] of pairs(MaxAmmo)) {
			if (Skip?.includes(Index)) continue;
			this.Ammo[Index] = typeIs(Ammo, "number") ? Ammo : Ammo();
		}

		this.RefreshUI();
	}

	public IsAmmoReset() {
		return this.Ammo.Wallclimb === MaxAmmo.Wallclimb && this.Ammo.Wallrun === MaxAmmo.Wallrun && this.Ammo.Jump === MaxAmmo.Jump;
	}

	// UI
	public RefreshUI() {
		Core().Client.UI.UpdateAmmoCount({ Wallrun: MaxAmmo.Wallrun, Wallclimb: MaxAmmo.Wallclimb, WallKick: MaxAmmo.WallKick });
	}

	public UpdateUI() {
		Core().Client.UI.UpdateAmmoFill({ Wallrun: this.Ammo.Wallrun, Wallclimb: this.Ammo.Wallclimb, WallKick: this.Ammo.WallKick });
	}

	// Gear functions
	public HasLevel(GearName: GearRegistryKey, Level: number) {
		const Gear = Core().Gear[GearName];
		const Slot = Core().Client.Data.GetLink().Data.Inventories[Gear.Slot];

		for (const [_, Item] of pairs(Slot.Content)) {
			if (!Item) continue;
			if (Item.Key === GearName && Item.Type === ItemTypes.Gear && Item.Level! >= Level) {
				return true;
			}
		}

		return false;
	}

	// Utillity
	public GetName(Item: AnyItem) {
		if (Item.Type === ItemTypes.Gear) {
			return Core().Gear[(Item as GearItem).Key].Name;
		} else {
			// TEMP
			if (Item.Type === ItemTypes.Block) {
				return Utility.FormatStringForName(Core().World.GetDefinitionFromBlock(Item.BlockID).name);
			}
			return Utility.FormatStringForName(Item.Key);
		}
	}

	public GetItem(ID: InventoryKey) {
		if (ID === "None") return $tuple(undefined, undefined);

		let [Inventory, Item]: [string | undefined, ItemInfo | undefined] = [undefined, undefined];

		for (const [Inv, Data] of pairs(Core().Client.Data.GetLink().Data.Inventories)) {
			for (const [_, Value] of pairs(Data.Content)) {
				if (Value.UID === ID) {
					Inventory = Inv as string;
					Item = Value;
					break;
				}
			}
		}

		return $tuple(Item, Inventory);
	}
}
