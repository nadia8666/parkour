import { Asset } from "@Easy/Core/Shared/Asset";
import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import type TooltipComponent from "Code/Client/Components/TooltipComponent";
import Core from "Code/Core/Core";
import { type AnyItem, type Inventory, type ItemInfo, ItemTypes } from "Code/Shared/Types";

export enum CallbackType {
	Loadout,
	Inventory,
	ContainerInventory,
	None,
}

const AllSlots = new Set<DraggableSlotComponent>();

export default class DraggableSlotComponent extends AirshipBehaviour {
	private Connections = new Bin();

	@Header("References")

	@Header("Config")
	@SerializeField()
	private Draggable = true;
	public CallbackType: CallbackType = CallbackType.None;
	@NonSerialized()
	public SlotContents: AnyItem | undefined;
	public Tooltip: TooltipComponent | undefined;

	// Inventory Slot
	@ShowIf("CallbackType", CallbackType.Inventory, CallbackType.Loadout)
	@Header("Inventory Slot Config")
	@ShowIf("CallbackType", CallbackType.Inventory, CallbackType.Loadout)
	public PlayerInventory: string;
	@ShowIf("CallbackType", CallbackType.Inventory, CallbackType.Loadout)
	public SlotID: number;

	// Container Inventory Slot
	@ShowIf("CallbackType", CallbackType.ContainerInventory)
	@Header("Inventory Slot Config")
	@NonSerialized()
	@ShowIf("CallbackType", CallbackType.ContainerInventory)
	public CIS_Inventory: Inventory;

	@Client()
	override OnEnable() {
		this.Connections.Add(
			Mouse.onLeftDown.Connect(() => {
				if (this.IsDraggable()) return;

				if (Core().Client.UI.RaycastUI() === this.gameObject) this.DragStart();
			}),
		);

		if (this.CallbackType === CallbackType.Loadout) AllSlots.add(this);
	}

	@Client()
	override OnDisable() {
		this.Connections.Clean();

		AllSlots.delete(this);
	}

	public IsDraggable() {
		return !this.Draggable || !this.SlotContents;
	}

	public DragStart() {
		Core().Client.Drag.StartDrag(this);
	}

	public UpdateContents() {
		this.FetchContents();

		this.gameObject.ClearChildren();

		if (this.SlotContents) {
			let ItemMesh: Mesh | undefined;

			switch (this.SlotContents.Type) {
				case ItemTypes.Gear: {
					ItemMesh = Asset.LoadAsset(`Assets/Resources/Models/Item/None.asset`);
					break;
				}

				case ItemTypes.Item: {
					ItemMesh = Asset.LoadAssetIfExists(`Assets/Resources/Models/Item/${this.SlotContents.Key}.asset`) ?? Asset.LoadAsset(`Assets/Resources/Models/Item/None.asset`);
					break;
				}
			}

			if (ItemMesh) {
				const Item = GameObject.Create("ItemMesh");
				Item.transform.SetParent(this.transform, false);
				Item.transform.localPosition = new Vector3(0.363, 0.666, -10);
				Item.transform.localScale = new Vector3(74.75, 74.75, 74.75);

				const Filter = Item.AddComponent<MeshFilter>();
				Filter.mesh = Instantiate(ItemMesh);

				const Material: Material | undefined =
					Asset.LoadAssetIfExists(`Assets/Resources/Models/Item/Materials/${this.SlotContents.Key}.mat`) ?? Asset.LoadAsset(`Assets/Resources/Models/Item/Materials/None.mat`);
				const Renderer = Item.AddComponent<MeshRenderer>();
				if (Material) Renderer.SetMaterial(0, Material);

				Item.layer = LayerMask.NameToLayer("UI");
			}
		}

		if (!this.Tooltip) return;
		const IsGear = this.SlotContents?.Type === ItemTypes.Gear;
		if (this.SlotContents) {
			if (IsGear) {
				this.Tooltip.TooltipGear.GearTarget = Core().Gear[(this.SlotContents as ItemInfo<ItemTypes.Gear>).Key];
				this.Tooltip.TooltipGear.PerkLevel = this.SlotContents.Level ?? 1;
			} else {
				this.Tooltip.TooltipGear.GearTarget = undefined;
				this.Tooltip.TooltipString = `${Core().Client.Gear.GetName(this.SlotContents)}`;
			}
		} else {
			if (this.CallbackType === CallbackType.Loadout) {
				this.Tooltip.TooltipString = `Empty ${this.PlayerInventory} Slot`;
			} else {
				this.Tooltip.TooltipString = `Empty`;
			}

			this.Tooltip.TooltipGear.GearTarget = undefined;
		}

		const UI = Core().Client.UI;
		if (UI.LastTooltipObject === this.gameObject) UI.LastTooltipObject = undefined;
	}

	public DraggedOnto(Target?: DraggableSlotComponent) {
		if (Target) {
			const [TargetInventory, MyInventory] = [DraggableSlotComponent.GetInventoryFor(Target), this.GetInventory()];

			if (!(TargetInventory && MyInventory)) return;

			const [TargetContents, MyContents] = [TargetInventory.Content[Target.SlotID], MyInventory.Content[this.SlotID]];
			const TargetIsLoadout = Target.CallbackType === CallbackType.Loadout;
			const ContentAsGear = Core().Gear.GearFromKey(MyContents.Key);

			if (TargetIsLoadout) if (!ContentAsGear || Target.PlayerInventory !== ContentAsGear.Slot) return;
			
			TargetInventory.Content[Target.SlotID] = MyContents;
			MyInventory.Content[this.SlotID] = TargetContents;

			Target.UpdateContents();
			this.UpdateContents();
		} else {
			// TODO: drop item
		}
	}

	public static GetInventoryFor(Target: DraggableSlotComponent) {
		const Data = Core().Client.Data.GetLink().Data;
		switch (Target.CallbackType) {
			case CallbackType.Loadout:
				return Data.Inventories[Target.PlayerInventory];

			case CallbackType.Inventory:
				return Data.Inventories[Target.PlayerInventory];

			case CallbackType.ContainerInventory:
				return Target.CIS_Inventory;
		}
	}

	public GetInventory() {
		return DraggableSlotComponent.GetInventoryFor(this);
	}

	public static LS_ReloadAllSlots() {
		for (const [Slot] of pairs(AllSlots)) {
			Slot.FetchContents();
		}
	}

	public FetchContents() {
		this.SlotContents = this.GetInventory()?.Content[this.SlotID];
	}
}
