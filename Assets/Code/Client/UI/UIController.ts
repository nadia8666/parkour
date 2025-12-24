import { Airship } from "@Easy/Core/Shared/Airship";
import { Asset } from "@Easy/Core/Shared/Asset";
import { Binding } from "@Easy/Core/Shared/Input/Binding";
import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import GearRegistrySingleton from "Code/Shared/GearRegistry";
import GearObject from "Code/Shared/Object/GearObject";
import type DraggableSlotComponent from "./Drag/DraggableSlotComponent";

export default class UIController extends AirshipSingleton {
	@NonSerialized() public MenuOpen = false;

	@Header("Main")
	public Main: GameObject;

	@Header("References")
	public EquipmentMenu: GameObject;
	public Inventory: GameObject;

	public Connections = new Bin();

	override Start() {
		Airship.Menu.SetTabListEnabled(false);

		Airship.Input.CreateAction("Menu", Binding.Key(Key.Tab));

		Airship.Input.OnDown("Menu").Connect(() => {
			this.MenuOpen = !this.MenuOpen;

			this.UpdateMenuState();
		});

		this.UpdateMenuState();

		// TEMP
		for (const [_, Gear] of pairs(GearRegistrySingleton.Get())) {
			if (Gear instanceof GearObject) {
				const GearSlot = Instantiate(Asset.LoadAsset("Assets/Resources/UI/ItemSlot.prefab"));
				GearSlot.transform.SetParent(this.Inventory.transform);
				(GearSlot.transform as RectTransform).localScale = Vector3.one;

				const Slot = GearSlot.GetAirshipComponent<DraggableSlotComponent>();
				if (!Slot) continue;
				Slot.SlotContents = Gear;
				Slot.UpdateFilled();
			}
		}
	}

	public CloseCenterMenus() {
		this.EquipmentMenu.SetActive(false);
		this.Inventory.SetActive(false);
	}

	public UpdateMenuState() {
		this.Main.SetActive(this.MenuOpen); // TEMP

		if (this.MenuOpen) {
			Mouse.WarpCursorPosition(new Vector2(Camera.main.pixelWidth, Camera.main.pixelHeight).div(2));

			// TEMP
			this.EquipmentMenu.SetActive(true);
			this.Inventory.SetActive(true);

			this.Connections.Add(Mouse.AddUnlocker());
		} else {
			this.Connections.Clean();
			this.CloseCenterMenus();
		}
	}
}
