import { Asset } from "@Easy/Core/Shared/Asset";
import Core from "Code/Core/Core";
import { type AnyItem, ItemTypes } from "../Types";

export namespace ModelBuilder {
	export enum ModelBuilderType {
		None,
		ItemMesh,
		VoxelBlock,
		VoxelPrefab,
	}
	export function BuildItemModel(Item: AnyItem) {
		let ItemMesh: Mesh | undefined;

		switch (Item.Type) {
			case ItemTypes.Gear: {
				ItemMesh = Asset.LoadAsset(`Assets/Resources/Models/Item/None.asset`);
				break;
			}

			case ItemTypes.Item: {
				ItemMesh = Asset.LoadAssetIfExists(`Assets/Resources/Models/Item/${Item.Key}.asset`) ?? Asset.LoadAsset(`Assets/Resources/Models/Item/None.asset`);
				break;
			}

			case ItemTypes.Block: {
				const Definition = Core().World.GetDefinition(Item.BlockID);
				switch (Definition.contextStyle) {
					case ContextStyle.Block: {
						const Mesh = MeshProcessor.ProduceSingleBlock(Item.BlockID, Core().World.World, 0, 1);
						return $tuple(ModelBuilderType.VoxelBlock, Mesh, undefined, undefined);
					}
					case ContextStyle.Prefab: {
						const Model = Instantiate(Definition.prefab);
						return $tuple(ModelBuilderType.VoxelPrefab, Model, undefined, undefined);
					}
					case ContextStyle.GreedyMeshingTiles:
					case ContextStyle.PipeBlocks:
					case ContextStyle.QuarterBlocks:
					case ContextStyle.StaticMesh:
				}
			}
		}

		if (ItemMesh) {
			const ItemObject = GameObject.Create("ItemMesh");

			const Renderer = ItemObject.AddComponent<MeshRenderer>();
			const Filter = ItemObject.AddComponent<MeshFilter>();
			Filter.mesh = Instantiate(ItemMesh);

			const Material: Material | undefined =
				Asset.LoadAssetIfExists(`Assets/Resources/Models/Item/Materials/${Item.Key}.mat`) ?? Asset.LoadAsset(`Assets/Resources/Models/Item/Materials/None.mat`);

			if (Material) Renderer.SetMaterial(0, Material);

			return $tuple(ModelBuilderType.ItemMesh, ItemObject, Filter, Renderer);
		}

		return $tuple(ModelBuilderType.None, undefined, undefined, undefined);
	}
}
