import { Mouse } from "@Easy/Core/Shared/UserInput";
import Core from "Code/Core/Core";
import ENV from "Code/Server/ENV";
import type InteractableBlockComponent from "Code/Shared/Components/InteractableBlockComponent";
import { Network } from "Code/Shared/Network";
import { Provider } from "Code/Shared/Provider";
import { ItemUtil } from "Code/Shared/Utility/ItemUtil";
import Config from "../Config";
import SlotComponent from "../UI/Drag/SlotComponent";
import type ClientComponent from "./ClientComponent";
import { Actions } from "./ClientInput";
import { Raycast } from "./Moveset/Base";

export class ClientInteractions {
	public BlockCursor: GameObject;
	public TargetedBlock?: Vector3;
	public BreakProgress = 0;
	public BreakingBlock = false;
	public TargetNormal: Vector3 = Vector3.forward;
	public World = new Provider(() => Core().World.World);
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

	public Update(DeltaTime: number) {
		const LastPos = this.TargetedBlock;
		const Cast = Raycast(this.Controller.Camera.Transform.position, this.Controller.Camera.TargetRotation.mul(Vector3.forward), Config.InteractionReach);
		if (Cast.Hit) {
			const VoxelPos = VoxelWorld.FloorInt(Cast.Pos.sub(Cast.Normal.mul(0.5)));
			this.BlockCursor.transform.position = VoxelPos.add(new Vector3(0.5, 0.5, 0.5));
			this.TargetedBlock = VoxelPos;
			this.TargetNormal = Cast.Normal;
		} else this.TargetedBlock = undefined;

		if (LastPos !== this.TargetedBlock) {
			this.ResetBreakState();
			if (LastPos) this.World.Get().DamageVoxelAt(LastPos, 0, true);
		}

		const Progress = this.BreakProgress;
		if (this.BreakingBlock && this.TargetedBlock) {
			this.BreakProgress += DeltaTime * 2; // TODO: held item attributes (break speed) & block attributes (required tool for break)

			if (this.BreakProgress >= 1) {
				const BlockID = this.World.Get().GetVoxelAt(this.TargetedBlock);
				if (!ENV.Shared) this.World.Get().WriteVoxelAt(this.TargetedBlock, 0, true);
				if (!Network.VoxelWorld.Try.BreakBlock.client.FireServer(this.TargetedBlock, Core().Client.UI.Hotbar.SelectedSlot))
					this.World.Get().WriteVoxelAt(this.TargetedBlock, BlockID, true);
				// TODO: durability--
			}
		}

		if (this.BreakProgress !== Progress && this.TargetedBlock) this.World.Get().DamageVoxelAt(this.TargetedBlock, math.min(this.BreakProgress, 1), true);

		this.BlockCursor.SetActive(Cast.Hit);
	}

	public OnLMBDown() {
		if (this.Controller.UI.UI.Get().RaycastUI() || this.Controller.UI.UI.Get().AreMenusOpen()) return;
		if (this.TargetedBlock) {
			this.BreakingBlock = true;
		}
	}

	public OnLMBUp() {
		if (this.BreakingBlock) {
			this.BreakingBlock = false;
			this.ResetBreakState();
		}
	}

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
				const [_, Index] = ItemUtil.FindItemInInventories(HeldItem);
				const BlockPos = this.TargetedBlock.add(this.TargetNormal);
				const BlockID = this.World.Get().GetVoxelAt(BlockPos);
				if (!ENV.Shared) this.World.Get().WriteVoxelAt(BlockPos, 0, true);

				if (!Network.VoxelWorld.Try.PlaceBlock.client.FireServer(BlockPos, Index!)) this.World.Get().WriteVoxelAt(BlockPos, BlockID, true);
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
					return UITarget && SlotComponent.AllSlots.get(UITarget)?.FetchContents();
				})()
			: Core().Client.UI.Hotbar.HeldItem;

		if (!Item) return;

		const [Slot, Index] = ItemUtil.FindItemInInventories(Item);
		if (Slot) Network.Generic.DropItem.client.FireServer(Slot, Index, Actions.DropModifier.Active ? Item.Amount : 1);
	}

	public ResetBreakState() {
		this.BreakProgress = 0;
		if (this.TargetedBlock) this.World.Get().DamageVoxelAt(this.TargetedBlock, 0, true);
	}
}
