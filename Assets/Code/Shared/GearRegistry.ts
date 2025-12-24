import type GearObject from "./Object/GearObject";

export default class GearRegistrySingleton extends AirshipSingleton {
	@Header("Grip")
	public SlipGlove: GearObject;
	public GripGlove: GearObject;

	@Header("Core")

	@Header("Mod")
	public ARCBrace: GearObject;

	@Header("Augment")
	public t: GearObject;
}
