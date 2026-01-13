import { Game } from "@Easy/Core/Shared/Game";
import Core from "Code/Core/Core";
import { Network } from "Code/Shared/Network";
import type { DataFormat } from "Code/Shared/Types";
import { DualLink } from "@inkyaker/DualLink/Code";

let InitialLink: DualLink<DataFormat>;

task.spawn(() => {
	Game.WaitForLocalPlayerLoaded();

	InitialLink = new DualLink(Core().Server.DataService.Key(Game.localPlayer), Network.Data.GetInitialData.client.FireServer());
});
export default class DataController extends AirshipSingleton {
	public GetLink() {
		while (!InitialLink) task.wait();

		return InitialLink;
	}

	@Client()
	protected override LateUpdate() {
		if (InitialLink) InitialLink.PrepareReplicate();
	}
}
