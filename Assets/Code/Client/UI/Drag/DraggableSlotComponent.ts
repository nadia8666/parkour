import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import type { CallbackBaseObject } from "Code/Shared/Object/Callbacks/CallbackBase";
import type GearObject from "Code/Shared/Object/GearObject";
import DragController from "./DragController";

export default class DraggableSlotComponent extends AirshipBehaviour {
	private Connections = new Bin();
	public Callback: CallbackBaseObject;
	public Text: TMP_Text;
	public Draggable = true;

	@NonSerialized() public SlotContents: GearObject | undefined;

	override OnEnable() {
		this.Connections.Add(
			Mouse.onLeftDown.Connect(() => {
				if (!this.Draggable || !this.SlotContents) return;

				if (DragController.Get().RaycastUI() === this.gameObject) this.DragStart();
			}),
		);
	}

	override OnDisable() {
		this.Connections.Clean();
	}

	public DragStart() {
		DragController.Get().StartDrag(this);
	}

	public UpdateFilled() {
		if (this.SlotContents) {
			this.Text.text = this.SlotContents.Name;
		} else {
			this.Text.text = "";
		}
	}
}
