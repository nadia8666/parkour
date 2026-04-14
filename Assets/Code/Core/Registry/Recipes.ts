import { Asset } from "@Easy/Core/Shared/Asset";
import type RecipeObject from "Code/Shared/Object/RecipeObject";
import { Registry } from "./Registries";

export default class Recipes {
	public static Registry = new Registry<RecipeObject>("parkour");

	private static Register(ID: string) {
		return Recipes.Registry.Register(Asset.LoadAsset(`Assets/Resources/Recipes/${ID}.asset`), ID);
	}

	public static OakPlanks = Recipes.Register("OakPlanks");
	public static Stick = Recipes.Register("Stick");
}
