import { Airship } from "@Easy/Core/Shared/Airship";
import { Asset } from "@Easy/Core/Shared/Asset";
import { Binding } from "@Easy/Core/Shared/Input/Binding";
import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import Core from "Code/Core/Core";
import type RecipeObject from "Code/Shared/Object/RecipeObject";
import { type AnyItem, ItemTypes } from "Code/Shared/Types";
import TooltipComponent from "../Components/TooltipComponent";
import type ClientComponent from "../Controller/ClientComponent";
import type SlotComponent from "./Drag/SlotComponent";
import { CallbackType } from "./Drag/SlotComponent";
import { ContainerInventory } from "./Modules/ContainerInventory";
import { Hotbar } from "./Modules/Hotbar";

export enum UIMenus {
	Inventory,
	ContainerInventory,
}

export default class UIController extends AirshipSingleton {
	@NonSerialized() public ESCMenuOpen = false;

	@Header("Main")
	public Main: GameObject;
	public UICamera: Camera;

	@Header("References")
	public Loading: GameObject;
	public TooltipTransform: RectTransform;
	public TooltipText: TMP_Text;

	@Header("References/Inventory")
	public Inventory: GameObject;
	public InventoryContainer: GameObject;
	public InventorySlots: SlotComponent[] = [];
	@NonSerialized() public InventoryTab = "PlayerInventories";
	public PlayerInventoriesTabButton: Button;
	public CraftingTabButton: Button;
	public PlayerInventoriesTab: GameObject;
	public CraftingTab: GameObject;

	@Header("References/Hotbar")
	@SerializeField()
	private HotbarRef: RectTransform;
	@SerializeField() private HotbarSlot: GameObject;

	@Header("References/Block UIs")
	public ContainerInventoryRef: RectTransform;

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
	public ContainerInventory: ContainerInventory;

	@Header("References/Crafting")
	public CraftingContainer: RectTransform;

	@Client()
	override Start() {
		this.Hotbar = new Hotbar(this.HotbarRef, this.HotbarSlot);
		this.ContainerInventory = new ContainerInventory(this.ContainerInventoryRef, this.HotbarSlot);
		this.Loading.SetActive(true);

		Airship.Menu.SetTabListEnabled(false);
		Airship.Menu.onMenuToggled.Connect((Open) => (this.ESCMenuOpen = Open));

		Airship.Input.CreateAction("Menu", Binding.Key(Key.Tab));

		Airship.Input.OnDown("Menu").Connect(() => {
			if (this.AreMenusOpen()) {
				this.CloseMenus();
			} else {
				this.OpenMenu(UIMenus.Inventory);
			}
		});

		this.CloseMenus();

		task.spawn(() => {
			this.RefreshContents();
			Core()
				.Client.Data.GetLink()
				.GetChanged("Inventories/Player/*")
				.Connect(() => this.RefreshContents());

			this.InventorySlots.forEach((Slot) => Slot.UpdateContents());
		});

		this.Main.SetActive(true);

		// TODO: dont hardcode
		const Buttons = [this.CraftingTabButton, this.PlayerInventoriesTabButton];
		const Frames = [this.CraftingTab, this.PlayerInventoriesTab];

		function FocusUI(Button: Button, ContainerFrame: GameObject) {
			Buttons.forEach((Button) => (Button.targetGraphic.color = Color.white));
			Frames.forEach((Frame) => Frame.SetActive(false));
			Button.targetGraphic.color = new Color(0.96, 0.97, 0.54);
			ContainerFrame.SetActive(true);
		}

		this.CraftingTabButton.onClick.Connect(() => FocusUI(this.CraftingTabButton, this.CraftingTab));
		this.PlayerInventoriesTabButton.onClick.Connect(() => FocusUI(this.PlayerInventoriesTabButton, this.PlayerInventoriesTab));
		FocusUI(this.PlayerInventoriesTabButton, this.PlayerInventoriesTab);

		// TODO: refactor
		const Recipes = Asset.LoadAll("Assets/Resources/Recipes", true) as RecipeObject[];
		Recipes.forEach((Recipe) => {
			const ItemSlot = Instantiate(this.Hotbar.SlotTemplate);
			this.Contents.push(ItemSlot);
			ItemSlot.transform.SetParent(this.CraftingContainer.transform, false);

			const Slot = ItemSlot.GetAirshipComponent<SlotComponent>()!;
			Slot.CallbackType = CallbackType.Crafting;
			Slot.Draggable = false;
			Slot.SlotContents = Recipe.ItemFromString(Recipe.OutputItem);
			Slot.UpdateContents();
			print(Slot.SlotContents);
		});
	}

	private Contents: GameObject[] = [];
	public RefreshContents() {
		this.Contents.mapFiltered((Target) => Destroy(Target));
		this.Contents.clear();

		this.Hotbar.RefreshContents();

		const SortedList: { [Index: string]: [Transform, AnyItem][] } = {};

		const Inventory = Core().Client.Data.GetLink().Data.Inventories.Player;
		for (const Index of $range(1, Inventory.Size)) {
			const Value = Inventory.Content[Index];
			const ItemSlot = Instantiate(this.Hotbar.SlotTemplate);
			this.Contents.push(ItemSlot);
			ItemSlot.transform.SetParent(this.InventoryContainer.transform, false);

			const Slot = ItemSlot.GetAirshipComponent<SlotComponent>()!;
			Slot.PlayerInventory = "Player";
			Slot.SlotID = Index;
			Slot.UpdateContents();

			if (!Value) continue;
			if (Value.Type === ItemTypes.Gear) {
				let Existing = SortedList[Value.Key];
				if (!Existing) {
					Existing = [];
					SortedList[Value.Key] = Existing;
				}

				if (Value.Level) {
					Existing[Value.Level - 1] = [ItemSlot.transform, Value];
				} else {
					Existing.push([ItemSlot.transform, Value]);
					Existing.sort((a, b) => {
						return a[1].ObtainedTime > b[1].ObtainedTime;
					});
				}
			}
		}
	}

	public RaycastUI(): GameObject | undefined {
		const System = EventSystem.current;
		const EventData = new PointerEventData(System);
		EventData.position = Mouse.position;

		return System.RaycastAll(EventData)[0]?.gameObject;
	}

	public CloseMenus() {
		this.Inventory.SetActive(false);
		this.ContainerInventory.SetActive(false);

		this.Connections.Clean();

		this.TooltipTransform.gameObject.SetActive(false);
	}

	public OpenMenu(Target: UIMenus) {
		this.CloseMenus();

		switch (Target) {
			case UIMenus.ContainerInventory:
				this.ContainerInventory.SetActive(true);
				break;

			case UIMenus.Inventory:
				this.Inventory.SetActive(true);
				break;
		}

		Mouse.WarpCursorPosition(new Vector2(Camera.main.pixelWidth, Camera.main.pixelHeight).div(2));
		this.Connections.Add(Mouse.AddUnlocker());
	}

	@NonSerialized() public LastTooltipObject: GameObject | undefined;
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

	public AreMenusOpen() {
		return this.ESCMenuOpen || this.Inventory.activeSelf || this.ContainerInventory.Container.gameObject.activeSelf;
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
