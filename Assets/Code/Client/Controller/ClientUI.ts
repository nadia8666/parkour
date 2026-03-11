import Core from "Code/Core/Core";
import { Provider } from "Code/Shared/Provider";
import type ClientComponent from "./ClientComponent";

export class ClientUI {
	public UI = new Provider(() => Core().Client.UI);
	constructor(private Controller: ClientComponent) {}

	public LateUpdate(DeltaTime: number) {
		this.Controller.Gear.UpdateUI();
		Core().Client.UI.UpdateUI(this.Controller, DeltaTime);
	}
}
