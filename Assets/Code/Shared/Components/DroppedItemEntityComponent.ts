import { Airship } from "@Easy/Core/Shared/Airship";
import type Character from "@Easy/Core/Shared/Character/Character";
import { Game } from "@Easy/Core/Shared/Game";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import Core from "Code/Core/Core";
import { Network } from "../Network";
import type { AnyItem } from "../Types";
import { ModelBuilder } from "../Utility/ModelBuilder";
import EntityComponent from "./EntityComponent";

export default class DroppedItemEntityComponent extends EntityComponent {
	public ModelContainer: Transform;
	@NonSerialized() public Item: AnyItem;
	@NonSerialized() public Lifetime = 0;
	@NonSerialized() public PickupDelay = 2;
	@NonSerialized() public LifetimeDuration = 300; // 5 minutes

	@Client()
	override Start() {
		if (!Game.IsHosting()) {
			this.ModelContainer.gameObject.ClearChildren();
			this.Item = Network.Generic.GetDroppedItemData.client.FireServer(this.Identity.netId)!;
			this.DrawModel();
		}
	}

	public DrawModel() {
		this.ModelContainer.gameObject.ClearChildren();
		if ($SERVER && !Game.IsHosting()) return;

		const [Model] = ModelBuilder.BuildItemModel(this.Item);

		if (!Model) return;
		Model.transform.SetParent(this.ModelContainer, false);
		Model.transform.localPosition = Vector3.zero;
		Model.transform.localScale = Vector3.one.mul(0.6);
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

				if ((Link.Inventories.Hotbar.Content as Array<AnyItem>).size() < Link.Inventories.Hotbar.Size) {
					(Link.Inventories.Hotbar.Content as Array<AnyItem>).push(this.Item);
					this.Destroy();
					return;
				}

				if ((Link.Inventories.Player.Content as Array<AnyItem>).size() < Link.Inventories.Player.Size) {
					(Link.Inventories.Player.Content as Array<AnyItem>).push(this.Item);
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
