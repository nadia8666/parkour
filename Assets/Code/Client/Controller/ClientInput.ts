import { Airship } from "@Easy/Core/Shared/Airship";
import { Game } from "@Easy/Core/Shared/Game";
import { CoreAction } from "@Easy/Core/Shared/Input/AirshipCoreAction";
import { Binding } from "@Easy/Core/Shared/Input/Binding";
import { Keyboard } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import Core from "Code/Core/Core";
import type ClientComponent from "./ClientComponent";

class InputEntry {
	public Active = false;

	constructor(
		public readonly Key: Key,
		public readonly Priority: number,
		public readonly Category: string = "AP - Unassigned",
		public readonly Hidden: boolean = false,
		public readonly MobileScale?: number,
		public readonly MobilePosition?: Vector2,
	) {}
}

export const Actions = {
	LedgeGrab: new InputEntry(Key.Space, 5, "AP - Movement"),
	Jump: new InputEntry(Key.Space, 4, "AP - Movement"),
	WallKick: new InputEntry(Key.Space, 3, "AP - Movement"),
	WallAction: new InputEntry(Key.Space, 2, "AP - Movement"),
	Wallrun: new InputEntry(Key.Space, 1, "AP - Movement"),

	Coil: new InputEntry(Key.LeftShift, 2, "AP - Movement"),
	Slide: new InputEntry(Key.LeftShift, 1, "AP - Movement"),

	Respawn: new InputEntry(Key.R, 2, "AP - Generic"),
	QuickRestart: new InputEntry(Key.R, 1, "AP - Time Trials"),

	Interact: new InputEntry(Key.F, 2, "AP - Generic"),
	CancelTrial: new InputEntry(Key.F, 1, "AP - Time Trials"),

	Fly: new InputEntry(Key.Q, 1, "AP - Debug"),
	FlyBoost: new InputEntry(Key.LeftShift, -1, "AP - Debug"),

	CoreUse: new InputEntry(Key.E, 1, "AP - Gear"),

	DropItem: new InputEntry(Key.X, 1, "AP - Inventory"),
	DropModifier: new InputEntry(Key.LeftShift, 0, "AP - Inventory"),
};

const InverseMap = new Map<Key, (keyof typeof Actions)[]>();

for (const [Name, Entry] of pairs(Actions)) {
	const List = InverseMap.get(Entry.Key);

	if (List) {
		List.push(Name);
		List.sort((Name1, Name2) => {
			const [Entry1, Entry2] = [Actions[Name1], Actions[Name2]];
			return Entry1.Priority > Entry2.Priority;
		});
	} else {
		InverseMap.set(Entry.Key, [Name]);
	}

	Airship.Input.CreateAction(Name, Binding.Key(Entry.Key), { category: Entry.Category, hidden: Entry.Hidden });
	if (Entry.MobilePosition) {
		Airship.Input.CreateMobileButton(Name, Entry.MobilePosition, { scale: Vector2.one.mul(Entry.MobileScale ?? 1) });
	}
}

Airship.Input.DisableCoreActions([
	CoreAction.Forward,
	CoreAction.Left,
	CoreAction.Back,
	CoreAction.Right,
	CoreAction.Sprint,
	CoreAction.Crouch,
	CoreAction.PrimaryAction,
	CoreAction.SecondaryAction,
	CoreAction.Interact,
	CoreAction.Emote,
	CoreAction.Inventory,
	CoreAction.InventoryQuickMoveModifierKey,
]);

export class ClientInput {
	private readonly KeyMap = new Map<Key, Array<keyof typeof Actions>>();
	public Bin = new Bin();

	constructor(private Controller: ClientComponent) {}

	private InputEnabled = true;
	private InputLocks: { [Index: string]: { Duration: number | undefined; Start: number } } = {};
	public AddInputLock(ID: string, Duration?: number) {
		this.InputLocks[ID] = { Duration: Duration, Start: os.clock() };

		for (const [Name] of pairs(Actions)) {
			this.KeyReleased(Name);
		}
	}

	public KillLockByID(ID: string) {
		return delete this.InputLocks[ID];
	}

