import { deepCopy as DeepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";

const MaxAmmo = {
	Wallrun: 2,
	Wallclimb: 1,
	Jump: 1,
};

export default class GearController {
	public Ammo = DeepCopy(MaxAmmo);

	public ResetAmmo(Skip?: (keyof typeof MaxAmmo)[]) {
		for (const [Index, Ammo] of pairs(MaxAmmo)) {
			if (Skip?.includes(Index)) continue;
			this.Ammo[Index] = Ammo;
		}
	}
}
