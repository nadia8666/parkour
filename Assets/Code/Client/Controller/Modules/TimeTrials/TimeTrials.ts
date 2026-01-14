import { Asset } from "@Easy/Core/Shared/Asset";
import type ProximityPrompt from "@Easy/Core/Shared/Input/ProximityPrompts/ProximityPrompt";
import Core from "Code/Core/Core";
import type TimeTrialObject from "Code/Shared/Object/TimeTrialObject";
import CFrame from "@inkyaker/CFrame/Code";
import type ClientComponent from "../../ClientComponent";
import type TimeTrialComponent from "./TimeTrialComponent";

type VirtualizedTrial = {
	Component: TimeTrialComponent;
	Object: TimeTrialObject;
	Prompt: ProximityPrompt;

	WorldModels: GameObject[];
};

export class TimeTrials {
	public CurrentTrial: TimeTrialComponent | undefined;
	public TrialsList: VirtualizedTrial[] = [];
	private PromptBase = Asset.LoadAsset("Assets/Resources/TimeTrials/TrialPrompt.prefab");

	constructor() {
		for (const [_, Target] of pairs(GameObject.FindGameObjectsWithTag("TimeTrial"))) {
			const Trial = Target.GetAirshipComponent<TimeTrialComponent>();
			if (!Trial) continue;

			this.RegisterTrial(Trial);
		}
	}

	public RegisterTrial(Trial: TimeTrialComponent) {
		const PromptGameObject = Instantiate(this.PromptBase);
		const Prompt = PromptGameObject.GetAirshipComponent<ProximityPrompt>() as ProximityPrompt;

		const NewTrial: VirtualizedTrial = {
			Component: Trial,
			Object: Trial.TrialData,
			Prompt: Prompt,

			WorldModels: [PromptGameObject],
		};

		// Decorate Prompt
		PromptGameObject.transform.SetParent(Trial.gameObject.transform);
		PromptGameObject.transform.localPosition = Vector3.up.mul(1.25);
		PromptGameObject.transform.localRotation = Quaternion.identity;
		Prompt.SetObjectText(NewTrial.Object.DisplayName);

		Prompt.onActivated.Connect(() => this.TryStartTrial(Trial));

		this.TrialsList.push(NewTrial);
	}

	private TryStartTrial(Trial: TimeTrialComponent) {
		const Controller = Core().Client.Actor;

		if (Controller) {
			this.Start(Controller, Trial, true);
		}
	}

	public Start(Controller: ClientComponent, Trial: TimeTrialComponent, RunIntro?: boolean) {
		this.CurrentTrial = Trial;

		Controller.ResetState();
		Controller.TeleportTo(CFrame.FromTransform(Trial.transform));
		print("state reset and teleported");

		if (RunIntro) {
			Controller.Input.AddInputLock("TimeTrialStart", 5);
			task.wait(3);
			Controller.Input.KillLockByID("TimeTrialStart");

			Controller.ResetState();
			Controller.TeleportTo(CFrame.FromTransform(Trial.transform));
			print("doing it Again");
		}

		print("TRIAL STARTED");
	}

	public Stop(Controller: ClientComponent) {
		Controller.Input.KillLockByID("TimeTrialStart");
		this.CurrentTrial = undefined;
	}

	public Restart(Controller: ClientComponent) {
		print("hello world", this.IsActive());
		if (this.CurrentTrial) {
			this.Start(Controller, this.CurrentTrial);
		}
	}

	public IsActive() {
		return !!this.CurrentTrial;
	}
}
