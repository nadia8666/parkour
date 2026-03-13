import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import type TooltipComponent from "Code/Client/Components/TooltipComponent";
import Core from "Code/Core/Core";
import type InteractableBlockComponent from "Code/Shared/Components/InteractableBlockComponent";
import { Network } from "Code/Shared/Network";
import { type AnyItem, type Inventory, ItemTypes } from "Code/Shared/Types";
import { ModelBuilder } from "Code/Shared/Utility/ModelBuilder";

export enum CallbackType {
	Loadout,
	Inventory,
	ContainerInventory,
	Crafting,
	None,
}

export default class SlotComponent extends AirshipBehaviour {
	private Connections = new Bin();

	public static AllLoadoutSlots = new Set<SlotComponent>();
	public static AllSlots = new Map<GameObject, SlotComponent>();

	@Header("References")

	@Header("Config")
	public Draggable = true;
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

	// Misc
	public ClickCallback: (() => void) | undefined;

	@Client()
	override OnEnable() {
		this.Connections.Add(
			Mouse.onLeftDown.Connect(() => {
				if (Core().Client.UI.RaycastUI() === this.gameObject) this.DragStart();
			}),
		);

		if (this.CallbackType === CallbackType.Loadout) SlotComponent.AllLoadoutSlots.add(this);
		SlotComponent.AllSlots.set(this.gameObject, this);
	}

	@Client()
	override OnDisable() {
		this.Connections.Clean();

		SlotComponent.AllLoadoutSlots.delete(this);
		SlotComponent.AllSlots.delete(this.gameObject);
	}

	public IsDraggable() {
		return !this.Draggable || !this.SlotContents;
	}

	public DragStart() {
		if (this.ClickCallback) this.ClickCallback();

		if (this.IsDraggable()) return;
		
		Core().Client.Drag.StartDrag(this);
	}

	public UpdateContents() {
		this.FetchContents();

		this.gameObject.ClearChildren();

		if (this.SlotContents) {
			const [Type, Item] = ModelBuilder.BuildItemModel(this.SlotContents);

			if (Item) {
				Item.transform.SetParent(this.transform, false);
				Item.transform.localPosition = new Vector3(0.363, 0.666, -10);
				Item.transform.localScale = [ModelBuilder.ModelBuilderType.VoxelBlock, ModelBuilder.ModelBuilderType.VoxelPrefab].includes(Type)
					? Vector3.one.mul(37.5)
					: Vector3.one.mul(74.75);
				Item.SetLayerRecursive(5);

				if ([ModelBuilder.ModelBuilderType.VoxelBlock, ModelBuilder.ModelBuilderType.VoxelPrefab].includes(Type)) {
					Item.transform.localRotation = Quaternion.Euler(25, 45, 0);

					if (Type === ModelBuilder.ModelBuilderType.VoxelPrefab) {
						const Interactable = Item.GetAirshipComponent<InteractableBlockComponent>();
						if (Interactable) Interactable.enabled = false;
					} else {
						const Block = new MaterialPropertyBlock();
						Block.SetFloat("_VerticalOffset", 0.5);
						Item.GetComponent<MeshRenderer>()!.SetPropertyBlock(Block);
					}
				}
			}
		}

		if (!this.Tooltip) return;
		const IsGear = this.SlotContents?.Type === ItemTypes.Gear;
		if (this.SlotContents) {
			if (IsGear && this.SlotContents.Type === ItemTypes.Gear) {
				this.Tooltip.TooltipGear.GearTarget = Core().Gear[this.SlotContents.Key];
				this.Tooltip.TooltipGear.PerkLevel = this.SlotContents.Level;
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

	public DraggedOnto(Target?: SlotComponent) {
		if (Target) {
			const [TargetInventory, MyInventory] = [SlotComponent.GetInventoryFor(Target), this.GetInventory()];

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
			if (this.PlayerInventory) Network.Generic.DropItem.client.FireServer(this.PlayerInventory, this.SlotID, this.FetchContents()!.Amount);
		}
	}

	public static GetInventoryFor(Target: SlotComponent) {
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
		return SlotComponent.GetInventoryFor(this);
	}

	public static LS_ReloadAllSlots() {
		for (const [Slot] of pairs(SlotComponent.AllLoadoutSlots)) {
			Slot.FetchContents();
		}
	}

	public FetchContents() {
		if ([CallbackType.Inventory, CallbackType.Loadout, CallbackType.ContainerInventory].includes(this.CallbackType)) this.SlotContents = this.GetInventory()?.Content[this.SlotID];
		return this.SlotContents;
	}
}
