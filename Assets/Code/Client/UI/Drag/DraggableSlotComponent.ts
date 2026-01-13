import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import Core from "Code/Core/Core";
import type { AnyItem, GearSlots } from "Code/Shared/Types";

export enum CallbackType {
	Loadout,
	Inventory,
}

export default class DraggableSlotComponent extends AirshipBehaviour {
	private Connections = new Bin();

	@Header("References")
	public Text: TMP_Text;

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

	// InventorySlot

	@NonSerialized() public SlotContents: AnyItem | undefined;

	@Client()
	override OnEnable() {
		this.Connections.Add(
			Mouse.onLeftDown.Connect(() => {
				if (this.IsDraggable()) return;

				if (Core().Client.Drag.RaycastUI() === this.gameObject) this.DragStart();
			}),
		);

		if (this.CallbackType === CallbackType.Loadout) this.LS_FetchSlotContents();
	}

	@Client()
	override OnDisable() {
		this.Connections.Clean();
	}

	public IsDraggable() {
		return !this.Draggable || !this.SlotContents;
	}

	public DragStart() {
		Core().Client.Drag.StartDrag(this);
	}

	public UpdateFilled() {
		if (this.SlotContents) {
			this.Text.text = Core().Client.Gear.GetName(this.SlotContents);
		} else {
			this.Text.text = "";
		}
	}

	public DraggedOnto(Target?: DraggableSlotComponent) {
		const IsLoadout = this.CallbackType === CallbackType.Loadout;
		if (Target) {
			const TargetIsLoadout = Target.CallbackType === CallbackType.Loadout;

			if (TargetIsLoadout) {
				// biome-ignore lint/style/noNonNullAssertion: cannot drag unfilled slots
				if (Core().Client.Gear.TryEquipGear(Target.LS_TargetSlot, Target.LS_SlotID, this.SlotContents!)) Target.LS_FetchSlotContents();
			}
		} else {
			if (IsLoadout) {
				// unequip
				if (Core().Client.Gear.TryEquipGear(this.LS_TargetSlot, this.LS_SlotID)) this.LS_FetchSlotContents();
			}
		}
	}

	public LS_FetchSlotContents() {
		const Data = Core().Client.Data.GetLink().Data;

		const ID = Data.EquippedGear[this.LS_TargetSlot][this.LS_SlotID - 1];
		this.SlotContents = Core().Client.Gear.GetItem(ID);
		this.UpdateFilled();
	}
}
