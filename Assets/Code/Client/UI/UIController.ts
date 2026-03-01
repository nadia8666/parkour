import { Airship } from "@Easy/Core/Shared/Airship";
import { Asset } from "@Easy/Core/Shared/Asset";
import { Binding } from "@Easy/Core/Shared/Input/Binding";
import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import Core from "Code/Core/Core";
import { type AnyItem, type Inventory, ItemTypes } from "Code/Shared/Types";
import TooltipComponent from "../Components/TooltipComponent";
import type ClientComponent from "../Controller/ClientComponent";
import type DraggableSlotComponent from "./Drag/DraggableSlotComponent";

class Hotbar {
	constructor(
		public Hotbar: RectTransform,
		public HotbarSlot: GameObject,
	) {
		task.spawn(() => (this.Inventory = Core().Client.Data.GetLink().Data.Inventories.Hotbar));

		let LastScrolled = os.clock();
		Mouse.onScrolled.Connect((Event) => {
			if (os.clock() - LastScrolled <= 0.001) return;
			LastScrolled = os.clock();

			this.SelectedSlot = this.SelectedSlot - math.sign(Event.delta);
			if (this.SelectedSlot > this.Inventory.Size) {
				this.SelectedSlot -= this.Inventory.Size;
			}
			if (this.SelectedSlot < 1) {
				this.SelectedSlot += this.Inventory.Size;
			}
			this.UpdateSelected();
		});
	}

	public Inventory: Inventory;
	private HotbarContents: GameObject[] = [];
	public SelectedSlot = 1;

	public UpdateSelected() {
		this.HotbarContents.forEach((Instance, Index) => {
			const Image = Instance.GetComponent<RawImage>()!;
			Image.texture = Asset.LoadAsset(`Assets/Resources/Textures/UI/HotbarSlot${Index + 1 === this.SelectedSlot ? "Selected" : ""}.png`);
			Instance.transform.localScale = Index + 1 === this.SelectedSlot ? Vector3.one.mul(1.2) : Vector3.one;
		});
	}

	public RefreshContents() {
		while (!this.Inventory) task.wait();

		this.HotbarContents.forEach((Target) => Destroy(Target));
		this.HotbarContents.clear();

		for (const Index of $range(1, this.Inventory.Size)) {
			const Slot = Instantiate(this.HotbarSlot);
			Slot.transform.SetParent(this.Hotbar, false);
			this.HotbarContents.push(Slot);

			const Components = Slot.GetAirshipComponent<DraggableSlotComponent>()!;
			Components.IS_Inventory = "Hotbar";
			Components.IS_SlotID = Index;

			const Content = this.Inventory.Content[Index];
			if (Content) {
				Components.SlotContents = Content;
				Components.UpdateContents();
			}
		}

		this.UpdateSelected();
	}
}

export default class UIController extends AirshipSingleton {
	@NonSerialized() public MenuOpen = false;
	@NonSerialized() public ESCMenuOpen = false;

	@Header("Main")
	public Main: GameObject;
	public UICamera: Camera;

	@Header("References")
	public Inventory: GameObject;
	public Inventory_TEMP: GameObject;
	public Loading: GameObject;
	public TooltipTransform: RectTransform;
	public TooltipText: TMP_Text;
	@Header("References/Hotbar")
	@SerializeField()
	private HotbarRef: RectTransform;
	@SerializeField() private HotbarSlot: GameObject;
	@Header("References/Momentum")
	public MomentumBar: RectTransform;
	public MomentumCanvas: CanvasGroup;
	@Header("References/Health")
	public HealthBar: RectTransform;
	public HealthCanvas: CanvasGroup;
	@Header("References/Time Trials")
	public TT_Container: RectTransform;
	public TT_Time: TMP_Text;
	public TT_Medal: Image;

	public Connections = new Bin();
	public Hotbar: Hotbar;

