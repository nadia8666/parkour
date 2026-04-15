import { Airship } from "@Easy/Core/Shared/Airship";
import type Character from "@Easy/Core/Shared/Character/Character";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import Core from "Code/Core/Core";
import ENV from "Code/Server/ENV";
import { Network } from "../Network";
import type { AnyItem } from "../Types";
import { ItemUtil } from "../Utility/ItemUtil";
import { ModelBuilder } from "../Utility/ModelBuilder";
import EntityComponent from "./EntityComponent";
import type InteractableBlockComponent from "./InteractableBlockComponent";

export default class DroppedItemEntityComponent extends EntityComponent {
	public ModelContainer: Transform;
	@NonSerialized() public Item: AnyItem;
	@NonSerialized() public Lifetime = 0;
	@NonSerialized() public PickupDelay = 2;
	@NonSerialized() public LifetimeDuration = 300; // 5 minutes

	@Client()
	override Start() {
		if (!ENV.Shared) {
			this.ModelContainer.gameObject.ClearChildren();
			this.Item = Network.Generic.GetDroppedItemData.client.FireServer(this.Identity.netId)!;
			this.DrawModel();
		}
	}

	public DrawModel() {
		this.ModelContainer.gameObject.ClearChildren();
		if ($SERVER && !ENV.Shared) return;

		const [Type, Item] = ModelBuilder.BuildItemModel(this.Item);

		if (!Item) return;
		if ([ModelBuilder.ModelBuilderReturnType.ItemMesh, ModelBuilder.ModelBuilderReturnType.VoxelBlock, ModelBuilder.ModelBuilderReturnType.VoxelPrefab].includes(Type)) {
			Item.transform.SetParent(this.ModelContainer, false);
			Item.transform.localPosition = Vector3.zero;
			Item.transform.localScale = Vector3.one.mul(0.4);
			Item.SetLayerRecursive(27);

			if (Type === ModelBuilder.ModelBuilderReturnType.VoxelBlock) {
				const Block = new MaterialPropertyBlock();
				Block.SetFloat("_VerticalOffset", 0.5);
				Item.GetComponent<MeshRenderer>()!.SetPropertyBlock(Block);
			}

			if (Type === ModelBuilder.ModelBuilderReturnType.VoxelPrefab) {
				const Interactable = Item.GetAirshipComponent<InteractableBlockComponent>();
				if (Interactable) Interactable.enabled = false;
			}
		}
	}

	@Client()
	override LateUpdate(DeltaTime: number) {
		this.ModelContainer.RotateAroundLocal(Vector3.up, DeltaTime);
	}

	@Server()
	override Update(DeltaTime: number) {
		this.transform.rotation = Quaternion.identity;

		this.Lifetime += DeltaTime;
		if (this.Lifetime >= this.LifetimeDuration) {
			this.Destroy();
			return;
		}

		if (this.Lifetime <= this.PickupDelay) return;
		const NearbyPlayers: [Character, number, Player][] = [];
		Airship.Players.GetPlayers().forEach((Player) => {
			const Character = Core().Server.CharacterMap.get(Player);
			if (!Character) return;

			const Magnitude = Character.transform.position.sub(this.transform.position).sqrMagnitude;
			if (Magnitude <= 5) NearbyPlayers.push([Character, Magnitude, Player]);
		});

		if (NearbyPlayers.size() > 0) {
			NearbyPlayers.sort((a, b) => a[1] < b[1]);

			for (const [_, Player] of pairs(NearbyPlayers)) {
				const ToPickup = Player[2];
				const Data = Core().Server.DataService;
				const Link = Data.GetPlayerData(Data.Key(ToPickup));

				const TargetInventory = ItemUtil.GetNextSlotForItem(this.Item, Link.Inventories);
				if (TargetInventory) {
					TargetInventory.SetItem();
					this.Destroy();
					return;
				}
			}
		}
	}

	@Server()
	public Destroy() {
		NetworkServer.Destroy(this.gameObject);
		this.gameObject?.SetActive(false);
	}
}
