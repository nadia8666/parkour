import { Airship } from "@Easy/Core/Shared/Airship";
import { Asset } from "@Easy/Core/Shared/Asset";
import { Binding } from "@Easy/Core/Shared/Input/Binding";
import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import Core from "Code/Core/Core";
import type { AnyItem } from "Code/Shared/Types";
import type TooltipComponent from "../Components/TooltipComponent";
import type ClientComponent from "../Controller/ClientComponent";
import type DraggableSlotComponent from "./Drag/DraggableSlotComponent";

export default class UIController extends AirshipSingleton {
	@NonSerialized() public MenuOpen = false;
	@NonSerialized() public ESCMenuOpen = false;

	@Header("Main")
	public Main: GameObject;

	@Header("References")
	public EquipmentMenu: GameObject;
	public Inventory: GameObject;
	public Loading: GameObject;
	public TooltipTransform: RectTransform;
	public TooltipText: TMP_Text;
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

	@Client()
	override Start() {
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
		this.Contents.mapFiltered((Target) => {
			Destroy(Target);
		});

		const SortedList: { [Index: string]: [Transform, AnyItem][] } = {};

		for (const [_Index, Value] of pairs(Core().Client.Data.GetLink().Data.Inventory)) {
			if (Value.Type === "Gear") {
				const GearSlot = Instantiate(Asset.LoadAsset("Assets/Resources/UI/ItemSlot.prefab"));
				this.Contents.push(GearSlot);
				GearSlot.transform.SetParent(this.Inventory.transform);
				(GearSlot.transform as RectTransform).localScale = Vector3.one;

				const Slot = GearSlot.GetAirshipComponent<DraggableSlotComponent>();
				if (!Slot) continue;
				Slot.SlotContents = Value;
				Slot.UpdateFilled();

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
		this.EquipmentMenu.SetActive(false);
		this.Inventory.SetActive(false);
	}

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

	private LastTooltipObject: GameObject | undefined;
	private HealthAlpha = 1;
	public UpdateUI(Controller: ClientComponent, DeltaTime: number) {
		this.HealthAlpha = math.lerpClamped(this.HealthAlpha, math.clamp01(Controller.Health / 100), DeltaTime * 10);

		//this.MomentumBar.SetSizeWithCurrentAnchors(Axis.Horizontal, 1340 * math.clamp01(Controller.Momentum / 30));
		this.HealthBar.SetSizeWithCurrentAnchors(Axis.Horizontal, 885 * this.HealthAlpha);

		//this.MomentumCanvas.alpha = math.lerpClamped(this.MomentumCanvas.alpha, Controller.Momentum <= 0 ? 0 : 1, DeltaTime * 5);
		this.HealthCanvas.alpha = math.lerpClamped(this.HealthCanvas.alpha, Controller.Health < 99 ? 1 : os.clock() - Controller._LastHealthChanged >= 2.5 ? 0 : 1, DeltaTime * 5);
		this.WallKickCanvas.alpha = 1 - this.HealthCanvas.alpha;

		const HoverTarget = this.RaycastUI();

		if (HoverTarget !== this.LastTooltipObject) {
			const TooltipComponent = HoverTarget?.GetAirshipComponent<TooltipComponent>();

			if (TooltipComponent) {
				this.TooltipTransform.gameObject.SetActive(true);
				this.TooltipText.text = TooltipComponent.GetText();
			} else this.TooltipTransform.gameObject.SetActive(false);
			this.LastTooltipObject = HoverTarget;
		}

		if (this.TooltipTransform.gameObject.activeSelf) {
			const MousePos = Input.mousePosition.sub(new Vector3(-20, 0, 0));
			this.TooltipTransform.position = MousePos;

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
			UI.SetParent(Container);
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
}
