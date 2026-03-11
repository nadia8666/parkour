import type ClientComponent from "./ClientComponent";

export class ClientRenderer {
	constructor(private Controller: ClientComponent) {}

	public ReloadShadows() {
		const MainRenderer = this.Controller.AccessoryBuilder.GetCombinedSkinnedMesh();
		const AccessoryRenderers = this.Controller.AccessoryBuilder.GetAllAccessoryRenderers();

		if (MainRenderer) MainRenderer.shadowCastingMode = ShadowCastingMode.ShadowsOnly;
		for (const [_, Renderer] of pairs(AccessoryRenderers)) {
			if (Renderer) Renderer.shadowCastingMode = ShadowCastingMode.ShadowsOnly;
		}

		this.Controller.SkinnedMeshes.forEach((Mesh) => (Mesh.shadowCastingMode = ShadowCastingMode.ShadowsOnly));

		this.Controller.Face.SetActive(false);
	}
}
