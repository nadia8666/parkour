import { Mouse } from "@Easy/Core/Shared/UserInput";
import Core from "Code/Core/Core";
import type InteractableBlockComponent from "Code/Shared/Components/InteractableBlockComponent";
import { Network } from "Code/Shared/Network";
import { ItemUtil } from "Code/Shared/Utility/ItemUtil";
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
				const [Slot, Index] = ItemUtil.FindItemInInventories(HeldItem);
				if (Slot) Network.TEMP.PLACE_VOXEL.client.FireServer(this.TargetedBlock.add(this.TargetNormal), Slot, Index);
			}
		}
	}

	public OnRMBUp() {}

	// Actions
	public DropItem() {
		const UI = Core().Client.UI;

		let Item = UI.AreMenusOpen()
			? (() => {
					const UITarget = UI.RaycastUI();
					return UITarget && DraggableSlotComponent.AllSlots.get(UITarget)?.FetchContents();
				})()
			: Core().Client.UI.Hotbar.HeldItem;

		if (!Item) return;

		const [Slot, Index] = ItemUtil.FindItemInInventories(Item);
		if (Slot) Network.Generic.DropItem.client.FireServer(Slot, Index, Actions.DropModifier.Active ? Item.Amount : 1);
	}
}
