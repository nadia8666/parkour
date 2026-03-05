import { Mouse } from "@Easy/Core/Shared/UserInput";
import Core from "Code/Core/Core";
import type InteractableBlockComponent from "Code/Shared/Components/InteractableBlockComponent";
import { Network } from "Code/Shared/Network";
import Config from "../Config";
import DraggableSlotComponent from "../UI/Drag/DraggableSlotComponent";
import type ClientComponent from "./ClientComponent";
import { Actions } from "./ClientInput";
import { Raycast } from "./Moveset/Base";

export class ClientInteractions {
	public BlockCursor: GameObject;
	public TargetedBlock?: Vector3;
	public TargetNormal: Vector3 = Vector3.forward;
	constructor(private Controller: ClientComponent) {}

	public OnEnable() {
		this.BlockCursor = Instantiate(this.Controller.BlockCursorRef);
		this.BlockCursor.SetActive(false);
		this.Controller.Bin.Add(this.BlockCursor);

		//TODO: mobile support
		this.Controller.Bin.Add(Mouse.onLeftDown.Connect(() => this.OnLMBDown()));
		this.Controller.Bin.Add(Mouse.onRightDown.Connect(() => this.OnRMBDown()));
		this.Controller.Bin.Add(Mouse.onLeftUp.Connect(() => this.OnLMBUp()));
		this.Controller.Bin.Add(Mouse.onRightUp.Connect(() => this.OnRMBUp()));
	}

	public Update() {
		const Cast = Raycast(this.Controller.Camera.Transform.position, this.Controller.Camera.TargetRotation.mul(Vector3.forward), Config.InteractionReach);
		if (Cast.Hit) {
			const VoxelPos = VoxelWorld.FloorInt(Cast.Pos.sub(Cast.Normal.mul(0.5)));
			this.BlockCursor.transform.position = VoxelPos.add(new Vector3(0.5, 0.5, 0.5));
			this.TargetedBlock = VoxelPos;
			this.TargetNormal = Cast.Normal;
		} else this.TargetedBlock = undefined;

		this.BlockCursor.SetActive(Cast.Hit);
	}

	public OnLMBDown() {
		// TODO: mining
		if (this.Controller.UI.UI.Get().RaycastUI() || this.Controller.UI.UI.Get().AreMenusOpen()) return;
		if (this.TargetedBlock) Network.TEMP.DESTROY_VOXEL.client.FireServer(this.TargetedBlock);
	}

	public OnLMBUp() {}

	public OnRMBDown() {
		if (this.Controller.UI.UI.Get().RaycastUI() || this.Controller.UI.UI.Get().AreMenusOpen()) return;
		if (this.TargetedBlock) {
			const HeldItem = Core().Client.UI.Hotbar.HeldItem;
			const Prefab = this.Controller.World.World.GetPrefabAt(this.TargetedBlock);
			let TryPlace = true;
			if (Prefab) {
				const Interactable = Prefab.GetAirshipComponent<InteractableBlockComponent>(true);

				if (Interactable?.OnUse(this.Controller)) TryPlace = false;
			}

			if (TryPlace && HeldItem) {
				// TODO: move to registry util
				for (const [TargetSlot, Inventory] of pairs(Core().Client.Data.GetLink(true).Data.Inventories)) {
					for (const [Index, Value] of pairs(Inventory.Content)) {
						if (Value === HeldItem) {
							Network.TEMP.PLACE_VOXEL.client.FireServer(this.TargetedBlock.add(this.TargetNormal), TargetSlot as string, Index);
							break;
						}
					}
				}
			}
		}
	}

	public OnRMBUp() {}

	// Actions
	public DropItem() {
		const UI = Core().Client.UI;

		let HeldItem = UI.AreMenusOpen()
			? (() => {
					const UITarget = UI.RaycastUI();
					return UITarget && DraggableSlotComponent.AllSlots.get(UITarget)?.FetchContents();
				})()
			: Core().Client.UI.Hotbar.HeldItem;

		if (!HeldItem) return;

		// TODO: move to registry util
		for (const [TargetSlot, Inventory] of pairs(Core().Client.Data.GetLink(true).Data.Inventories)) {
			for (const [Index, Value] of pairs(Inventory.Content)) {
				if (Value === HeldItem) {
					Network.Generic.DropItem.client.FireServer(TargetSlot as string, Index, Actions.DropModifier.Active ? Value.Amount : 1);
					break;
				}
			}
		}
	}
}
