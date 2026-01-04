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
	@NonSerialized() public ESCMenuOpen = false;

	@Header("Main")
	public Main: GameObject;

	@Header("References")
	public EquipmentMenu: GameObject;
	public Inventory: GameObject;
	public MomentumBar: RectTransform;

	public Connections = new Bin();

	@Client()
	override Start() {
		Airship.Menu.SetTabListEnabled(false);
		Airship.Menu.onMenuToggled.Connect((Open) => (this.ESCMenuOpen = Open));

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

	@Client()
	public CloseCenterMenus() {
		this.EquipmentMenu.SetActive(false);
		this.Inventory.SetActive(false);
	}

	@Client()
	public UpdateMenuState() {
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

	@Client()
	public UpdateMomentumBar(Momentum: number) {
		this.MomentumBar.SetSizeWithCurrentAnchors(Axis.Horizontal, 1340 * Momentum);
	}

	public WallrunLeftAmmoContainer: RectTransform;
	public WallrunRightAmmoContainer: RectTransform;
	public WallclimbAmmoContainer: RectTransform;
	public AmmoTemplate: RectTransform;
	private AmmoFillUIs = {
		WallrunLeft: [] as Image[],
		WallrunRight: [] as Image[],
		Wallclimb: [] as Image[],
	};

	private AddAmmoElements(Count: number, Container: RectTransform, Fills: Image[]) {
		for (const _ of $range(1, Count)) {
			const UI = Instantiate(this.AmmoTemplate);
			UI.SetParent(Container);
			UI.localRotation = Quaternion.identity;
			Fills.push(UI.gameObject.GetComponent<Image>()!);
		}
	}

	@Client()
	public UpdateAmmoCount(Ammo: { Wallrun: number; Wallclimb: number }) {
		for (const [_, List] of pairs(this.AmmoFillUIs)) {
			List.forEach((Target) => {
				Destroy(Target.gameObject);
			});
			List.clear();
		}

		this.AddAmmoElements(Ammo.Wallclimb, this.WallclimbAmmoContainer, this.AmmoFillUIs.Wallclimb);
		this.AddAmmoElements(Ammo.Wallrun, this.WallrunLeftAmmoContainer, this.AmmoFillUIs.WallrunLeft);
		this.AddAmmoElements(Ammo.Wallrun, this.WallrunRightAmmoContainer, this.AmmoFillUIs.WallrunRight);

		this.UpdateAmmoFill(Ammo);
	}

	private UpdateAmmoElements(UIs: Image[], MaxAmmo: number) {
		for (const [Index, Image] of pairs(UIs)) {
			Image.color = UIs.size() - Index < MaxAmmo ? new Color(0.5, 0.5, 0.5, MaxAmmo === UIs.size() ? 0 : 0.5) : new Color(1, 1, 1, 1);
		}
	}

	@Client()
	public UpdateAmmoFill(Ammo: { Wallrun: number; Wallclimb: number }) {
		this.UpdateAmmoElements(this.AmmoFillUIs.Wallclimb, Ammo.Wallclimb);
		this.UpdateAmmoElements(this.AmmoFillUIs.WallrunLeft, Ammo.Wallrun);
		this.UpdateAmmoElements(this.AmmoFillUIs.WallrunRight, Ammo.Wallrun);
	}
}
