import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import GearController from "Code/Client/Controller/Gear/GearController";
import DataController from "Code/Client/Framework/DataController";
import GearRegistrySingleton from "Code/Shared/GearRegistry";
import type GearObject from "Code/Shared/Object/GearObject";
import type { GearSlots } from "Code/Shared/Types";
import DragController from "./DragController";

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

	@NonSerialized() public SlotContents: GearObject | undefined;

	@Client()
	override OnEnable() {
		this.Connections.Add(
			Mouse.onLeftDown.Connect(() => {
				if (this.IsDraggable()) return;

				if (DragController.Get().RaycastUI() === this.gameObject) this.DragStart();
			}),
		);

		if (this.CallbackType === CallbackType.Loadout) this.LS_FetchSlotContents();
	}

	@Client()
	override OnDisable() {
		this.Connections.Clean();
	}

	@Client()
	public IsDraggable() {
		return !this.Draggable || !this.SlotContents;
	}

	@Client()
	public DragStart() {
		DragController.Get().StartDrag(this);
	}

	@Client()
	public UpdateFilled() {
		if (this.SlotContents) {
			this.Text.text = this.SlotContents.Name;
		} else {
			this.Text.text = "";
		}
	}

	@Client()
	public DraggedOnto(Target?: DraggableSlotComponent) {
		const IsLoadout = this.CallbackType === CallbackType.Loadout;
		if (Target) {
			const TargetIsLoadout = Target.CallbackType === CallbackType.Loadout;

			if (TargetIsLoadout) {
				// biome-ignore lint/style/noNonNullAssertion: cannot drag unfilled slots
				if (GearController.Get().TryEquipGear(Target.LS_TargetSlot, Target.LS_SlotID, this.SlotContents!)) Target.LS_FetchSlotContents();
			}
		} else {
			if (IsLoadout) {
				// unequip
				if (GearController.Get().TryEquipGear(this.LS_TargetSlot, this.LS_SlotID, GearRegistrySingleton.Get().None)) this.LS_FetchSlotContents();
			}
		}
	}

	@Client()
	public LS_FetchSlotContents() {
		const Data = DataController.Get().Link.Data;

		this.SlotContents = GearRegistrySingleton.Get().GearFromKey(Data.EquippedGear[this.LS_TargetSlot][this.LS_SlotID - 1]);
		this.UpdateFilled();
	}
}
