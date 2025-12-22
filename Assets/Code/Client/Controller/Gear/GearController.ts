import { deepCopy as DeepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";

const MaxAmmo = {
	Wallrun: 2,
    Wallclimb: 1,
};

export default class GearController {
	public Ammo = DeepCopy(MaxAmmo)

    public ResetAmmo() {
        for (const [Index, Ammo] of pairs(MaxAmmo)) {
            this.Ammo[Index] = Ammo
        }
    }
}
