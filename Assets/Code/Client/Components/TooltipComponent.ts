import type GearObject from "Code/Shared/Object/GearObject";

export default class TooltipComponent extends AirshipBehaviour {
	public TooltipString: string;
	public TooltipGear = {
		GearTarget: undefined as GearObject | undefined,
		PerkLevel: 1 as number,
	};

	public GetText() {
		if (this.TooltipGear.GearTarget) {
			const Gear = this.TooltipGear.GearTarget;

			const ItemPerks = Gear.Perks[this.TooltipGear.PerkLevel - 1];
			const Description = Gear.Description;

			return `${Gear.Name} LV. ${this.TooltipGear.PerkLevel}\n\n${Description}\n\n${ItemPerks}`;
		} else return this.TooltipString;
	}
}
