/** biome-ignore-all lint/style/noNonNullAssertion: abc */
import { Mouse } from "@Easy/Core/Shared/UserInput/Mouse";
import UIController from "../UIController";
import type DraggableSlotComponent from "./DraggableSlotComponent";

export default class DragController extends AirshipSingleton {
	@NonSerialized() public CurrentDrag: DraggableSlotComponent | undefined;
	@NonSerialized() public CurrentUI: RectTransform | undefined;

	public DragTemplate: GameObject;

	@Client()
	public StartDrag(Slot: DraggableSlotComponent) {
		if (this.CurrentDrag) return;

		this.CurrentDrag = Slot;

		const MainUI = UIController.Get().Main;
		const UI = Instantiate(this.DragTemplate);
		UI.transform.SetParent(MainUI.transform);

		(UI.transform as RectTransform).localScale = (Slot.transform as RectTransform).lossyScale.div((MainUI.transform as RectTransform).lossyScale);

		const NewSlot = UI.GetAirshipComponent<DraggableSlotComponent>()!;
		NewSlot.SlotContents = Slot.SlotContents;
		NewSlot.UpdateFilled();

		this.CurrentUI = UI.transform as RectTransform;
	}

	@Client()
	public RaycastUI(): GameObject | undefined {
		const System = EventSystem.current;
		const EventData = new PointerEventData(System);
		EventData.position = Mouse.position;

		return System.RaycastAll(EventData)[0]?.gameObject;
	}

	@Client()
	public EndDrag() {
		const DragOrigin = this.CurrentDrag;

		Destroy(this.CurrentUI!.gameObject);
		this.CurrentUI = undefined;
		this.CurrentDrag = undefined;

		const UITarget = this.RaycastUI();
		DragOrigin?.DraggedOnto(UITarget?.GetAirshipComponent<DraggableSlotComponent>());
	}

	@Client()
	override Update() {
		if (this.CurrentDrag) {
			if (Mouse.isLeftDown) {
				const Pos = Mouse.position;
				this.CurrentUI!.position = new Vector3(Pos.x, Pos.y, 0);
			} else {
				this.EndDrag();
			}
		}
	}
}
