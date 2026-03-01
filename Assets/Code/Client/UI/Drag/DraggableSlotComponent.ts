import { Asset } from "@Easy/Core/Shared/Asset";
import { Mouse } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import type TooltipComponent from "Code/Client/Components/TooltipComponent";
import Core from "Code/Core/Core";
import type { GearRegistryKey } from "Code/Shared/GearRegistry";
import { type AnyItem, type GearSlots, type ItemInfo, ItemTypes } from "Code/Shared/Types";

export enum CallbackType {
	Loadout,
	Inventory,
}

const AllSlots = new Set<DraggableSlotComponent>();

export default class DraggableSlotComponent extends AirshipBehaviour {
	private Connections = new Bin();

	@Header("References")

	@Header("Config")
	@SerializeField()
	private Draggable = true;
	public CallbackType: CallbackType = CallbackType.Inventory;

	// Loadout Slot
	@ShowIf("CallbackType", CallbackType.Loadout)
	@Header("Loadout Slot Config")
	public LS_TargetSlot: GearSlots;
	@ShowIf("CallbackType", CallbackType.Loadout)
	public LS_SlotID: number;
	public Tooltip: TooltipComponent | undefined;

	// InventorySlot
	@ShowIf("CallbackType", CallbackType.Inventory)
	@Header("Inventory Slot Config")
	@NonSerialized()
	public SlotContents: AnyItem | undefined;
	@ShowIf("CallbackType", CallbackType.Inventory) public IS_Inventory: string;
	@ShowIf("CallbackType", CallbackType.Inventory) public IS_SlotID: number;

	@Client()
	override OnEnable() {
		this.Connections.Add(
			Mouse.onLeftDown.Connect(() => {
				if (this.IsDraggable()) return;

				if (Core().Client.UI.RaycastUI() === this.gameObject) this.DragStart();
			}),
		);

		if (this.CallbackType === CallbackType.Loadout) {
			AllSlots.add(this);
			this.LS_FetchSlotContents();
		} else {
			this.UpdateContents();
		}
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
		this.gameObject.ClearChildren();

		if (this.SlotContents) {
			let ItemMesh: Mesh | undefined;

			switch (this.SlotContents.Type) {
				case ItemTypes.Gear: {
					break;
				}

				case ItemTypes.Item: {
					ItemMesh = Asset.LoadAssetIfExists(`Assets/Resources/Models/Item/${this.SlotContents.Key}.asset`) as Mesh;
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

				const Material = Asset.LoadAssetIfExists(`Assets/Resources/Models/Item/Materials/${this.SlotContents.Key}.mat`) as Material;
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
			if (this.CallbackType === CallbackType.Inventory) {
				this.Tooltip.TooltipString = `Empty`;
			} else {
				this.Tooltip.TooltipString = `Empty ${this.LS_TargetSlot} Slot`;
			}

			this.Tooltip.TooltipGear.GearTarget = undefined;
		}
	}

	public DraggedOnto(Target?: DraggableSlotComponent) {
		const IsLoadout = this.CallbackType === CallbackType.Loadout;
		if (Target) {
			const TargetIsLoadout = Target.CallbackType === CallbackType.Loadout;

			if (TargetIsLoadout) {
				if (Core().Client.Gear.TryEquipGear(Target.LS_TargetSlot, Target.LS_SlotID, this.SlotContents!)) {
					if (this.CallbackType === CallbackType.Inventory) {
						//this.SlotContents = undefined;
						
						// TODO: refactor gear so that equipped gear is more or less its own inventory instead of dedicated slots
						//delete Core().Client.Data.GetLink().Data.Inventories[this.IS_Inventory].Content[this.IS_SlotID];
					}
					Target.LS_ReloadAllSlots();
				}
			} else if (Target.CallbackType === CallbackType.Inventory) {
				const Container = Core().Client.Data.GetLink().Data.Inventories;
				const TargetInventory = Container[Target.IS_Inventory].Content[Target.IS_SlotID];

				if (TargetInventory) {
					// swap slots if possible
					if (IsLoadout) {
						if (TargetInventory.Type === ItemTypes.Gear) {
							const TargetGear = Core().Gear.GearFromKey(TargetInventory.Key as GearRegistryKey);
							if (TargetGear.Slot === this.LS_TargetSlot) {
								Container[Target.IS_Inventory].Content[Target.IS_SlotID] = this.SlotContents!;
								Core().Client.Data.GetLink().Data.EquippedGear[this.LS_TargetSlot][this.LS_SlotID - 1] = TargetInventory.UID;
								this.SlotContents = TargetInventory;
							}
						}
					} else {
						const Current = Container[this.IS_Inventory].Content[this.IS_SlotID];

						Container[this.IS_Inventory].Content[this.IS_SlotID] = TargetInventory;
						Container[Target.IS_Inventory].Content[Target.IS_SlotID] = Current;
					}
				} else {
					// clear current slot, fill target
					if (IsLoadout) {
						Container[Target.IS_Inventory].Content[Target.IS_SlotID] = this.SlotContents!;
						Core().Client.Data.GetLink().Data.EquippedGear[this.LS_TargetSlot][this.LS_SlotID - 1] = "None";
						this.SlotContents = undefined;
					} else {
						Container[Target.IS_Inventory].Content[Target.IS_SlotID] = Container[this.IS_Inventory].Content[this.IS_SlotID];
						delete Container[this.IS_Inventory].Content[this.IS_SlotID];
					}
				}

				Target.UpdateContents();
				this.UpdateContents();
			}
		} else {
			if (IsLoadout) {
				// unequip
				if (Core().Client.Gear.TryEquipGear(this.LS_TargetSlot, this.LS_SlotID)) this.LS_ReloadAllSlots();
			} else {
				// TODO: drop item
				//delete Core().Client.Data.GetLink().Data.Inventories[this.IS_Inventory].Content[this.IS_SlotID];
			}
		}
	}

	public LS_ReloadAllSlots() {
		for (const [Slot] of pairs(AllSlots)) {
			Slot.LS_FetchSlotContents();
		}
	}

	public LS_FetchSlotContents() {
		const Data = Core().Client.Data.GetLink().Data;

		const ID = Data.EquippedGear[this.LS_TargetSlot][this.LS_SlotID - 1];
		this.SlotContents = Core().Client.Gear.GetItem(ID)[0];
		this.UpdateContents();
	}
}
