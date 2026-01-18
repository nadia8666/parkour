import { Asset } from "@Easy/Core/Shared/Asset";
import type ProximityPrompt from "@Easy/Core/Shared/Input/ProximityPrompts/ProximityPrompt";
import { ForceRefreshGearSignal } from "Code/Client/Config";
import Core from "Code/Core/Core";
import type TimeTrialObject from "Code/Shared/Object/TimeTrialObject";
import type { DataFormat } from "Code/Shared/Types";
import CFrame from "@inkyaker/CFrame/Code";
import type ClientComponent from "../../ClientComponent";
import type TimeTrialComponent from "./TimeTrialComponent";

interface VirtualizedTrial {
	Component: TimeTrialComponent;
	Object: TimeTrialObject;
	Prompt: ProximityPrompt;

	WorldModels: GameObject[];
}

export class TimeTrials {
	public CurrentTrial: TimeTrialComponent | undefined;
	public TrialsList: VirtualizedTrial[] = [];
	private PromptBase = Asset.LoadAsset("Assets/Resources/TimeTrials/TrialPrompt.prefab");
	private LastTrialStart = math.huge;
	private InIntro = false;
	public TrialGear: DataFormat["EquippedGear"] | undefined;

	constructor() {
		for (const [_, Target] of pairs(GameObject.FindGameObjectsWithTag("TimeTrial"))) {
			const Trial = Target.GetAirshipComponent<TimeTrialComponent>();
			if (!Trial) continue;

			this.RegisterTrial(Trial);
		}

		task.spawn(() => this.RefreshTrialStates());
	}

	public TrialStateUpdated() {
		const Active = this.IsActive();
		Core().Client.UI.TT_Container.gameObject.SetActive(Active);

		for (const [_, Trial] of pairs(this.TrialsList)) {
			Trial.Prompt.enabled = !Active;
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

		Prompt.onActivated.Connect(() => {
			const Controller = Core().Client.Actor;
			if (!Controller || (Controller && os.clock() - Controller.LastPromptInteract <= 0.05)) return;
			Controller.LastPromptInteract = os.clock();
			this.TryStartTrial(Trial);
		});

		this.TrialsList.push(NewTrial);
	}

	public RefreshTrialStates() {
		const Records = Core().Client.Data.GetLink().Data.TrialRecords;
		for (const [_, Trial] of pairs(this.TrialsList)) {
			const CurrentTime = Records[Trial.Object.ID] ?? 0;

			Trial.Prompt.SetObjectText(`${Trial.Object.DisplayName}\nPB: ${CurrentTime <= 0 ? "---.--" : this.FormatTime(CurrentTime, 0)}s`);
		}
	}

	private TryStartTrial(Trial: TimeTrialComponent) {
		const Controller = Core().Client.Actor;

		if (Controller) {
			this.Start(Controller, Trial, true);
		}
	}

	public Start(Controller: ClientComponent, Trial: TimeTrialComponent, RunIntro?: boolean) {
		if (this.IsActive()) this.Stop(Controller);

		this.TrialGear = {
			Grip: ["None"],
			Core: ["None"],
			Mod: ["None", "None"],
			Augment: ["None", "None", "None"],
		};
		ForceRefreshGearSignal.Fire();

		const Start = os.clock();
		this.LastTrialStart = Start;
		this.CurrentTrial = Trial;
		this.TrialStateUpdated();

		Controller.ResetState();
		Controller.TeleportTo(CFrame.FromTransform(Trial.transform));

		this.InIntro = !!RunIntro;

		if (RunIntro) {
			Controller.Input.AddInputLock("TimeTrialStart", 5);
			task.wait(3);
			if (this.IsActive() && this.LastTrialStart === Start) {
				Controller.Input.KillLockByID("TimeTrialStart");

				Controller.ResetState();
				Controller.TeleportTo(CFrame.FromTransform(Trial.transform));
				this.LastTrialStart = os.clock();

				this.InIntro = false;
			}
		}
	}

	public Stop(Controller: ClientComponent) {
		this.TrialGear = undefined;
		ForceRefreshGearSignal.Fire();

		Controller.LastPromptInteract = os.clock();
		Controller.Input.KillLockByID("TimeTrialStart");
		
		this.CurrentTrial = undefined;
		this.InIntro = false;
		this.LastTrialStart = math.huge;
		this.TrialStateUpdated();
	}

	public Restart(Controller: ClientComponent) {
		if (this.CurrentTrial && !this.InIntro) {
			this.Start(Controller, this.CurrentTrial);
		}
	}

	public IsActive() {
		return !!this.CurrentTrial;
	}

	public FormatTime(ElapsedSeconds: number, SecondsFillTarget: number = 3) {
		const Seconds = math.floor(ElapsedSeconds);
		const MS = math.floor((ElapsedSeconds - Seconds) * 100);

		const SecondsFill = string.rep("0", SecondsFillTarget - `${Seconds}`.size());
		const MSFill = string.rep("0", 2 - `${MS}`.size());

		return `${SecondsFill}${Seconds}.${MSFill}${MS}`;
	}

	public StepTrials(Controller: ClientComponent) {
		if (this.IsActive() && this.CurrentTrial) {
			// Trial UI
			const Trial = this.CurrentTrial;
			const CurrentTime = os.clock() - this.LastTrialStart;

			Core().Client.UI.TT_Time.text = this.FormatTime(CurrentTime);

			const RankColor = Trial.TrialData.GetColorFromTime(CurrentTime);
			if (RankColor) Core().Client.UI.TT_Medal.color = RankColor;

			// Trial tick results
			if (CurrentTime >= Trial.TrialData.Bronze) this.Restart(Controller);

			if (this.InIntro) {
				if (Controller.transform.position !== Trial.transform.position) {
					Controller.ResetState();
					Controller.TeleportTo(CFrame.FromTransform(Trial.transform));
				}
			} else {
				const GoalDist = Controller.GetCFrame(true).Position.sub(Trial.EndPoint.position).magnitude;

				if (GoalDist <= 3 && Controller.Health > 0 && ["Grounded", "Slide"].includes(Controller.State)) {
					print(`COMPLETE TRIAL WITH TIME ${CurrentTime}s, TARGET RANK "${Trial.TrialData.GetRankDisplayFromTime(CurrentTime)}"`);
					this.Stop(Controller);

					const Records = Core().Client.Data.GetLink(true).Data.TrialRecords;
					const ExistingRecord = Records[Trial.TrialData.ID];
					let ToSet = false;
					if (ExistingRecord) {
						if (ExistingRecord > CurrentTime) ToSet = true;
						print(ExistingRecord, CurrentTime, ToSet);
					} else ToSet = true;

					if (ToSet) {
						Records[Trial.TrialData.ID] = CurrentTime;
						Core().Client.Data.GetLink(true).RecalculateHash();
						print(`Set ${Trial.TrialData.ID} record!`);
						this.RefreshTrialStates();
					}
				}
			}
		}
	}
}
