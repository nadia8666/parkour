import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import type TooltipComponent from "Code/Client/Components/TooltipComponent";
import Core from "Code/Core/Core";
import { Network } from "Code/Shared/Network";
import { type AnyItem, type Inventory, ItemTypes } from "Code/Shared/Types";
import { ModelBuilder } from "Code/Shared/Utility/ModelBuilder";

export enum CallbackType {
	Loadout,
	Inventory,
	ContainerInventory,
	None,
}

export default class DraggableSlotComponent extends AirshipBehaviour {
	private Connections = new Bin();

	public static AllLoadoutSlots = new Set<DraggableSlotComponent>();
	public static AllSlots = new Map<GameObject, DraggableSlotComponent>();

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

		if (this.CallbackType === CallbackType.Loadout) DraggableSlotComponent.AllLoadoutSlots.add(this);
		DraggableSlotComponent.AllSlots.set(this.gameObject, this);
	}

	@Client()
	override OnDisable() {
		this.Connections.Clean();

		DraggableSlotComponent.AllLoadoutSlots.delete(this);
		DraggableSlotComponent.AllSlots.delete(this.gameObject);
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
			const [Item] = ModelBuilder.BuildItemModel(this.SlotContents);

			if (Item) {
				Item.transform.SetParent(this.transform, false);
				Item.transform.localPosition = new Vector3(0.363, 0.666, -10);
				Item.transform.localScale = new Vector3(74.75, 74.75, 74.75);
				Item.layer = LayerMask.NameToLayer("UI");
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
			if (this.PlayerInventory) Network.Generic.DropItem.client.FireServer(this.PlayerInventory, this.SlotID, this.FetchContents()!.Amount);
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
		for (const [Slot] of pairs(DraggableSlotComponent.AllLoadoutSlots)) {
			Slot.FetchContents();
		}
	}

	public FetchContents() {
		this.SlotContents = this.GetInventory()?.Content[this.SlotID];
		return this.SlotContents;
	}
}
