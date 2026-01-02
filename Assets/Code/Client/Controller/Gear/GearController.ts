import { deepCopy as DeepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";
import DataController from "Code/Client/Framework/DataController";
import UIController from "Code/Client/UI/UIController";
import GearRegistrySingleton from "Code/Shared/GearRegistry";
import type GearObject from "Code/Shared/Object/GearObject";
import type { GearSlots } from "Code/Shared/Types";

const MaxAmmo = {
	Wallrun: 2,
	Wallclimb: 1,
	Jump: 1,
};

export default class GearController extends AirshipSingleton {
	public Ammo = DeepCopy(MaxAmmo);
	public MaxAmmo = DeepCopy(MaxAmmo);

	@Client()
	public ResetAmmo(Skip?: (keyof typeof MaxAmmo)[]) {
		for (const [Index, Ammo] of pairs(this.MaxAmmo)) {
			if (Skip?.includes(Index)) continue;
			this.Ammo[Index] = Ammo;
		}

		this.RefreshUI();
	}

	@Client()
	public IsAmmoReset() {
		return this.Ammo.Wallclimb === this.MaxAmmo.Wallclimb && this.Ammo.Wallrun === this.MaxAmmo.Wallrun && this.Ammo.Jump === this.MaxAmmo.Jump;
	}

	@Client()
	public RefreshUI() {
		UIController.Get().UpdateAmmoCount({ Wallrun: this.MaxAmmo.Wallrun, WallClimb: this.MaxAmmo.Wallclimb });
	}

	@Client()
	public UpdateUI() {
		UIController.Get().UpdateAmmoFill({ Wallrun: this.Ammo.Wallrun, WallClimb: this.Ammo.Wallclimb });
	}

	@Client()
	public TryEquipGear(Slot: GearSlots, Index: number, Contents: GearObject) {
		const Key = GearRegistrySingleton.Get().KeyFromGear(Contents);
		if (Key === "None" ? false : Contents.Slot !== Slot) return;

		const Data = DataController.Get().GetLink().Data;

		Data.EquippedGear[Slot][Index - 1] = Key;

		const CurrentContent = Data.EquippedGear[Slot][Index - 1]; // push to inventory

		return true;
	}
}
