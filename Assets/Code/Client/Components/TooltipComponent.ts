import type GearObject from "Code/Shared/Object/GearObject";

const Registry = new Map<GameObject, TooltipComponent>();

export default class TooltipComponent extends AirshipBehaviour {
	public TooltipString: string;
	public TooltipGear = {
		GearTarget: undefined as GearObject | undefined,
		PerkLevel: 1 as number,
	};

	override OnEnable() {
		Registry.set(this.gameObject, this);
	}

	override OnDisable() {
		Registry.delete(this.gameObject);
	}

	public GetText() {
		if (this.TooltipGear.GearTarget) {
			const Gear = this.TooltipGear.GearTarget;

			const ItemPerks = Gear.Perks[this.TooltipGear.PerkLevel - 1];
			const Description = Gear.Description;

			return `${Gear.Name} LV. ${this.TooltipGear.PerkLevel}\n\n${Description}\n\n${ItemPerks}`;
		} else return this.TooltipString;
	}

	public static Get(Target?: GameObject) {
		if (!Target) return undefined;
		return Registry.get(Target);
	}
}
