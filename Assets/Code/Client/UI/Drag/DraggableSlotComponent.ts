import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import type TooltipComponent from "Code/Client/Components/TooltipComponent";
import Core from "Code/Core/Core";
import type { AnyItem, GearSlots, ItemInfo } from "Code/Shared/Types";

export enum CallbackType {
	Loadout,
	Inventory,
}

const AllSlots = new Set<DraggableSlotComponent>();

export default class DraggableSlotComponent extends AirshipBehaviour {
	private Connections = new Bin();

	@Header("References")

	@Header("Config")
	@SerializeField()
	private Draggable = true;
	public CallbackType: CallbackType = CallbackType.Inventory;

	// Loadout Slot
	@ShowIf("CallbackType", CallbackType.Loadout)
	@Header("Loadout Slot Config")
	public LS_TargetSlot: GearSlots;
	@ShowIf("CallbackType", CallbackType.Loadout)
	public LS_SlotID: number;
	public Tooltip: TooltipComponent | undefined;

	// InventorySlot

	@NonSerialized() public SlotContents: AnyItem | undefined;
	@Client()
	override OnEnable() {
		this.Connections.Add(
			Mouse.onLeftDown.Connect(() => {
				if (this.IsDraggable()) return;

				if (Core().Client.UI.RaycastUI() === this.gameObject) this.DragStart();
			}),
		);

		if (this.CallbackType === CallbackType.Loadout) {
			AllSlots.add(this);
			this.LS_FetchSlotContents();
		} else {
			this.UpdateFilled();
		}
	}

	@Client()
	override OnDisable() {
		this.Connections.Clean();

		AllSlots.delete(this);
	}

	public IsDraggable() {
		return !this.Draggable || !this.SlotContents;
	}

	public DragStart() {
		Core().Client.Drag.StartDrag(this);
	}

	public UpdateFilled() {
		if (!this.Tooltip) return;
		const IsGear = this.SlotContents?.Type === "Gear";
		if (this.SlotContents) {
			if (IsGear) {
				this.Tooltip.TooltipGear.GearTarget = Core().Gear[(this.SlotContents as ItemInfo<"Gear">).Key];
				this.Tooltip.TooltipGear.PerkLevel = this.SlotContents.Level ?? 1;
			} else {
				this.Tooltip.TooltipGear.GearTarget = undefined;
				this.Tooltip.TooltipString = `${Core().Client.Gear.GetName(this.SlotContents)}`;
			}
		} else {
			if (this.CallbackType === CallbackType.Inventory) {
				this.Tooltip.TooltipString = `Empty`;
			} else {
				this.Tooltip.TooltipString = `Empty ${this.LS_TargetSlot} Slot`;
			}

			this.Tooltip.TooltipGear.GearTarget = undefined;
		}
	}

	public DraggedOnto(Target?: DraggableSlotComponent) {
		const IsLoadout = this.CallbackType === CallbackType.Loadout;
		if (Target) {
			const TargetIsLoadout = Target.CallbackType === CallbackType.Loadout;

			if (TargetIsLoadout) {
				if (Core().Client.Gear.TryEquipGear(Target.LS_TargetSlot, Target.LS_SlotID, this.SlotContents!)) Target.LS_ReloadAllSlots();
			}
		} else {
			if (IsLoadout) {
				// unequip
				if (Core().Client.Gear.TryEquipGear(this.LS_TargetSlot, this.LS_SlotID)) this.LS_ReloadAllSlots();
			}
		}
	}

	public LS_ReloadAllSlots() {
		for (const [Slot] of pairs(AllSlots)) {
			Slot.LS_FetchSlotContents();
		}
	}

	public LS_FetchSlotContents() {
		const Data = Core().Client.Data.GetLink().Data;

		const ID = Data.EquippedGear[this.LS_TargetSlot][this.LS_SlotID - 1];
		this.SlotContents = Core().Client.Gear.GetItem(ID);
		this.UpdateFilled();
	}
}
