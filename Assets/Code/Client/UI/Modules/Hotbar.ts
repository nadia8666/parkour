import { Asset } from "@Easy/Core/Shared/Asset";
import { Mouse } from "@Easy/Core/Shared/UserInput";
import Core from "Code/Core/Core";
import { Provider } from "Code/Shared/Provider";
import type { AnyItem } from "Code/Shared/Types";
import type SlotComponent from "../Drag/SlotComponent";

export class Hotbar {
	constructor(
		public Hotbar: RectTransform,
		public SlotTemplate: GameObject,
	) {
		let LastScrolled = os.clock();
		Mouse.onScrolled.Connect((Event) => {
			if (!Application.isFocused || Core().Client.UI.AreMenusOpen()) return;
			if (os.clock() - LastScrolled <= 0.001) return;
			LastScrolled = os.clock();

			this.SelectedSlot = this.SelectedSlot - math.sign(Event.delta);
			if (this.SelectedSlot > this.Inventory.Get().Size) {
				this.SelectedSlot -= this.Inventory.Get().Size;
			}
			if (this.SelectedSlot < 1) {
				this.SelectedSlot += this.Inventory.Get().Size;
			}
			this.UpdateSelected();
		});

		task.spawn(() => {
			Core()
				.Client.Data.GetLink()
				.GetChanged("Inventories/Hotbar/*")
				.Connect(() => this.RefreshContents());
		});
	}

	public Inventory = new Provider(() => Core().Client.Data.GetLink().Data.Inventories.Hotbar);
	public Contents: GameObject[] = [];
	public SelectedSlot = 1;
	public HeldItem?: AnyItem;

	public UpdateSelected() {
		this.HeldItem = undefined;
		this.Contents.forEach((Instance, Index) => {
			const Selected = Index + 1 === this.SelectedSlot;
			const Image = Instance.GetComponent<RawImage>()!;
			Image.texture = Asset.LoadAsset(`Assets/Resources/Textures/UI/HotbarSlot${Selected ? "Selected" : ""}.png`);
			Instance.transform.localScale = Selected ? Vector3.one.mul(1.2) : Vector3.one;

			if (Selected) this.HeldItem = Instance.GetAirshipComponent<SlotComponent>()?.SlotContents;
		});
	}

	public RefreshContents() {
		while (!this.Inventory) task.wait();

		this.Contents.forEach((Target) => Destroy(Target));
		this.Contents.clear();

		for (const Index of $range(1, this.Inventory.Get().Size)) {
			const Slot = Instantiate(this.SlotTemplate);
			Slot.transform.SetParent(this.Hotbar, false);
			this.Contents.push(Slot);

			const Drag = Slot.GetAirshipComponent<SlotComponent>()!;
			Drag.PlayerInventory = "Hotbar";
			Drag.SlotID = Index;
			Drag.UpdateContents();
		}

		this.UpdateSelected();
	}
}