	@Client()
	override Start() {
		this.Hotbar = new Hotbar(this.HotbarRef, this.HotbarSlot);
		this.Loading.SetActive(true);

		Airship.Menu.SetTabListEnabled(false);
		Airship.Menu.onMenuToggled.Connect((Open) => (this.ESCMenuOpen = Open));

		Airship.Input.CreateAction("Menu", Binding.Key(Key.Tab));

		Airship.Input.OnDown("Menu").Connect(() => {
			this.MenuOpen = !this.MenuOpen;

			this.UpdateMenuState();
		});

		this.UpdateMenuState();

		task.spawn(() => {
			this.RefreshContents();
			Core()
				.Client.Data.GetLink()
				.AnyChanged.Connect(() => this.RefreshContents());
		});

		this.Main.SetActive(true);
	}

	private Contents: GameObject[] = [];
	public RefreshContents() {
		this.Contents.mapFiltered((Target) => Destroy(Target));
		this.Contents.clear();

		this.Hotbar.RefreshContents();

		const SortedList: { [Index: string]: [Transform, AnyItem][] } = {};

		// TODO: replace with Player inv
		for (const [Index, Value] of pairs(Core().Client.Data.GetLink().Data.Inventories.Debug.Content)) {
			if (Value.Type === ItemTypes.Gear) {
				const GearSlot = Instantiate(this.Hotbar.HotbarSlot);
				this.Contents.push(GearSlot);
				GearSlot.transform.SetParent(this.Inventory_TEMP.transform, false);

				const Slot = GearSlot.GetAirshipComponent<DraggableSlotComponent>()!;
				Slot.IS_Inventory = "Debug";
				Slot.IS_SlotID = Index;
				Slot.SlotContents = Value;
				Slot.UpdateContents();

				let Existing = SortedList[Value.Key];
				if (!Existing) {
					Existing = [];
					SortedList[Value.Key] = Existing;
				}

				if (Value.Level) {
					Existing[Value.Level - 1] = [GearSlot.transform, Value];
				} else {
					Existing.push([GearSlot.transform, Value]);
					Existing.sort((a, b) => {
						return a[1].ObtainedTime > b[1].ObtainedTime;
					});
				}
			}
		}

		let Index = 0;
		for (const [_, Items] of pairs(SortedList)) {
			for (const [_, Item] of pairs(Items)) {
				Item[0].SetSiblingIndex(Index);
				Index++;
			}
		}
	}

	public RaycastUI(): GameObject | undefined {
		const System = EventSystem.current;
		const EventData = new PointerEventData(System);
		EventData.position = Mouse.position;

		return System.RaycastAll(EventData)[0]?.gameObject;
	}

	public CloseCenterMenus() {
		this.Inventory.SetActive(false);
	}

	public UpdateMenuState() {
		if (this.MenuOpen) {
			Mouse.WarpCursorPosition(new Vector2(Camera.main.pixelWidth, Camera.main.pixelHeight).div(2));

			// TEMP
			this.Inventory.SetActive(true);

			this.Connections.Add(Mouse.AddUnlocker());
		} else {
			this.Connections.Clean();
			this.CloseCenterMenus();
		}
	}

	private LastTooltipObject: GameObject | undefined;
	private HealthAlpha = 1;
	public UpdateUI(Controller: ClientComponent, DeltaTime: number) {
		this.HealthAlpha = math.lerpClamped(this.HealthAlpha, math.clamp01(Controller.Health / 100), DeltaTime * 10);
		this.HealthBar.SetSizeWithCurrentAnchors(Axis.Horizontal, 885 * this.HealthAlpha);

		this.HealthCanvas.alpha = math.lerpClamped(this.HealthCanvas.alpha, Controller.Health < 99 ? 1 : os.clock() - Controller._LastHealthChanged >= 2.5 ? 0 : 1, DeltaTime * 5);
		this.WallKickCanvas.alpha = 1 - this.HealthCanvas.alpha;

		const HoverTarget = this.RaycastUI();

		if (HoverTarget !== this.LastTooltipObject) {
			this.LastTooltipObject = HoverTarget;

			const Target = TooltipComponent.Get(HoverTarget);

			if (Target) {
				this.TooltipTransform.gameObject.SetActive(true);
				this.TooltipText.text = Target.GetText();
			} else this.TooltipTransform.gameObject.SetActive(false);
		}

		if (this.TooltipTransform.gameObject.activeSelf) {
			const MousePos = Input.mousePosition;
			this.TooltipTransform.localPosition = this.GetMouseLocalPosition(this.TooltipTransform.parent as RectTransform, MousePos)
				.WithZ(-99)
				.add(new Vector3(20, 0, 0));

			const Width = Screen.width;
			const Height = Screen.height;
			const ClipsHeight = MousePos.y + this.TooltipTransform.rect.height >= Height;

			const RemainingSize = Width - MousePos.x;
			this.TooltipTransform.rect.width = RemainingSize;

			this.TooltipTransform.pivot = new Vector2(0, ClipsHeight ? 1 : 0);

			LayoutRebuilder.ForceRebuildLayoutImmediate(this.TooltipTransform);
		}
	}