	public BindInputs() {
		this.Bin.Clean();

		for (const [Name] of pairs(Actions)) {
			this.Bin.Add(Airship.Input.OnDown(Name).Connect(() => this.KeyPressed(Name)));
			this.Bin.Add(Airship.Input.OnUp(Name).Connect(() => this.KeyReleased(Name)));
		}

		this.Bin.Add(
			this.Controller.Animator.EventTriggered.Connect((Key) => {
				this.Controller.Moveset.Base.OnAnimationEvent(Key, this.Controller);
			}),
		);
	}

	/**
	 * queues a button to be removed from the list. if you pass in controller it will immediately drop the key
	 * @param Name
	 * @param Immediate
	 */
	public KeyReleased(Name: keyof typeof Actions, Immediate?: boolean) {
		const Entry = Actions[Name];
		const ExistingKeys = this.KeyMap.get(Entry.Key);

		if (ExistingKeys) {
			const Index = ExistingKeys.indexOf(Name);

			if (Index > -1) {
				ExistingKeys.remove(Index);

				if (Immediate) {
					Entry.Active = false;
					this.ActionDropped(Name);
				}
			}
		}
	}

	public KeyPressed(Name: keyof typeof Actions, Immediate?: boolean) {
		if (this.IsDisabled()) return;

		const Entry = Actions[Name];

		const ExistingKeys = this.KeyMap.get(Entry.Key);
		if (ExistingKeys) {
			ExistingKeys.push(Name);

			if (Immediate) {
				Entry.Active = true;
				this.ActionPressed(Name);
			}
		} else {
			this.KeyMap.set(Entry.Key, [Name]);
		}
	}

	private ActionPressed(Name: keyof typeof Actions) {
		switch (Name) {
			case "QuickRestart":
				if (Core().Client.Objective.TimeTrials.IsActive()) {
					Core().Client.Objective.TimeTrials.Restart(this.Controller);
					return;
				}
				break;
			case "CancelTrial":
				if (Core().Client.Objective.TimeTrials.IsActive()) {
					Core().Client.Objective.TimeTrials.Stop(this.Controller);
					return;
				}
				break;
			case "DropItem": {
				this.Controller.Interactions.DropItem();
			}
		}

		this.Controller.Moveset.Base.ActionPressed(Name, this.Controller);
	}
	private ActionDropped(Name: keyof typeof Actions) {
		this.Controller.Moveset.Base.ActionDropped(Name, this.Controller);
	}

	public UpdateInputs() {
		let Enabled = true;
		for (const [ID, Lock] of pairs(this.InputLocks)) {
			if (Lock.Duration !== undefined)
				if (os.clock() - Lock.Start >= Lock.Duration) {
					this.KillLockByID(ID as string);
					continue;
				}

			if (Enabled) Enabled = false;
		}
		this.InputEnabled = Enabled;

		for (const [Key, Names] of pairs(InverseMap)) {
			const ExistingKeys = this.KeyMap.get(Key);

			if (ExistingKeys) {
				for (const [_, Name] of pairs(Names)) {
					const Index = ExistingKeys.indexOf(Name);
					const Entry = Actions[Name];

					if (Index === -1) {
						if (Entry.Active) {
							Entry.Active = false;
							this.ActionDropped(Name);
						}
					} else {
						if (!Entry.Active) {
							Entry.Active = true;
							this.ActionPressed(Name);
						}
					}
				}
			} else {
				for (const [_, Name] of pairs(Names)) {
					const Entry = Actions[Name];

					if (Entry.Active) {
						Entry.Active = false;
						this.Controller.Moveset.Base.ActionDropped(Name, this.Controller);
					}
				}
			}
		}
	}

	public IsDisabled() {
		return Core().Client.UI.InputDisabledFromMenu() || !this.InputEnabled;
	}

	public GetMoveVector() {
		let MobileVector: Vector3 | Vector2 = (Game.IsMobile() ? Airship.Input.GetMobileTouchJoystick()?.input : Vector3.zero) ?? Vector3.zero;
		if (MobileVector) {
			MobileVector = new Vector3(MobileVector.x, 0, MobileVector.y);
		}
		return this.IsDisabled()
			? Vector3.zero
			: new Vector3((Keyboard.IsKeyDown(Key.A) ? -1 : 0) + (Keyboard.IsKeyDown(Key.D) ? 1 : 0), 0, (Keyboard.IsKeyDown(Key.S) ? -1 : 0) + (Keyboard.IsKeyDown(Key.W) ? 1 : 0)).add(
					MobileVector,
				).normalized;
	}
}
