import type ClientComponent from "Code/Client/Controller/ClientComponent";
import { UIMenus } from "Code/Client/UI/UIController";
import Core from "Code/Core/Core";
import { Utility } from "../Utility/Utility";
import type BlockContainerComponent from "./BlockContainerComponent";

export default class InteractableBlockComponent extends AirshipBehaviour {
	public Container?: BlockContainerComponent;
	@NonSerialized() public ID: string;

	public Start() {
		this.ID = `${Utility.Floor(this.transform.position)}`;
		if (this.Container) {
			this.Container.ID = this.ID;
			this.Container.enabled = true;
		}
	}

	public OnUse(Controller?: ClientComponent) {
		if ($CLIENT) {
			if (!Controller) return;

			if (this.Container) {
				const UI = Core().Client.UI;
				UI.ContainerInventory.SetInventory(this.Container.GetInventory());
				UI.OpenMenu(UIMenus.ContainerInventory);

				return true;
			}
		}
	}
}
