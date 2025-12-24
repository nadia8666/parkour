import { Game } from "@Easy/Core/Shared/Game";
import DataService from "Code/Server/Data/DataService";
import { Network } from "Code/Shared/Network";
import { DualLink } from "@inkyaker/DualLink/Code";

export default class DataController extends AirshipSingleton {
	public Link = new DualLink(DataService.Get().Key(Game.localPlayer), Network.Data.GetInitialData.client.FireServer());
}
