import type ClientController from "../Client/ClientController";
import type ServerService from "../Server/ServerService";
import type GearRegistrySingleton from "../Shared/GearRegistry";

export default class _CoreSingleton extends AirshipSingleton {
	public Client: ClientController;
	public Gear: GearRegistrySingleton;
	public Server: ServerService;
}