	@Header("References/Wallrun")
	public WallrunLeftAmmoContainer: RectTransform;
	public WallrunRightAmmoContainer: RectTransform;

	@Header("References/Wallclimb")
	public WallclimbAmmoContainer: RectTransform;

	@Header("References/WallKick")
	public WallKickAmmoContainer: RectTransform;
	public WallKickCanvas: CanvasGroup;

	@Header("References/Ammo")
	public AmmoTemplate: RectTransform;
	private AmmoFillUIs = {
		WallrunLeft: [] as Image[],
		WallrunRight: [] as Image[],
		Wallclimb: [] as Image[],
		WallKick: [] as Image[],
	};

	private AddAmmoElements(Count: number, Container: RectTransform, Fills: Image[]) {
		for (const _ of $range(1, Count)) {
			const UI = Instantiate(this.AmmoTemplate);
			UI.SetParent(Container, false);
			UI.localRotation = Quaternion.identity;
			Fills.push(UI.gameObject.GetComponent<Image>() as Image);
		}
	}

	public UpdateAmmoCount(Ammo: { Wallrun: number; Wallclimb: number; WallKick: number }) {
		for (const [_, List] of pairs(this.AmmoFillUIs)) {
			List.forEach((Target) => {
				Destroy(Target.gameObject);
			});
			List.clear();
		}

		this.AddAmmoElements(Ammo.Wallclimb, this.WallclimbAmmoContainer, this.AmmoFillUIs.Wallclimb);
		this.AddAmmoElements(Ammo.WallKick, this.WallKickAmmoContainer, this.AmmoFillUIs.WallKick);
		this.AddAmmoElements(Ammo.Wallrun, this.WallrunLeftAmmoContainer, this.AmmoFillUIs.WallrunLeft);
		this.AddAmmoElements(Ammo.Wallrun, this.WallrunRightAmmoContainer, this.AmmoFillUIs.WallrunRight);

		this.UpdateAmmoFill(Ammo);
	}

	private UpdateAmmoElements(UIs: Image[], MaxAmmo: number) {
		for (const [Index, Image] of pairs(UIs)) {
			Image.color = UIs.size() - Index < MaxAmmo ? new Color(0.5, 0.5, 0.5, MaxAmmo === UIs.size() ? 0 : 0.5) : new Color(1, 1, 1, 1);
		}
	}

	public UpdateAmmoFill(Ammo: { Wallrun: number; Wallclimb: number; WallKick: number }) {
		this.UpdateAmmoElements(this.AmmoFillUIs.Wallclimb, Ammo.Wallclimb);
		this.UpdateAmmoElements(this.AmmoFillUIs.WallKick, Ammo.WallKick);
		this.UpdateAmmoElements(this.AmmoFillUIs.WallrunLeft, Ammo.Wallrun);
		this.UpdateAmmoElements(this.AmmoFillUIs.WallrunRight, Ammo.Wallrun);
	}

	public InputDisabledFromMenu() {
		return /*this.MenuOpen || */ this.ESCMenuOpen || Airship.Chat.IsOpen();
	}

	public GetMouseLocalPosition(ParentRect: RectTransform, ScreenPos: Vector2 | Vector3) {
		const [success, localPos] = RectTransformUtility.ScreenPointToLocalPointInRectangle(
			ParentRect,
			typeIs(ScreenPos, "Vector2") ? ScreenPos : new Vector2(ScreenPos.x, ScreenPos.y),
			this.UICamera,
		);

		return success ? new Vector3(localPos.x, localPos.y, 0) : Vector3.zero;
	}
}
