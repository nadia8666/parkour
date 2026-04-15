import { Asset } from "@Easy/Core/Shared/Asset";
import Core from "Code/Core/Core";
import { BlockModel } from "Code/Core/World/Block/BlockDef";
import { type AnyItem, ItemTypes } from "../Types";

export namespace ModelBuilder {
	export enum ModelBuilderReturnType {
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
				const Definition = Core().World.GetDefinitionFromBlock(Item.BlockID);
				switch (Definition.ModelType) {
					case BlockModel.Box: {
						const Object = GameObject.Create("VoxelBlock");
						const Renderer = Object.AddComponent<MeshRenderer>();
						const Filter = Object.AddComponent<MeshFilter>();
						const TargetMesh = Filter.mesh;
						TargetMesh.subMeshCount = 6;

						const Verts: Vector3[] = [];
						const UVs: Vector2[] = [];

						const AddFace = (p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3) => {
							Verts.push(p0, p1, p2, p3);
							UVs.push(new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 1), new Vector2(1, 0));
						};

						AddFace(new Vector3(-0.5, 0.5, -0.5), new Vector3(-0.5, 0.5, 0.5), new Vector3(0.5, 0.5, 0.5), new Vector3(0.5, 0.5, -0.5));
						AddFace(new Vector3(-0.5, -0.5, 0.5), new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, -0.5, -0.5), new Vector3(0.5, -0.5, 0.5));
						AddFace(new Vector3(0.5, -0.5, 0.5), new Vector3(0.5, 0.5, 0.5), new Vector3(-0.5, 0.5, 0.5), new Vector3(-0.5, -0.5, 0.5));
						AddFace(new Vector3(0.5, -0.5, -0.5), new Vector3(0.5, 0.5, -0.5), new Vector3(0.5, 0.5, 0.5), new Vector3(0.5, -0.5, 0.5));
						AddFace(new Vector3(-0.5, -0.5, -0.5), new Vector3(-0.5, 0.5, -0.5), new Vector3(0.5, 0.5, -0.5), new Vector3(0.5, -0.5, -0.5));
						AddFace(new Vector3(-0.5, -0.5, 0.5), new Vector3(-0.5, 0.5, 0.5), new Vector3(-0.5, 0.5, -0.5), new Vector3(-0.5, -0.5, -0.5));

						TargetMesh.SetVertices(Verts);
						TargetMesh.SetUVs(0, UVs);

						for (let Index = 0; Index < 6; Index++) {
							const Base = Index * 4;
							TargetMesh.SetTriangles([Base, Base + 1, Base + 2, Base, Base + 2, Base + 3], Index);
						}

						TargetMesh.RecalculateNormals();

						Renderer.materials = [
							Definition.GetTextureFor(Vector3.up),
							Definition.GetTextureFor(Vector3.down),
							Definition.GetTextureFor(Vector3.forward),
							Definition.GetTextureFor(Vector3.right),
							Definition.GetTextureFor(Vector3.back),
							Definition.GetTextureFor(Vector3.left),
						];

						return $tuple(ModelBuilderReturnType.VoxelBlock, Object, Filter, Renderer);
					}

					case BlockModel.Prefab:
						return $tuple(ModelBuilderReturnType.VoxelPrefab, Instantiate(Definition.Prefab), undefined, undefined);

					default:
						break;
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

			return $tuple(ModelBuilderReturnType.ItemMesh, ItemObject, Filter, Renderer);
		}

		return $tuple(ModelBuilderReturnType.None, undefined, undefined, undefined);
	}
}
