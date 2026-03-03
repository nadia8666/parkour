import { Asset } from "@Easy/Core/Shared/Asset";
import { type AnyItem, ItemTypes } from "../Types";

export namespace ModelBuilder {
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
		}

		if (ItemMesh) {
			const ItemObject = GameObject.Create("ItemMesh");
            
			const Renderer = ItemObject.AddComponent<MeshRenderer>();
			const Filter = ItemObject.AddComponent<MeshFilter>();
			Filter.mesh = Instantiate(ItemMesh);
            
			const Material: Material | undefined =
            Asset.LoadAssetIfExists(`Assets/Resources/Models/Item/Materials/${Item.Key}.mat`) ?? Asset.LoadAsset(`Assets/Resources/Models/Item/Materials/None.mat`);

			if (Material) Renderer.SetMaterial(0, Material);

            return $tuple(ItemObject, Filter, Renderer)
		}

        return $tuple(undefined, undefined, undefined)
	}
}
