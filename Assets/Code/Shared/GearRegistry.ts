import GearObject from "./Object/GearObject";

export type GearRegistryKey = { [K in keyof GearRegistrySingleton]: GearRegistrySingleton[K] extends GearObject ? K : never }[keyof GearRegistrySingleton] & string;
export default class GearRegistrySingleton extends AirshipSingleton {
	@Header("Grip")
	public SlipGlove: GearObject;
	public GripGlove: GearObject;

	@Header("Core")

	@Header("Mod")
	public ARCBrace: GearObject;

	@Header("Augment")
	public t: GearObject;

	@NonSerialized() public None = new GearObject();

	public KeyFromGear(Gear: GearObject): GearRegistryKey {
		for (const [Index, Value] of pairs(this)) {
			if (Value === Gear) {
				return Index as GearRegistryKey;
			}
		}

		error(`Unable to find Key for ${Gear.Name}`);
	}

	public GearFromKey(Key: GearRegistryKey): GearObject {
		return this[Key];
	}

	public Start() {
		this.None.Name = "None";
	}
}
